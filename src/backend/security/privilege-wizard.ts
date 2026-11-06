import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { IS_WINDOWS, resolveXrayBinary } from '../platform';

export interface PrivilegeStatus {
  localProxyReady: boolean;
  hasNetAdminCap: boolean;
  hasScopedSudo: boolean;
  summary: string;
  setupScriptPath: string;
}

export class PrivilegeWizard {
  public static checkStatus(): PrivilegeStatus {
    const projectRoot = path.resolve(__dirname, '../../../');
    const xrayBin = resolveXrayBinary(projectRoot);
    const setupScriptPath = path.join(projectRoot, 'scripts', 'setup-privileges.sh');

    // Local proxy is always ready without privileges (ports > 1024)
    const localProxyReady = fs.existsSync(xrayBin);

    if (IS_WINDOWS) {
      // Windows has no cap_net_admin/sudoers concept. The default local
      // SOCKS5/HTTP proxy mode is fully unprivileged and always available.
      const summary = localProxyReady
        ? 'Local SOCKS5/HTTP Proxy Mode is 100% active and unprivileged (no admin rights required).'
        : 'Xray binary not found. Run start.bat to download Xray-core automatically.';

      return {
        localProxyReady,
        hasNetAdminCap: false,
        hasScopedSudo: false,
        summary,
        setupScriptPath
      };
    }

    let hasNetAdminCap = false;
    let hasScopedSudo = false;

    // Check capabilities
    try {
      const getcapOut = execSync(`getcap "${xrayBin}" 2>/dev/null`, { encoding: 'utf-8' });
      if (getcapOut.includes('cap_net_admin')) {
        hasNetAdminCap = true;
      }
    } catch {
      // ignore
    }

    // Check sudoers
    try {
      if (fs.existsSync('/etc/sudoers.d/opencode-vpn')) {
        hasScopedSudo = true;
      }
    } catch {
      // ignore
    }

    let summary = 'Local SOCKS5/HTTP Proxy Mode is 100% active and unprivileged (Zero Root Required).';
    if (hasNetAdminCap || hasScopedSudo) {
      summary = 'Passwordless execution & network capabilities are fully configured.';
    }

    return {
      localProxyReady,
      hasNetAdminCap,
      hasScopedSudo,
      summary,
      setupScriptPath
    };
  }
}
