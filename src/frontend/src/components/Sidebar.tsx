import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Layers,
  History,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Database,
  Activity,
  Lock,
  Cpu,
  PowerOff
} from 'lucide-react';
import { SystemStatus } from '../types';
import { extractCountry, formatLatency } from '../utils/formatters';

export type NavTab = 'dashboard' | 'live-monitor' | 'configs' | 'activity' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  status: SystemStatus | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenSources: () => void;
  onOpenDiagnostics: () => void;
  onOpenPrivileges: () => void;
  onDisconnectVpn: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  status,
  collapsed,
  onToggleCollapsed,
  onOpenSources,
  onOpenDiagnostics,
  onOpenPrivileges,
  onDisconnectVpn
}) => {
  const isVpnActive = Boolean(status?.activeConnection);
  const isTesting = status?.isRunning || false;
  const activeConn = status?.activeConnection;
  const country = extractCountry(activeConn?.remark);
  const latency = formatLatency(activeConn?.latency_ms);

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'live-monitor' as NavTab,
      label: 'Live Monitor',
      icon: Radio,
      badge: isTesting ? 'LIVE' : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
    },
    {
      id: 'configs' as NavTab,
      label: 'Configurations',
      icon: Layers,
      badge: status?.stats.totalConfigs ? String(status.stats.totalConfigs) : null,
      badgeColor: 'bg-slate-800 text-slate-400 border-slate-700'
    },
    {
      id: 'activity' as NavTab,
      label: 'Activity & Logs',
      icon: History,
      badge: null
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings & Nodes',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-screen transition-all duration-300 ease-in-out flex flex-col border-r border-slate-800/80 bg-[#0a0f1d] backdrop-blur-xl ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Header / Branding */}
      <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-[#0a0f1d] rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            {/* Live pulsing dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0f1d] ${
                isVpnActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white truncate">
                  OpenCode Router
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Network Operations Console
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700/50"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 font-mono">
            Navigation
          </div>
        )}

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-transparent text-emerald-300 font-semibold border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Status / Active Connection Widget */}
      <div className="p-3 border-t border-slate-800/80 bg-[#080d19]">
        {!collapsed ? (
          <div className="space-y-3">
            {/* Active Connection Quick Card */}
            <div
              className={`p-3 rounded-xl border transition ${
                isVpnActive
                  ? 'bg-emerald-950/30 border-emerald-500/30'
                  : 'bg-slate-900/50 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isVpnActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                    }`}
                  />
                  {isVpnActive ? 'Active Proxy Locked' : 'Engine Idle'}
                </span>
                {isVpnActive && (
                  <button
                    onClick={onDisconnectVpn}
                    title="Disconnect Proxy"
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isVpnActive && activeConn ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white truncate">
                    <span>{country.flag}</span>
                    <span className="truncate">{activeConn.remark || activeConn.address}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 uppercase">{activeConn.protocol}</span>
                    <span className={latency.colorClass}>{latency.text}</span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-300">
                  Ready to test & lock low-latency routes
                </p>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={onOpenSources}
                title="Manage GitHub Sources"
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
              >
                <Database className="w-3.5 h-3.5 mb-1" />
                <span className="text-[10px]">Sources</span>
              </button>
              <button
                onClick={onOpenDiagnostics}
                title="Integration Diagnostics"
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
              >
                <Activity className="w-3.5 h-3.5 mb-1" />
                <span className="text-[10px]">Diag</span>
              </button>
              <button
                onClick={onOpenPrivileges}
                title="Zero-Root Security Architecture"
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
              >
                <Lock className="w-3.5 h-3.5 mb-1" />
                <span className="text-[10px]">Security</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onOpenDiagnostics}
              title="Diagnostics & Activity"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenPrivileges}
              title="Security Architecture"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
