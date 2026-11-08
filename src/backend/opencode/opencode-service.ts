import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { db, getSetting } from '../db/database';
import { ErrorClassifier, ClassificationResult } from './error-classifier';
import { IS_WINDOWS, resolveOpenCodeBinary, spawnOpenCode, shellQuote } from '../platform';

export const APPROVED_FREE_MODELS = [
  'opencode/deepseek-v4.1-flash-free',
  'opencode/beam-free',
  'opencode/crouton-alpha-free',
  'opencode/flint-40b-free',
  'opencode/glm-5.3-flash-free',
  'opencode/iceman-free',
  'opencode/inkling-2-small-free',
  'opencode/mimo-v2.6-flash-free',
  'opencode/nemotron-3.5-lightning-free',
  'opencode/nemotron-3.5-super-vl-free'
] as const;

export type ApprovedFreeModel = typeof APPROVED_FREE_MODELS[number];

export interface OpenCodeInfo {
  installed: boolean;
  version?: string;
  binaryPath: string;
  configPath?: string;
  defaultModel?: string;
}

export class OpenCodeService {
  private static instance: OpenCodeService | null = null;
  private binaryPath: string = resolveOpenCodeBinary();
  private launcherPath: string;
  private cachedInfo: OpenCodeInfo | null = null;
  private lastInfoCheck: number = 0;

  private constructor() {
    const projectRoot = path.resolve(__dirname, '../../../');
    this.launcherPath = IS_WINDOWS
      ? path.join(projectRoot, 'bin', 'opencode-vpn.cmd')
      : path.join(projectRoot, 'bin', 'opencode-vpn');

    if (!fs.existsSync(this.binaryPath)) {
      try {
        const found = execSync(
          IS_WINDOWS ? `where ${shellQuote('opencode')}` : `which ${shellQuote('opencode')}`,
          { encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim().split(/\r?\n/)[0];
        if (found) this.binaryPath = found;
      } catch {
        // keep fallback
      }
    }

    this.ensureLauncherScript();
  }

  public static getInstance(): OpenCodeService {
    if (!this.instance) {
      this.instance = new OpenCodeService();
    }
    return this.instance;
  }

  public getInfo(): OpenCodeInfo {
    const now = Date.now();
    // Cache info for 30 seconds to avoid blocking execSync on every progress event
    if (this.cachedInfo && (now - this.lastInfoCheck < 30000)) {
      return this.cachedInfo;
    }

    const installed = fs.existsSync(this.binaryPath);
    let version: string | undefined;
    let configPath: string | undefined;
    let defaultModel: string | undefined;

    if (installed) {
      try {
        // Normalize `opencode --version` output ("opencode v2.2.5" -> "2.2.5")
        const raw = execSync(`${shellQuote(this.binaryPath)} --version`, { encoding: 'utf-8', timeout: 3000 }).trim();
        version = raw.split(/\s+/).pop()?.replace(/^v/, '') || raw;
      } catch {
        // ignore
      }

      const userConfig = path.join(process.env.HOME || os.homedir(), '.config', 'opencode', 'opencode.json');
      if (fs.existsSync(userConfig)) {
        configPath = userConfig;
        try {
          const cfg = JSON.parse(fs.readFileSync(userConfig, 'utf-8'));
          defaultModel = cfg.model;
        } catch {
          // ignore
        }
      }
    }

    this.cachedInfo = {
      installed,
      version,
      binaryPath: this.binaryPath,
      configPath,
      defaultModel
    };
    this.lastInfoCheck = now;

    return this.cachedInfo;
  }

  public getLauncherPath(): string {
    return this.launcherPath;
  }

  public ensureLauncherScript(): void {
    const launcherDir = path.dirname(this.launcherPath);
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
    }

    let script: string;
    if (IS_WINDOWS) {
      script = `@echo off
rem Dedicated OpenCode VPN Launcher
rem Injects the active local proxy specifically for OpenCode without system-wide routing changes.

if not defined OPENCODE_HTTP_PROXY_PORT set "OPENCODE_HTTP_PROXY_PORT=10809"
if not defined OPENCODE_SOCKS_PROXY_PORT set "OPENCODE_SOCKS_PROXY_PORT=10808"

set "http_proxy=http://127.0.0.1:%OPENCODE_HTTP_PROXY_PORT%"
set "https_proxy=http://127.0.0.1:%OPENCODE_HTTP_PROXY_PORT%"
set "HTTP_PROXY=http://127.0.0.1:%OPENCODE_HTTP_PROXY_PORT%"
set "HTTPS_PROXY=http://127.0.0.1:%OPENCODE_HTTP_PROXY_PORT%"
set "all_proxy=socks5://127.0.0.1:%OPENCODE_SOCKS_PROXY_PORT%"
set "ALL_PROXY=socks5://127.0.0.1:%OPENCODE_SOCKS_PROXY_PORT%"

set "OPENCODE_BIN=${this.binaryPath}"
if not exist "%OPENCODE_BIN%" (
  for /f "usebackq delims=" %%i in (\`where opencode 2^>nul\`) do set "OPENCODE_BIN=%%i"
)

"%OPENCODE_BIN%" %*
`;
    } else {
      script = `#!/usr/bin/env bash
# Dedicated OpenCode VPN Launcher
# Injects the active local proxy specifically for OpenCode without system-wide routing changes.

HTTP_PORT="\${OPENCODE_HTTP_PROXY_PORT:-10809}"
SOCKS_PORT="\${OPENCODE_SOCKS_PROXY_PORT:-10808}"

export http_proxy="http://127.0.0.1:\${HTTP_PORT}"
export https_proxy="http://127.0.0.1:\${HTTP_PORT}"
export HTTP_PROXY="http://127.0.0.1:\${HTTP_PORT}"
export HTTPS_PROXY="http://127.0.0.1:\${HTTP_PORT}"
export all_proxy="socks5://127.0.0.1:\${SOCKS_PORT}"
export ALL_PROXY="socks5://127.0.0.1:\${SOCKS_PORT}"
export no_proxy="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.18.1"
export NO_PROXY="localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.18.1"

OPENCODE_BIN="${this.binaryPath}"
if [ ! -x "\$OPENCODE_BIN" ]; then
  OPENCODE_BIN=\$(which opencode 2>/dev/null || echo "opencode")
fi

exec "\$OPENCODE_BIN" "\$@"
`;
    }

    fs.writeFileSync(this.launcherPath, script, { encoding: 'utf-8', mode: IS_WINDOWS ? 0o644 : 0o755 });

    if (!IS_WINDOWS) {
      // Also link to ~/.local/bin/opencode-vpn if directory exists
      const userLocalBin = path.join(process.env.HOME || os.homedir(), '.local', 'bin');
      if (fs.existsSync(userLocalBin)) {
        const userLink = path.join(userLocalBin, 'opencode-vpn');
        try {
          if (!fs.existsSync(userLink)) {
            fs.symlinkSync(this.launcherPath, userLink);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Get the strictly approved OpenCode free verification model.
   * Never falls back to configured default models or paid providers.
   */
  public getApprovedVerificationModel(): string {
    const configured = getSetting('opencode_verification_model', 'opencode/deepseek-v4.1-flash-free');
    if (APPROVED_FREE_MODELS.includes(configured as any)) {
      return configured;
    }
    return 'opencode/deepseek-v4.1-flash-free';
  }

  /**
   * Run a controlled, non-interactive OpenCode test through the specific candidate proxy.
   * Strictly enforces using an approved OpenCode free-tier model.
   * Never calls paid providers (e.g. litellm/*) or unauthorized models.
   */
  public async testOpenCodeConnection(
    httpPort: number = 10809,
    socksPort: number = 10808,
    timeoutSeconds: number = 18,
    modelOverride?: string
  ): Promise<ClassificationResult> {
    const targetModel = modelOverride || this.getApprovedVerificationModel();

    // Strict model allowlist guard
    if (!APPROVED_FREE_MODELS.includes(targetModel as any)) {
      return {
        category: 'AUTH_ERROR',
        isRecoverableBySwitchingVpn: false,
        userMessage: `Verification blocked: Model '${targetModel || 'unspecified'}' is not in the approved OpenCode free models allowlist. Paid/third-party providers are strictly disabled for automated candidate screening.`
      };
    }

    const prompt = 'Reply with exactly: CONNECTION_OK';
    const args = [
      'run',
      '-m', targetModel,
      '--title', 'opencode-proxy-probe',
      prompt,
      '--pure',
      '--format', 'json',
      '--print-logs'
    ];

    // Write an ephemeral probe config to prevent stalling on offline remote MCP servers (e.g. windows-opencode)
    const probeConfigPath = path.join(os.tmpdir(), 'opencode-proxy-probe-config.json');
    try {
      fs.writeFileSync(probeConfigPath, JSON.stringify({
        mcp: {},
        model: targetModel,
        small_model: targetModel
      }), { mode: 0o600 });
    } catch {}

    // Proxy settings injected exclusively into this process
    const proxyEnv: NodeJS.ProcessEnv = {
      ...process.env,
      http_proxy: `http://127.0.0.1:${httpPort}`,
      https_proxy: `http://127.0.0.1:${httpPort}`,
      HTTP_PROXY: `http://127.0.0.1:${httpPort}`,
      HTTPS_PROXY: `http://127.0.0.1:${httpPort}`,
      all_proxy: `socks5://127.0.0.1:${socksPort}`,
      ALL_PROXY: `socks5://127.0.0.1:${socksPort}`,
      no_proxy: 'localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.18.1',
      NO_PROXY: 'localhost,127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.18.1',
      OPENCODE_CONFIG: probeConfigPath,
      OPENCODE_DISABLE_PROJECT_CONFIG: 'true'
    };

    return new Promise<ClassificationResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let isDone = false;

      const spawnSpec = spawnOpenCode(this.binaryPath, args);
      const child = spawn(spawnSpec.file, spawnSpec.args, {
        env: proxyEnv,
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try {
            child.kill('SIGKILL');
          } catch {}
          resolve({
            category: 'NETWORK_ERROR',
            isRecoverableBySwitchingVpn: true,
            userMessage: `OpenCode test timed out after ${timeoutSeconds}s through proxy.`,
            rawDetails: stderr || stdout
          });
        }
      }, timeoutSeconds * 1000);

      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          resolve({
            category: 'CONFIG_ERROR',
            isRecoverableBySwitchingVpn: false,
            userMessage: `Failed to execute OpenCode binary: ${err.message}`,
            rawDetails: err.stack
          });
        }
      });

      child.on('exit', (code) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);

          let rawHeaders: Record<string, string> | undefined;
          // If quota reached or rate-limited, query endpoint directly through proxy to capture exact HTTP headers
          const combined = `${stdout}\n${stderr}`.toLowerCase();
          if (combined.includes('free usage limit') || combined.includes('rate limit') || combined.includes('429')) {
            try {
              const probeCmd = `curl -s -i --max-time 3 --proxy http://127.0.0.1:${httpPort} https://opencode.ai/inference/openai/v1/chat/completions -H "Authorization: Bearer public" -H "User-Agent: opencode/1.19.5" -H "Content-Type: application/json" -d '{"model":"${targetModel}","messages":[{"role":"user","content":"ping"}],"stream":false}'`;
              const probeOut = execSync(probeCmd, { encoding: 'utf-8', timeout: 3500 });
              rawHeaders = {};
              for (const line of probeOut.split('\n')) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                  rawHeaders[parts[0].trim().toLowerCase()] = parts.slice(1).join(':').trim();
                }
              }
            } catch {
              // fallback to stderr parsing
            }
          }

          const classification = ErrorClassifier.classify(code, stdout, stderr, targetModel, rawHeaders);
          classification.rawDetails = stderr.slice(0, 1000) || stdout.slice(0, 1000);
          resolve(classification);
        }
      });
    });
  }
}
