export type ErrorCategory =
  | 'SUCCESS'
  | 'RATE_LIMIT'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'CONFIG_ERROR'
  | 'UNKNOWN'
  | 'TUNNEL_HEALTHY'
  | 'TUNNEL_UNREACHABLE'
  | 'GATEWAY_CONNECTIVITY_FAILURE'
  | 'FREE_DAILY_QUOTA_EXHAUSTED'
  | 'TEMPORARY_RATE_LIMIT'
  | 'AUTH_FAILURE'
  | 'MODEL_UNAVAILABLE'
  | 'REGION_RESTRICTION'
  | 'UNKNOWN_PROVIDER_ERROR';

export type DetailedState =
  | 'TUNNEL_HEALTHY'
  | 'TUNNEL_UNREACHABLE'
  | 'GATEWAY_CONNECTIVITY_FAILURE'
  | 'FREE_DAILY_QUOTA_EXHAUSTED'
  | 'TEMPORARY_RATE_LIMIT'
  | 'AUTH_FAILURE'
  | 'MODEL_UNAVAILABLE'
  | 'REGION_RESTRICTION'
  | 'UNKNOWN_PROVIDER_ERROR';

export interface QuotaResetDetails {
  retryAfterSeconds?: number;
  estimatedResetUtc?: string;
  resetStatus: 'confirmed' | 'estimated' | 'unknown';
  resetMessage: string;
}

export interface ClassificationResult {
  category: ErrorCategory;
  /** Fine-grained failure state (may be absent for results built by external call sites) */
  detailedState?: DetailedState;
  isRecoverableBySwitchingVpn: boolean;
  userMessage: string;
  testedModel?: string;
  verifiedAt?: string;
  quotaReset?: QuotaResetDetails;
  rawDetails?: string;
}

export class ErrorClassifier {
  /**
   * Classifies an OpenCode test result into granular states while preserving backwards
   * compatibility for existing pipeline orchestrator consumers.
   */
  public static classify(
    exitCode: number | null,
    stdout: string,
    stderr: string,
    testedModel?: string,
    rawHeaders?: Record<string, string>
  ): ClassificationResult {
    const combined = `${stdout}\n${stderr}`.toLowerCase();
    const verifiedAt = new Date().toISOString();

    // 1. Success check
    if (
      exitCode === 0 &&
      (combined.includes('connection_ok') ||
        combined.includes('pong') ||
        combined.includes('"type":"text"') ||
        combined.includes('step_finish') ||
        (combined.includes('session.created') && !combined.includes('error')))
    ) {
      return {
        category: 'SUCCESS',
        detailedState: 'TUNNEL_HEALTHY',
        isRecoverableBySwitchingVpn: false,
        userMessage: 'OpenCode session established successfully. Model inference confirmed.',
        testedModel,
        verifiedAt,
        quotaReset: {
          resetStatus: 'confirmed',
          resetMessage: 'Model actively responding — quota confirmed available.'
        }
      };
    }

    // 2. Free Daily Quota Exhausted Check
    if (
      combined.includes('free usage limit reached') ||
      combined.includes('freeusagelimiterror') ||
      combined.includes('free models work in opencode') ||
      combined.includes('subscribe to opencode go to keep going')
    ) {
      const resetDetails = this.extractResetDetails(combined, rawHeaders);

      return {
        category: 'RATE_LIMIT',
        detailedState: 'FREE_DAILY_QUOTA_EXHAUSTED',
        isRecoverableBySwitchingVpn: true,
        userMessage: `Tunnel Healthy / OpenCode Quota Exhausted. The daily free allowance for model '${testedModel || 'free-tier'}' has been reached on this egress IP.`,
        testedModel,
        verifiedAt,
        quotaReset: resetDetails
      };
    }

    // 3. Provider Quota / Temporary Rate Limit Check
    if (
      combined.includes('rate limit') ||
      combined.includes('http 429') ||
      combined.includes('too many requests') ||
      combined.includes('quota exceeded') ||
      combined.includes('resource has been exhausted') ||
      combined.includes('slow_down')
    ) {
      const isAccountQuota =
        combined.includes('plan and billing details') ||
        combined.includes('insufficient_quota') ||
        combined.includes('credit limit');

      const resetDetails = this.extractResetDetails(combined, rawHeaders);

      return {
        category: 'RATE_LIMIT',
        detailedState: 'TEMPORARY_RATE_LIMIT',
        isRecoverableBySwitchingVpn: !isAccountQuota,
        userMessage: isAccountQuota
          ? 'Provider account rate limit reached (HTTP 429). Rotating VPN will not bypass account-level quota.'
          : 'Temporary API rate limit / concurrency throttle. Short backoff recommended.',
        testedModel,
        verifiedAt,
        quotaReset: resetDetails
      };
    }

    // 4. Authentication / Account Failure
    if (
      combined.includes('unauthorized') ||
      combined.includes('http 401') ||
      combined.includes('http 403') ||
      combined.includes('forbidden') ||
      combined.includes('invalid api key') ||
      combined.includes('authentication failed') ||
      (combined.includes('0 credentials') && combined.includes('auth error'))
    ) {
      const isGeo = combined.includes('country blocked') || combined.includes('region');
      return {
        category: 'AUTH_ERROR',
        detailedState: isGeo ? 'REGION_RESTRICTION' : 'AUTH_FAILURE',
        isRecoverableBySwitchingVpn: isGeo,
        userMessage: isGeo
          ? 'Region restriction: Gateway blocked connection due to geographic location of proxy IP.'
          : 'Authentication error: Invalid or missing provider credentials. Tunnel is healthy.',
        testedModel,
        verifiedAt
      };
    }

    // 5. Model Unavailable / Deprecated / Configuration Error
    if (
      combined.includes('model_not_found') ||
      combined.includes('model not found') ||
      combined.includes('invalid config') ||
      combined.includes('syntaxerror') ||
      (combined.includes('http 400') && combined.includes('server_error'))
    ) {
      return {
        category: 'CONFIG_ERROR',
        detailedState: 'MODEL_UNAVAILABLE',
        isRecoverableBySwitchingVpn: false,
        userMessage: `Model '${testedModel || 'unknown'}' or configuration error: retired, deprecated, or invalid model.`,
        testedModel,
        verifiedAt
      };
    }

    // 6. Network Errors (Gateway Connectivity Failure vs Tunnel Unreachable)
    if (
      combined.includes('econnrefused') ||
      combined.includes('etimedout') ||
      combined.includes('enotfound') ||
      combined.includes('socket hang up') ||
      combined.includes('network timeout') ||
      combined.includes('failed to fetch') ||
      combined.includes('proxy error') ||
      combined.includes('connection refused') ||
      combined.includes('handshake failed') ||
      combined.includes('timed out') ||
      combined.includes('econnreset') ||
      exitCode === 124
    ) {
      const isGatewayOnly = combined.includes('cannot connect to api') || combined.includes('econnreset');
      return {
        category: 'NETWORK_ERROR',
        detailedState: isGatewayOnly ? 'GATEWAY_CONNECTIVITY_FAILURE' : 'TUNNEL_UNREACHABLE',
        isRecoverableBySwitchingVpn: true,
        userMessage: isGatewayOnly
          ? 'Gateway connectivity failure: Proxy tunnel is open, but upstream opencode.ai dropped the connection.'
          : 'Tunnel unreachable: Local SOCKS5/HTTP proxy endpoint refused connection or timed out.',
        testedModel,
        verifiedAt
      };
    }

    // 7. Generic non-zero exit fallback
    if (exitCode !== 0) {
      return {
        category: 'NETWORK_ERROR',
        detailedState: 'TUNNEL_UNREACHABLE',
        isRecoverableBySwitchingVpn: true,
        userMessage: `OpenCode exited with code ${exitCode}. Probable connection failure.`,
        testedModel,
        verifiedAt
      };
    }

    return {
      category: 'UNKNOWN',
      detailedState: 'UNKNOWN_PROVIDER_ERROR',
      isRecoverableBySwitchingVpn: false,
      userMessage: 'Unrecognized response state.',
      testedModel,
      verifiedAt,
      quotaReset: {
        resetStatus: 'unknown',
        resetMessage: 'Reset time unknown — awaiting server confirmation'
      }
    };
  }

  /**
   * Parse Retry-After headers or error body numbers to compute UTC references safely.
   */
  private static extractResetDetails(
    text: string,
    rawHeaders?: Record<string, string>
  ): QuotaResetDetails {
    let retrySeconds: number | undefined;

    // Check raw headers first if available
    if (rawHeaders) {
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (k.toLowerCase() === 'retry-after') {
          const s = parseInt(v, 10);
          if (!isNaN(s) && s > 0) {
            retrySeconds = s;
            break;
          }
        }
      }
    }

    // Check stderr/stdout text for retry-after or delay ms
    if (retrySeconds === undefined) {
      const matchRetry = /retry-after:\s*(\d+)/i.exec(text);
      if (matchRetry && matchRetry[1]) {
        retrySeconds = parseInt(matchRetry[1], 10);
      } else {
        const matchMs = /retryafterms[:=]\s*(\d+)/i.exec(text);
        if (matchMs && matchMs[1]) {
          retrySeconds = Math.round(parseInt(matchMs[1], 10) / 1000);
        }
      }
    }

    if (retrySeconds !== undefined && retrySeconds > 0) {
      const nowMs = Date.now();
      const resetTimeMs = nowMs + retrySeconds * 1000;
      const estimatedUtc = new Date(resetTimeMs).toISOString();

      return {
        retryAfterSeconds: retrySeconds,
        estimatedResetUtc: estimatedUtc,
        resetStatus: 'estimated',
        resetMessage: `Estimated reset: ${estimatedUtc} (~${Math.round(retrySeconds / 3600)}h remaining, awaiting server confirmation)`
      };
    }

    return {
      resetStatus: 'unknown',
      resetMessage: 'Reset time unknown — awaiting server confirmation'
    };
  }
}
