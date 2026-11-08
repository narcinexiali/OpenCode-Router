import React from 'react';
import {
  Cpu,
  Globe,
  Radio,
  Zap,
  RefreshCw,
  Activity,
  ShieldCheck,
  Menu,
  Sliders
} from 'lucide-react';
import { SystemStatus } from '../types';
import { NavTab } from './Sidebar';

interface TopHeaderProps {
  currentTab: NavTab;
  status: SystemStatus | null;
  onStartWorkflow: () => void;
  onRefreshSources: () => void;
  onOpenDiagnostics: () => void;
  onToggleMobileMenu?: () => void;
  actionLoading: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  status,
  onStartWorkflow,
  onRefreshSources,
  onOpenDiagnostics,
  onToggleMobileMenu,
  actionLoading
}) => {
  const isVpnActive = Boolean(status?.activeConnection);
  const isTesting = status?.isRunning || false;

  const tabLabels: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Operations Dashboard',
      subtitle: 'Real-time telemetry, 3-stage candidate screening pipeline, and active route control'
    },
    'live-monitor': {
      title: 'Live Monitor Feed',
      subtitle: 'Streaming real-time candidate probe evaluations, TCP handshakes, and canary results'
    },
    configs: {
      title: 'Proxy Configurations',
      subtitle: 'Manage, search, test, and activate cached V2Ray/Xray routing profiles'
    },
    activity: {
      title: 'Audit & Test History',
      subtitle: 'Historical performance records, latency distributions, and error classifications'
    },
    settings: {
      title: 'Console Settings & Nodes',
      subtitle: 'Network ports, verification model allowlist, launcher script, and GitHub sources'
    }
  };

  const currentMeta = tabLabels[currentTab] || tabLabels.dashboard;

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-slate-800/80 bg-[#080d19]/90 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-bold text-white tracking-tight">
              {currentMeta.title}
            </h1>
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
              NOC
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-400 truncate max-w-lg">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Telemetry Badges & Quick Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* OpenCode Version & Target */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">OpenCode:</span>
          <span className="font-mono font-semibold text-cyan-300">
            {status?.opencode.version ? `v${status.opencode.version}` : 'Ready'}
          </span>
        </div>

        {/* VPN State Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isVpnActive
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                : 'bg-slate-500'
            }`}
          />
          <span className="text-slate-400">Engine:</span>
          <span
            className={`font-semibold ${
              isVpnActive ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {isVpnActive ? 'Active Locked' : 'Idle'}
          </span>
        </div>

        {/* Network Routing Mode */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Routing:</span>
          <span className="font-semibold text-emerald-300">Isolated User-Space</span>
        </div>

        {/* Direct OS IP */}
        <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-400">
          <span>OS IP:</span>
          <span className="text-slate-300">{status?.normalIp || 'Direct'}</span>
        </div>

        {/* Quick Diagnostics */}
        <button
          onClick={onOpenDiagnostics}
          title="Open System Diagnostics"
          className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <Activity className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Quick Refresh Nodes */}
        <button
          onClick={onRefreshSources}
          disabled={isTesting || actionLoading}
          title="Refresh Node Sources"
          className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>

        {/* Primary Action Button */}
        {!isTesting ? (
          <button
            onClick={onStartWorkflow}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-1.5 md:py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs md:text-sm shadow-md shadow-emerald-500/20 transition transform active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Find Working Connection</span>
            <span className="sm:hidden">Scan</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>Scanning Active</span>
          </div>
        )}
      </div>
    </header>
  );
};
