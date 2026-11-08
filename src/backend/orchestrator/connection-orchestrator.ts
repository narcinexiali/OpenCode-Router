import { EventEmitter } from 'events';
import { db, getSetting, setSetting } from '../db/database';
import { ConfigFetcher } from '../discovery/config-fetcher';
import { CandidateRanker, RankedConfigRow } from '../tester/candidate-ranker';
import { VpnEngine } from '../vpn/vpn-engine';
import { EphemeralTunnelProber } from '../vpn/ephemeral-prober';
import { LatencyTester, TcpTestResult, ProxyTestResult } from '../tester/latency-tester';
import { OpenCodeService } from '../opencode/opencode-service';
import { ClassificationResult } from '../opencode/error-classifier';

export type CandidateProgressStatus =
  | 'tcp_checking'
  | 'tcp_failed'
  | 'tunnel_checking'
  | 'tunnel_failed'
  | 'tunnel_healthy'
  | 'opencode_testing'
  | 'opencode_verified'
  | 'opencode_quota'
  | 'opencode_auth_error'
  | 'active_locked'
  | 'testing'
  | 'working'
  | 'failed'
  | 'rate_limited'
  | 'auth_error';

export interface PipelineMetrics {
  totalSelected: number;
  scanLimit: number | 'all';
  tcp: { completed: number; passed: number; failed: number };
  tunnel: { completed: number; passed: number; failed: number };
  opencode: { completed: number; passed: number; failed: number; model: string };
  currentCandidate?: string;
  bestCandidate?: {
    id: number;
    remark: string;
    protocol: string;
    tcpLatencyMs?: number;
    tunnelLatencyMs?: number;
  };
}

export interface WorkflowProgressEvent {
  phase:
    | 'idle'
    | 'discovering'
    | 'tcp_screening'
    | 'tunnel_verification'
    | 'opencode_verification'
    | 'testing'
    | 'success'
    | 'rate_limited'
    | 'auth_error'
    | 'failed'
    | 'exhausted'
    | 'stopped';
  message: string;
  candidate?: {
    id: number;
    protocol: string;
    address: string;
    port: number;
    remark: string;
    security: string;
    latencyMs?: number;
    tcpLatencyMs?: number;
    tunnelLatencyMs?: number;
    status: CandidateProgressStatus;
    error?: string;
  };
  stats: {
    totalConfigs: number;
    testedCount: number;
    failedCount: number;
    workingCount: number;
  };
  pipelineMetrics?: PipelineMetrics;
  activeConnection?: any;
}

export class ConnectionOrchestrator extends EventEmitter {
  private static instance: ConnectionOrchestrator | null = null;
  private isRunning: boolean = false;
  private isCancelled: boolean = false;
  private currentPhase: WorkflowProgressEvent['phase'] = 'idle';
  private lastMessage: string = 'Ready to find working connection.';
  private currentPipelineMetrics: PipelineMetrics | undefined;
  private cachedCounts: { total: number; working: number; failed: number; untested: number } | null = null;
  private lastCountsCheck: number = 0;

  private constructor() {
    super();
  }

  public static getInstance(): ConnectionOrchestrator {
    if (!this.instance) {
      this.instance = new ConnectionOrchestrator();
    }
    return this.instance;
  }

  public getStatus() {
    const vpn = VpnEngine.getInstance();
    const opencode = OpenCodeService.getInstance();
    const now = Date.now();

    if (!this.cachedCounts || (now - this.lastCountsCheck > 1000)) {
      const counts = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN last_status = 'working' THEN 1 ELSE 0 END) as working,
          SUM(CASE WHEN last_status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN last_status = 'untested' THEN 1 ELSE 0 END) as untested
        FROM configs
      `).get() as any;

      this.cachedCounts = {
        total: counts?.total || 0,
        working: counts?.working || 0,
        failed: counts?.failed || 0,
        untested: counts?.untested || 0
      };
      this.lastCountsCheck = now;
    }

    return {
      phase: this.currentPhase,
      isRunning: this.isRunning,
      message: this.lastMessage,
      activeConnection: vpn.getActiveConfig(),
      opencode: opencode.getInfo(),
      scanCandidateLimit: getSetting('scan_candidate_limit', '100'),
      stats: {
        totalConfigs: this.cachedCounts.total,
        workingCount: this.cachedCounts.working,
        failedCount: this.cachedCounts.failed,
        untestedCount: this.cachedCounts.untested
      },
      pipelineMetrics: this.currentPipelineMetrics
    };
  }

  public stopTesting(): void {
    if (this.isRunning) {
      this.isCancelled = true;
      EphemeralTunnelProber.cleanupAll();
      this.lastMessage = 'Testing stopped by user.';
      this.emitProgress('stopped', this.lastMessage);
    }
  }

  /**
   * Main High-Speed 3-Stage Pipeline:
   * Stage 1: Parallel Fast TCP Screening (bounded concurrency 25, 1500ms timeout)
   * Stage 2: Parallel Proxy Tunnel Verification (bounded concurrency 5, 3000ms timeout, isolated ports & configs)
   * Stage 3: Ranked Sequential OpenCode Verification (using explicitly approved free OpenCode model, early exit on #1)
   */
  public async findWorkingConnection(forceRefreshSources: boolean = false, scanLimitParam?: number | 'all'): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    this.isRunning = true;
    this.isCancelled = false;
    const vpn = VpnEngine.getInstance();
    const opencode = OpenCodeService.getInstance();

    const socksPort = parseInt(getSetting('socks_port', '10808'), 10);
    const httpPort = parseInt(getSetting('http_port', '10809'), 10);
    const opencodeTimeout = parseInt(getSetting('opencode_timeout_seconds', '22'), 10);

    // Determine candidate limit
    let scanLimit: number | 'all' = 100;
    if (scanLimitParam !== undefined) {
      scanLimit = scanLimitParam;
      setSetting('scan_candidate_limit', String(scanLimitParam));
    } else {
      const saved = getSetting('scan_candidate_limit', '100');
      scanLimit = saved === 'all' ? 'all' : parseInt(saved, 10) || 100;
    }

    const freeModel = opencode.getApprovedVerificationModel();

    try {
      // Step 0: Ensure we have configurations cached
      const existingCount = (db.prepare('SELECT COUNT(*) as count FROM configs').get() as any)?.count || 0;
      if (existingCount === 0 || forceRefreshSources) {
        this.emitProgress('discovering', 'Discovering and updating VPN configurations from GitHub sources...');
        await ConfigFetcher.fetchAllSources();
      }

      if (this.isCancelled) {
        this.cleanupAndFinish('stopped', 'Workflow cancelled.');
        return false;
      }

      // Retrieve deduplicated candidate pool
      const candidates = CandidateRanker.getRankedCandidates(scanLimit);
      if (candidates.length === 0) {
        this.emitProgress('exhausted', 'No candidate configurations available. Please refresh or add sources.');
        this.cleanupAndFinish('exhausted', 'No candidates available.');
        return false;
      }

      // Initialize pipeline metrics
      this.currentPipelineMetrics = {
        totalSelected: candidates.length,
        scanLimit,
        tcp: { completed: 0, passed: 0, failed: 0 },
        tunnel: { completed: 0, passed: 0, failed: 0 },
        opencode: { completed: 0, passed: 0, failed: 0, model: freeModel },
        currentCandidate: undefined,
        bestCandidate: undefined
      };

      // =========================================================================
      // STAGE 1: Parallel Fast TCP Screening (25 concurrency, 1500ms timeout)
      // =========================================================================
      this.emitProgress('tcp_screening', `Stage 1/3: Screening ${candidates.length} candidates with parallel TCP handshakes...`);

      const tcpPassedCandidates: Array<RankedConfigRow & { tcpLatencyMs: number }> = [];

      await LatencyTester.testRemoteTcpPool(
        candidates,
        25, // bounded concurrency
        1500, // fast timeout
        (candidate, tcpResult) => {
          if (!this.currentPipelineMetrics) return;
          this.currentPipelineMetrics.tcp.completed++;
          this.currentPipelineMetrics.currentCandidate = candidate.remark;

          if (tcpResult.reachable) {
            this.currentPipelineMetrics.tcp.passed++;
            tcpPassedCandidates.push({ ...candidate, tcpLatencyMs: tcpResult.latencyMs });
            this.emitProgress(
              'tcp_screening',
              `TCP Handshake OK (${tcpResult.latencyMs}ms): ${candidate.remark}`,
              {
                id: candidate.id,
                protocol: candidate.protocol,
                address: candidate.address,
                port: candidate.port,
                remark: candidate.remark,
                security: candidate.security,
                tcpLatencyMs: tcpResult.latencyMs,
                status: 'tunnel_checking'
              }
            );
          } else {
            this.currentPipelineMetrics.tcp.failed++;
            this.recordCandidateResult(candidate.id, -1, 0, 0, 'TCP_UNREACHABLE', tcpResult.error);
            this.emitProgress(
              'tcp_screening',
              `TCP Unreachable: ${candidate.remark}`,
              {
                id: candidate.id,
                protocol: candidate.protocol,
                address: candidate.address,
                port: candidate.port,
                remark: candidate.remark,
                security: candidate.security,
                status: 'tcp_failed',
                error: tcpResult.error || 'TCP connection timeout'
              }
            );
          }
        },
        () => this.isCancelled
      );

      if (this.isCancelled) {
        this.cleanupAndFinish('stopped', 'Testing cancelled by user.');
        return false;
      }

      if (tcpPassedCandidates.length === 0) {
        this.emitProgress('exhausted', 'All candidates failed Stage 1 TCP handshake.');
        this.cleanupAndFinish('exhausted', 'All candidates failed TCP check.');
        return false;
      }

      // Sort TCP-passed candidates by TCP latency
      tcpPassedCandidates.sort((a, b) => a.tcpLatencyMs - b.tcpLatencyMs);

      // =========================================================================
      // STAGE 2: Parallel Proxy Tunnel Verification (5 workers, isolated ports/configs)
      // =========================================================================
      this.emitProgress(
        'tunnel_verification',
        `Stage 2/3: Verifying HTTP proxy tunnel for ${tcpPassedCandidates.length} TCP-reachable candidates...`
      );

      const tunnelHealthyCandidates: Array<RankedConfigRow & { tcpLatencyMs: number; proxyResult: ProxyTestResult }> = [];

      await EphemeralTunnelProber.testTunnelPool(
        tcpPassedCandidates,
        5, // bounded concurrency
        3000, // 3000ms canary request timeout
        (candidate, proxyResult) => {
          if (!this.currentPipelineMetrics) return;
          this.currentPipelineMetrics.tunnel.completed++;
          this.currentPipelineMetrics.currentCandidate = candidate.remark;

          const tcpCandidate = tcpPassedCandidates.find((c) => c.id === candidate.id);
          const tcpLatency = tcpCandidate?.tcpLatencyMs;

          if (proxyResult.success) {
            this.currentPipelineMetrics.tunnel.passed++;
            tunnelHealthyCandidates.push({
              ...candidate,
              tcpLatencyMs: tcpLatency || proxyResult.latencyMs,
              proxyResult
            });

            // Update best candidate tracker
            if (
              !this.currentPipelineMetrics.bestCandidate ||
              (proxyResult.latencyMs > 0 && proxyResult.latencyMs < (this.currentPipelineMetrics.bestCandidate.tunnelLatencyMs || 99999))
            ) {
              this.currentPipelineMetrics.bestCandidate = {
                id: candidate.id,
                remark: candidate.remark,
                protocol: candidate.protocol,
                tcpLatencyMs: tcpLatency,
                tunnelLatencyMs: proxyResult.latencyMs
              };
            }

            this.emitProgress(
              'tunnel_verification',
              `Tunnel Healthy (${proxyResult.latencyMs}ms): ${candidate.remark}`,
              {
                id: candidate.id,
                protocol: candidate.protocol,
                address: candidate.address,
                port: candidate.port,
                remark: candidate.remark,
                security: candidate.security,
                tcpLatencyMs: tcpLatency,
                tunnelLatencyMs: proxyResult.latencyMs,
                latencyMs: proxyResult.latencyMs,
                status: 'tunnel_healthy'
              }
            );
          } else {
            this.currentPipelineMetrics.tunnel.failed++;
            this.recordCandidateResult(candidate.id, -1, 0, 0, 'PROXY_CONNECTIVITY_FAILED', proxyResult.error);
            this.emitProgress(
              'tunnel_verification',
              `Tunnel Failed: ${candidate.remark}`,
              {
                id: candidate.id,
                protocol: candidate.protocol,
                address: candidate.address,
                port: candidate.port,
                remark: candidate.remark,
                security: candidate.security,
                tcpLatencyMs: tcpLatency,
                status: 'tunnel_failed',
                error: proxyResult.error || 'Proxy connectivity verification failed'
              }
            );
          }
        },
        () => this.isCancelled
      );

      if (this.isCancelled) {
        this.cleanupAndFinish('stopped', 'Testing cancelled by user.');
        return false;
      }

      if (tunnelHealthyCandidates.length === 0) {
        this.emitProgress('exhausted', 'All candidates failed Stage 2 HTTP proxy tunnel verification.');
        this.cleanupAndFinish('exhausted', 'Configurations exhausted.');
        return false;
      }

      // Sort healthy candidates by smart score & tunneled latency (best first)
      tunnelHealthyCandidates.sort((a, b) => {
        // Prioritize lowest verified tunnel latency
        const latA = a.proxyResult.latencyMs > 0 ? a.proxyResult.latencyMs : 99999;
        const latB = b.proxyResult.latencyMs > 0 ? b.proxyResult.latencyMs : 99999;
        return latA - latB;
      });

      // =========================================================================
      // STAGE 3: Ranked Sequential OpenCode Verification (Early Exit on First Pass)
      // =========================================================================
      this.emitProgress(
        'opencode_verification',
        `Stage 3/3: Verifying OpenCode prompt through best candidate: ${tunnelHealthyCandidates[0].remark} (Model: ${freeModel})...`
      );

      let verifiedActive = false;

      // Test top healthy tunnel candidates sequentially (stops on first success or account-level quota)
      for (let i = 0; i < Math.min(tunnelHealthyCandidates.length, 15); i++) {
        if (this.isCancelled) {
          await vpn.stop();
          this.cleanupAndFinish('stopped', 'Testing cancelled by user.');
          return false;
        }

        const candidate = tunnelHealthyCandidates[i];
        if (!this.currentPipelineMetrics) break;
        this.currentPipelineMetrics.opencode.completed++;
        this.currentPipelineMetrics.currentCandidate = candidate.remark;

        // Start proxy in testing mode on production ports (10808/10809)
        const started = await vpn.start(candidate, socksPort, httpPort, true);
        if (!started) continue;

        this.emitProgress(
          'opencode_verification',
          `Testing OpenCode model session through ${candidate.remark} (${candidate.proxyResult.latencyMs}ms)...`,
          {
            id: candidate.id,
            protocol: candidate.protocol,
            address: candidate.address,
            port: candidate.port,
            remark: candidate.remark,
            security: candidate.security,
            tcpLatencyMs: candidate.tcpLatencyMs,
            tunnelLatencyMs: candidate.proxyResult.latencyMs,
            latencyMs: candidate.proxyResult.latencyMs,
            status: 'opencode_testing'
          }
        );

        const opencodeResult: ClassificationResult = await opencode.testOpenCodeConnection(
          httpPort,
          socksPort,
          opencodeTimeout,
          freeModel
        );

        if (opencodeResult.category === 'SUCCESS') {
          // =====================================================================
          // Outcome A: Genuine OpenCode Success!
          // =====================================================================
          this.currentPipelineMetrics.opencode.passed++;
          this.recordCandidateResult(candidate.id, candidate.proxyResult.latencyMs, 1, 1, 'SUCCESS', 'OpenCode session confirmed');

          db.prepare(`UPDATE configs SET is_active = 1, success_count = success_count + 1, last_status = 'working', consecutive_failures = 0 WHERE id = ?`).run(candidate.id);

          vpn.lockActiveConfig(
            candidate,
            candidate.proxyResult.latencyMs,
            candidate.proxyResult.egressIp,
            `Verified working with OpenCode (${candidate.proxyResult.latencyMs}ms latency)`
          );

          this.emitProgress(
            'success',
            `Found working connection! OpenCode verified through ${candidate.remark}.`,
            {
              id: candidate.id,
              protocol: candidate.protocol,
              address: candidate.address,
              port: candidate.port,
              remark: candidate.remark,
              security: candidate.security,
              tcpLatencyMs: candidate.tcpLatencyMs,
              tunnelLatencyMs: candidate.proxyResult.latencyMs,
              latencyMs: candidate.proxyResult.latencyMs,
              status: 'opencode_verified'
            }
          );

          verifiedActive = true;
          this.cleanupAndFinish('success', `Working connection activated: ${candidate.remark}`);
          return true; // Early exit!
        } else if (
          opencodeResult.category === 'FREE_DAILY_QUOTA_EXHAUSTED' ||
          opencodeResult.category === 'TEMPORARY_RATE_LIMIT' ||
          opencodeResult.category === 'AUTH_FAILURE' ||
          opencodeResult.category === 'RATE_LIMIT' ||
          opencodeResult.category === 'AUTH_ERROR' ||
          opencodeResult.detailedState === 'FREE_DAILY_QUOTA_EXHAUSTED' ||
          opencodeResult.detailedState === 'TEMPORARY_RATE_LIMIT' ||
          opencodeResult.detailedState === 'AUTH_FAILURE'
        ) {
          // =====================================================================
          // Outcome B: Model Quota / Auth Error (Proxy tunnel is healthy!)
          // Preserve the verified healthy tunnel and lock it as active.
          // Never discard a healthy tunnel due to model-level limits.
          // =====================================================================
          this.currentPipelineMetrics.opencode.failed++;
          const isAuth = opencodeResult.category === 'AUTH_FAILURE' || opencodeResult.category === 'AUTH_ERROR' || opencodeResult.detailedState === 'AUTH_FAILURE';
          const errorCategory = isAuth ? 'AUTH_ERROR' : 'ACCOUNT_QUOTA';
          this.recordCandidateResult(candidate.id, candidate.proxyResult.latencyMs, 1, 0, errorCategory, opencodeResult.userMessage);

          db.prepare(`UPDATE configs SET is_active = 1, success_count = success_count + 1, last_status = 'working', consecutive_failures = 0 WHERE id = ?`).run(candidate.id);

          const resetNote = opencodeResult.quotaReset?.resetMessage
            ? ` ${opencodeResult.quotaReset.resetMessage}`
            : ' Reset time unknown — awaiting server confirmation.';

          const reasonNote = isAuth
            ? `Proxy tunnel active (${candidate.proxyResult.latencyMs}ms). Note: OpenCode credentials required.`
            : `Tunnel Healthy / OpenCode Quota Exhausted (${candidate.proxyResult.latencyMs}ms). free quota reached for model ${freeModel}.${resetNote}`;

          vpn.lockActiveConfig(
            candidate,
            candidate.proxyResult.latencyMs,
            candidate.proxyResult.egressIp,
            reasonNote
          );

          const statusType: CandidateProgressStatus = isAuth
            ? 'opencode_auth_error'
            : 'opencode_quota';

          this.emitProgress(
            isAuth ? 'auth_error' : 'rate_limited',
            opencodeResult.userMessage,
            {
              id: candidate.id,
              protocol: candidate.protocol,
              address: candidate.address,
              port: candidate.port,
              remark: candidate.remark,
              security: candidate.security,
              tcpLatencyMs: candidate.tcpLatencyMs,
              tunnelLatencyMs: candidate.proxyResult.latencyMs,
              latencyMs: candidate.proxyResult.latencyMs,
              status: statusType,
              error: opencodeResult.userMessage
            }
          );

          verifiedActive = true;
          this.cleanupAndFinish(
            isAuth ? 'auth_error' : 'rate_limited',
            `Proxy tunnel ready (${candidate.remark}, ${candidate.proxyResult.latencyMs}ms). ${reasonNote}`
          );
          return false; // Stopped rotation cleanly
        } else {
          // Outcome C: Specific proxy network route error to opencode.ai
          await vpn.stop();
          this.recordCandidateResult(candidate.id, candidate.proxyResult.latencyMs, 1, 0, 'NETWORK_ERROR', opencodeResult.userMessage);
          this.emitProgress('testing', `OpenCode network test failed through ${candidate.remark}. Testing next healthy tunnel...`, {
            id: candidate.id,
            protocol: candidate.protocol,
            address: candidate.address,
            port: candidate.port,
            remark: candidate.remark,
            security: candidate.security,
            tcpLatencyMs: candidate.tcpLatencyMs,
            tunnelLatencyMs: candidate.proxyResult.latencyMs,
            latencyMs: candidate.proxyResult.latencyMs,
            status: 'failed',
            error: opencodeResult.userMessage
          });
        }
      }

      // If OpenCode prompts failed on routes, lock the #1 healthy tunnel as active proxy
      if (!verifiedActive && tunnelHealthyCandidates.length > 0) {
        const best = tunnelHealthyCandidates[0];
        await vpn.start(best, socksPort, httpPort, false);
        vpn.lockActiveConfig(
          best,
          best.proxyResult.latencyMs,
          best.proxyResult.egressIp,
          `Proxy tunnel active (${best.proxyResult.latencyMs}ms). Canary verified.`
        );
        db.prepare(`UPDATE configs SET is_active = 1, success_count = success_count + 1, last_status = 'working', consecutive_failures = 0 WHERE id = ?`).run(best.id);

        this.emitProgress('success', `Tunnel verified and locked: ${best.remark} (${best.proxyResult.latencyMs}ms).`, {
          id: best.id,
          protocol: best.protocol,
          address: best.address,
          port: best.port,
          remark: best.remark,
          security: best.security,
          tcpLatencyMs: best.tcpLatencyMs,
          tunnelLatencyMs: best.proxyResult.latencyMs,
          latencyMs: best.proxyResult.latencyMs,
          status: 'tunnel_healthy'
        });
        this.cleanupAndFinish('success', `Proxy tunnel activated: ${best.remark}`);
        return true;
      }

      await vpn.stop();
      this.emitProgress('exhausted', 'All tested configurations exhausted without a successful connection.');
      this.cleanupAndFinish('exhausted', 'Configurations exhausted.');
      return false;
    } catch (err: any) {
      await vpn.stop();
      EphemeralTunnelProber.cleanupAll();
      this.emitProgress('failed', `Unexpected error during testing: ${err.message}`);
      this.cleanupAndFinish('failed', err.message);
      return false;
    }
  }

  private recordCandidateResult(
    configId: number,
    latencyMs: number,
    proxySuccess: number,
    opencodeSuccess: number,
    errorCategory: string,
    errorMessage?: string
  ): void {
    const isWorking = opencodeSuccess === 1;
    const isProxyWorking = proxySuccess === 1;
    // Proxies with healthy tunnels are preserved as working if OpenCode fails due to auth or account quota
    const status = isWorking
      ? 'working'
      : (isProxyWorking && (errorCategory === 'AUTH_ERROR' || errorCategory === 'ACCOUNT_QUOTA'))
      ? 'working'
      : (errorCategory === 'RATE_LIMIT' ? 'rate_limited' : 'failed');

    db.prepare(`
      UPDATE configs SET
        last_tested_at = datetime('now'),
        last_latency_ms = ?,
        last_status = ?,
        consecutive_failures = CASE WHEN ? = 1 OR (? = 1 AND ? IN ('AUTH_ERROR', 'ACCOUNT_QUOTA')) THEN 0 ELSE consecutive_failures + 1 END
      WHERE id = ?
    `).run(latencyMs > 0 ? latencyMs : null, status, opencodeSuccess, proxySuccess, errorCategory, configId);

    db.prepare(`
      INSERT INTO test_history (config_id, latency_ms, proxy_success, opencode_success, error_category, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(configId, latencyMs > 0 ? latencyMs : null, proxySuccess, opencodeSuccess, errorCategory, errorMessage || null);
  }

  private emitProgress(
    phase: WorkflowProgressEvent['phase'],
    message: string,
    candidate?: WorkflowProgressEvent['candidate']
  ): void {
    this.currentPhase = phase;
    this.lastMessage = message;

    const status = this.getStatus();
    const eventData: WorkflowProgressEvent = {
      phase,
      message,
      candidate,
      stats: {
        totalConfigs: status.stats.totalConfigs,
        testedCount: status.stats.failedCount + status.stats.workingCount,
        failedCount: status.stats.failedCount,
        workingCount: status.stats.workingCount
      },
      pipelineMetrics: this.currentPipelineMetrics,
      activeConnection: status.activeConnection
    };

    this.emit('progress', eventData);
  }

  private cleanupAndFinish(phase: WorkflowProgressEvent['phase'], message: string): void {
    this.isRunning = false;
    this.currentPhase = phase;
    this.lastMessage = message;
    EphemeralTunnelProber.cleanupAll();

    const status = this.getStatus();
    this.emit('progress', {
      phase,
      message,
      stats: {
        totalConfigs: status.stats.totalConfigs,
        testedCount: status.stats.failedCount + status.stats.workingCount,
        failedCount: status.stats.failedCount,
        workingCount: status.stats.workingCount
      },
      pipelineMetrics: this.currentPipelineMetrics,
      activeConnection: status.activeConnection
    });
  }
}
