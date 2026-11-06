import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Centralized platform detection and executable discovery.
 * Keeps Windows and Linux differences in one place so the rest
 * of the backend stays platform-agnostic.
 */
export const IS_WINDOWS = process.platform === 'win32';

/**
 * Resolve the Xray binary path.
 * Order: project bin/ directory (platform-specific name), then
 * well-known install locations on the current platform.
 */
export function resolveXrayBinary(projectRoot: string): string {
  const binaryName = IS_WINDOWS ? 'xray.exe' : 'xray';
  const projectBin = path.join(projectRoot, 'bin', binaryName);
  if (fs.existsSync(projectBin)) {
    return projectBin;
  }

  if (IS_WINDOWS) {
    for (const candidate of [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'xray', 'xray.exe'),
      path.join(process.env.USERPROFILE || '', 'scoop', 'apps', 'xray', 'current', 'xray.exe')
    ]) {
      if (fs.existsSync(candidate)) return candidate;
    }
  } else {
    for (const candidate of ['/usr/local/bin/xray', '/usr/local/bin/v2ray']) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // Default to project bin path (may not exist yet; start script downloads it)
  return projectBin;
}

/**
 * Locate an executable on PATH using `where` (Windows) or `which` (Unix).
 * Returns the first hit or empty string.
 */
export function findExecutableOnPath(name: string): string {
  const probe = IS_WINDOWS ? 'where' : 'which';
  try {
    const out = execSync(`${probe} ${shellQuote(name)}`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    const firstLine = out.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
    return firstLine || '';
  } catch {
    return '';
  }
}

/**
 * Locate the OpenCode CLI binary.
 * On Windows npm global installs create several shims in the same directory:
 * `opencode` (sh script), `opencode.cmd`, `opencode.ps1` and optionally
 * `opencode.exe`. Only .exe/.cmd can be spawned by Node, so prefer those.
 */
export function resolveOpenCodeBinary(): string {
  if (IS_WINDOWS) {
    // Prefer spawnable shims; npm's extensionless `opencode` is a sh script
    // that Node cannot spawn on Windows.
    const exe = findExecutableOnPath('opencode.exe');
    if (exe) return exe;
    const cmdShim = findExecutableOnPath('opencode.cmd');
    if (cmdShim) return cmdShim;
    const bare = findExecutableOnPath('opencode');
    if (bare && /\.(exe|cmd)$/i.test(bare)) return bare;
    return path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'npm', 'opencode.cmd');
  }
  return '/usr/local/bin/opencode';
}

/**
 * Build spawn options for launching OpenCode.
 * npm-shim .cmd/.bat files on Windows cannot be spawned directly
 * (EINVAL without a shell), so we go through cmd.exe with pre-quoted args.
 */
export function spawnOpenCode(binaryPath: string, args: string[]): {
  file: string;
  args: string[];
  shell: boolean;
} {
  if (IS_WINDOWS && /\.(cmd|bat)$/i.test(binaryPath)) {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', `""${binaryPath}" ${args.map(quoteWindowsArg).join(' ')}"`],
      shell: false
    };
  }
  return { file: binaryPath, args, shell: false };
}

/**
 * Quote a single argument for a Windows cmd.exe command line.
 */
export function quoteWindowsArg(arg: string): string {
  if (arg === '' || /[\s"]/.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

/**
 * Quote a path/argument for interpolation into a shell command string
 * executed via execSync (cmd.exe on Windows, /bin/sh otherwise).
 */
export function shellQuote(arg: string): string {
  if (IS_WINDOWS) {
    return `"${arg}"`;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}
