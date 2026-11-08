import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { XrayConfigBuilder } from './xray-config-builder';
import { VpnEngine } from './vpn-engine';
import { LatencyTester, ProxyTestResult } from '../tester/latency-tester';
import { safeWriteSensitiveFile, ensureSecureDirectory } from '../security/file-guard';
import { RankedConfigRow } from '../tester/candidate-ranker';

export interface EphemeralProbeResult {
  candidate: RankedConfigRow;
  proxyResult: ProxyTestResult;
}

export class EphemeralTunnelProber {
  private static readonly BASE_SOCKS_PORT = 11800;
  private static readonly BASE_HTTP_PORT = 11850;
  private static readonly MAX_CONCURRENCY = 5;

  private static activeProcesses = new Set<ChildProcess>();
  private static tempFiles = new Set<string>();

  /**
   * Run bounded concurrent proxy tunnel verification.
   * Concurrency is bounded to maxConcurrency (default: 5).
   * Spawns isolated Xray instances with ephemeral ports and temporary config files (0600).
   * Never impacts or alters the active working connection.
   */
  public static async testTunnelPool(
    candidates: RankedConfigRow[],
    concurrency: number = EphemeralTunnelProber.MAX_CONCURRENCY,
    timeoutMs: number = 3000,
    onProgress?: (candidate: RankedConfigRow, result: ProxyTestResult) => void,
    isCancelled?: () => boolean
  ): Promise<EphemeralProbeResult[]> {
    const results: EphemeralProbeResult[] = [];
    const queue = [...candidates];
    const workerCount = Math.min(concurrency, Math.max(1, candidates.length));

    // Allocate available slot IDs [0 .. workerCount - 1]
    const availableSlots: number[] = Array.from({ length: workerCount }, (_, i) => i);

    const acquireSlot = async (): Promise<number> => {
      while (availableSlots.length === 0) {
        if (isCancelled && isCancelled()) return -1;
        await new Promise((r) => setTimeout(r, 25));
      }
      return availableSlots.shift()!;
    };

    const releaseSlot = (slot: number) => {
      availableSlots.push(slot);
    };

    const worker = async () => {
      while (queue.length > 0) {
        if (isCancelled && isCancelled()) break;
        const candidate = queue.shift();
        if (!candidate) break;

        const slot = await acquireSlot();
        if (slot === -1) break;

        try {
          if (isCancelled && isCancelled()) {
            releaseSlot(slot);
            break;
          }

          const proxyResult = await EphemeralTunnelProber.probeSingleCandidate(candidate, slot, timeoutMs);
          results.push({ candidate, proxyResult });

          if (onProgress) {
            onProgress(candidate, proxyResult);
          }
        } finally {
          releaseSlot(slot);
        }
      }
    };

    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    if (isCancelled && isCancelled()) {
      EphemeralTunnelProber.cleanupAll();
    }

    return results;
  }

  /**
   * Probe a single candidate using an isolated ephemeral port and temporary config file
   */
  private static async probeSingleCandidate(
    candidate: RankedConfigRow,
    slot: number,
    timeoutMs: number
  ): Promise<ProxyTestResult> {
    const socksPort = EphemeralTunnelProber.BASE_SOCKS_PORT + slot;
    const httpPort = EphemeralTunnelProber.BASE_HTTP_PORT + slot;

    const projectRoot = path.resolve(__dirname, '../../../');
    const dataDir = path.join(projectRoot, 'data');
    ensureSecureDirectory(dataDir);

    const configPath = path.join(dataDir, `ephemeral-xray-${slot}.json`);
    EphemeralTunnelProber.tempFiles.add(configPath);

    let details: Record<string, any> = {};
    try {
      details = JSON.parse(candidate.details_json);
    } catch {
      // empty
    }

    const xrayConfig = XrayConfigBuilder.buildClientConfig(
      {
        protocol: candidate.protocol,
        address: candidate.address,
        port: candidate.port,
        security: candidate.security,
        network: candidate.network,
        details
      },
      socksPort,
      httpPort
    );

    safeWriteSensitiveFile(configPath, JSON.stringify(xrayConfig, null, 2));

    const binPath = VpnEngine.getInstance().getBinaryPath();
    let child: ChildProcess | null = null;

    try {
      child = spawn(binPath, ['run', '-c', configPath], {
        stdio: ['ignore', 'ignore', 'ignore']
      });
      EphemeralTunnelProber.activeProcesses.add(child);

      // Probe local HTTP proxy port readiness (up to 800ms)
      const isReady = await EphemeralTunnelProber.probePortReady('127.0.0.1', httpPort, 800);
      if (!isReady) {
        return {
          success: false,
          latencyMs: -1,
          error: 'Ephemeral proxy failed to bind within timeout'
        };
      }

      // Perform HTTP Canary test through the ephemeral proxy
      const testResult = await LatencyTester.testProxyHttp(httpPort, timeoutMs);
      return testResult;
    } catch (err: any) {
      return {
        success: false,
        latencyMs: -1,
        error: `Ephemeral probe error: ${err.message}`
      };
    } finally {
      // Clean up child process
      if (child) {
        EphemeralTunnelProber.activeProcesses.delete(child);
        try {
          child.kill('SIGTERM');
        } catch {}
        try {
          child.kill('SIGKILL');
        } catch {}
      }

      // Remove temporary config file
      try {
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
      } catch {}
      EphemeralTunnelProber.tempFiles.delete(configPath);
    }
  }

  /**
   * Probe local port readiness
   */
  private static async probePortReady(host: string, port: number, maxWaitMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const isListening = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(100);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.once('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(port, host);
      });

      if (isListening) return true;
      await new Promise((r) => setTimeout(r, 40));
    }
    return false;
  }

  /**
   * Cleanup all running worker processes and temporary files
   */
  public static cleanupAll(): void {
    for (const child of EphemeralTunnelProber.activeProcesses) {
      try {
        if (child.pid) {
          process.kill(child.pid, 'SIGKILL');
        }
      } catch {}
    }
    EphemeralTunnelProber.activeProcesses.clear();

    for (const filePath of EphemeralTunnelProber.tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
    EphemeralTunnelProber.tempFiles.clear();
  }
}
