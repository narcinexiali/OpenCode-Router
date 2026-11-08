import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Sidebar, NavTab } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { Dashboard } from './components/Dashboard';
import { TestingLiveFeed, LiveCandidateLog } from './components/TestingLiveFeed';
import { ConfigTable } from './components/ConfigTable';
import { ActivityLogs } from './components/ActivityLogs';
import { SettingsPanel } from './components/SettingsPanel';
import { SourcesModal } from './components/SourcesModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { PrivilegeSetupModal } from './components/PrivilegeSetupModal';
import { SystemStatus } from './types';

export const App: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    phase: 'idle',
    isRunning: false,
    message: 'System active. Ready to route OpenCode traffic.',
    activeConnection: null,
    opencode: {
      installed: true,
      version: '1.19.5',
      binaryPath: '/usr/local/bin/opencode',
      configPath: '~/.config/opencode/opencode.json',
      defaultModel: 'opencode/deepseek-v4.1-flash-free'
    },
    stats: {
      totalConfigs: 7453,
      workingCount: 1,
      failedCount: 270,
      untestedCount: 7182
    },
    normalIp: 'Direct OS Network (45.39.81.42)',
    socksPort: '10808',
    httpPort: '10809',
    scanCandidateLimit: '100',
    verificationModel: 'opencode/deepseek-v4.1-flash-free',
    approvedFreeModels: []
  });

  const getInitialTab = (): NavTab => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '') as NavTab;
      if (['dashboard', 'live-monitor', 'configs', 'activity', 'settings'].includes(h)) {
        return h;
      }
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<NavTab>(getInitialTab);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '') as NavTab;
      if (['dashboard', 'live-monitor', 'configs', 'activity', 'settings'].includes(h)) {
        setActiveTab(h);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
    setMobileMenuOpen(false);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [liveLogs, setLiveLogs] = useState<LiveCandidateLog[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modal states
  const [sourcesOpen, setSourcesOpen] = useState<boolean>(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState<boolean>(false);
  const [privilegesOpen, setPrivilegesOpen] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Connect to Server-Sent Events (SSE)
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Update overall status
        setStatus((prev) => {
          if (!prev) return prev;
          const isRunning =
            payload.phase === 'testing' ||
            payload.phase === 'discovering' ||
            payload.phase === 'tcp_screening' ||
            payload.phase === 'tunnel_verification' ||
            payload.phase === 'opencode_verification';

          return {
            ...prev,
            phase: payload.phase || prev.phase,
            isRunning: payload.phase ? isRunning : prev.isRunning,
            message: payload.message || prev.message,
            activeConnection: payload.activeConnection !== undefined ? payload.activeConnection : prev.activeConnection,
            stats: payload.stats || prev.stats,
            pipelineMetrics: payload.pipelineMetrics !== undefined ? payload.pipelineMetrics : prev.pipelineMetrics
          };
        });

        // Show toast on completion
        if (payload.phase === 'success') {
          toast.success(payload.message || 'Found working OpenCode connection!');
        } else if (payload.phase === 'rate_limited') {
          toast.warning(payload.message || 'Free model quota limit reached. Preserved healthy proxy tunnel.');
        } else if (payload.phase === 'auth_error') {
          toast.warning(payload.message || 'OpenCode authentication required. Preserved healthy proxy tunnel.');
        } else if (payload.phase === 'exhausted') {
          toast.error(payload.message || 'Tested configurations exhausted.');
        }

        // If candidate log is present, append to live table
        if (payload.candidate) {
          const c = payload.candidate;
          setLiveLogs((prev) => {
            const time = new Date().toLocaleTimeString();
            const existingIdx = prev.findIndex((item) => item.id === c.id);
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                ...c,
                tcpLatencyMs: c.tcpLatencyMs !== undefined ? c.tcpLatencyMs : updated[existingIdx].tcpLatencyMs,
                tunnelLatencyMs: c.tunnelLatencyMs !== undefined ? c.tunnelLatencyMs : updated[existingIdx].tunnelLatencyMs,
                timestamp: time
              };
              return updated;
            } else {
              return [
                {
                  id: c.id,
                  protocol: c.protocol,
                  address: c.address,
                  port: c.port,
                  remark: c.remark,
                  security: c.security,
                  latencyMs: c.latencyMs,
                  tcpLatencyMs: c.tcpLatencyMs,
                  tunnelLatencyMs: c.tunnelLatencyMs,
                  status: c.status,
                  error: c.error,
                  timestamp: time
                },
                ...prev.slice(0, 99) // Keep last 100
              ];
            }
          });
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleStartWorkflow = async (forceRefresh = false, scanLimit?: number | 'all') => {
    setActionLoading(true);
    setLiveLogs([]); // Clear logs for new session
    toast.info(`Starting 3-stage screening pipeline (${scanLimit === 'all' ? 'All nodes' : `${scanLimit || 100} nodes`})...`);
    try {
      await fetch('/api/workflow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh, scanLimit })
      });
      fetchStatus();
    } catch (e: any) {
      toast.error(`Error starting workflow: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopWorkflow = async () => {
    try {
      await fetch('/api/workflow/stop', { method: 'POST' });
      toast.info('Stopping screening workflow...');
      fetchStatus();
    } catch (e: any) {
      toast.error(`Error stopping workflow: ${e.message}`);
    }
  };

  const handleDisconnectVpn = async () => {
    try {
      await fetch('/api/vpn/disconnect', { method: 'POST' });
      toast.success('Proxy disconnected');
      fetchStatus();
    } catch (e: any) {
      toast.error(`Error disconnecting: ${e.message}`);
    }
  };

  const handleTestCurrent = async () => {
    setActionLoading(true);
    const tid = toast.loading('Testing active proxy connection and OpenCode session...');
    try {
      const res = await fetch('/api/vpn/test-current', { method: 'POST' });
      const data = await res.json();
      if (data.proxyTest?.success && data.opencodeTest?.category === 'SUCCESS') {
        toast.success(`Connection fully verified! Proxy Latency: ${data.proxyTest?.latencyMs}ms`, { id: tid });
      } else if (data.proxyTest?.success) {
        toast.info(`Proxy tunnel healthy (${data.proxyTest?.latencyMs}ms). Model note: ${data.opencodeTest?.userMessage}`, { id: tid });
      } else {
        toast.error(`Connection check failed: ${data.proxyTest?.error || 'Unreachable'}`, { id: tid });
      }
      fetchStatus();
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { id: tid });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshSources = async () => {
    setActionLoading(true);
    const tid = toast.loading('Synchronizing configurations from GitHub sources...');
    try {
      await fetch('/api/sources/refresh-all', { method: 'POST' });
      toast.success('GitHub sources updated and cached successfully!', { id: tid });
      fetchStatus();
    } catch (e: any) {
      toast.error(`Failed to refresh sources: ${e.message}`, { id: tid });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportConfigs = async (rawText: string) => {
    const tid = toast.loading('Parsing and importing proxy URLs...');
    try {
      const res = await fetch('/api/configs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText })
      });
      const data = await res.json();
      toast.success(`Import complete! +${data.imported} new, ${data.duplicates} duplicates, ${data.invalid} invalid`, { id: tid });
      fetchStatus();
    } catch (e: any) {
      toast.error(`Failed to import: ${e.message}`, { id: tid });
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch (e: any) {
      console.error('Failed to update setting:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex font-sans bg-grid-pattern selection:bg-emerald-500/30 selection:text-emerald-200">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Modern Collapsible Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={handleSelectTab}
        status={status}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSources={() => setSourcesOpen(true)}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        onOpenPrivileges={() => setPrivilegesOpen(true)}
        onDisconnectVpn={handleDisconnectVpn}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
        }`}
      >
        {/* Top Header */}
        <TopHeader
          currentTab={activeTab}
          status={status}
          onStartWorkflow={() => handleStartWorkflow(false, status?.scanCandidateLimit === 'all' ? 'all' : Number(status?.scanCandidateLimit) || 100)}
          onRefreshSources={handleRefreshSources}
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          actionLoading={actionLoading}
        />

        {/* View Router */}
        <main className="p-4 md:p-6 lg:p-8 flex-1 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <>
              <Dashboard
                status={status}
                onStartWorkflow={handleStartWorkflow}
                onStopWorkflow={handleStopWorkflow}
                onDisconnectVpn={handleDisconnectVpn}
                onTestCurrent={handleTestCurrent}
                onRefreshSources={handleRefreshSources}
                actionLoading={actionLoading}
                onSelectTab={setActiveTab}
                onUpdateVerificationModel={(m) => handleUpdateSetting('opencode_verification_model', m)}
              />

              {/* Live Candidate Stream in Dashboard */}
              <TestingLiveFeed
                logs={liveLogs}
                isTesting={status?.isRunning || false}
                currentMessage={status?.message || ''}
                activeConnectionId={status?.activeConnection?.id}
              />
            </>
          )}

          {activeTab === 'live-monitor' && (
            <TestingLiveFeed
              logs={liveLogs}
              isTesting={status?.isRunning || false}
              currentMessage={status?.message || ''}
              activeConnectionId={status?.activeConnection?.id}
            />
          )}

          {activeTab === 'configs' && (
            <ConfigTable
              onRefreshSources={handleRefreshSources}
              onImportConfigs={handleImportConfigs}
              onOpenSources={() => setSourcesOpen(true)}
            />
          )}

          {activeTab === 'activity' && <ActivityLogs />}

          {activeTab === 'settings' && (
            <SettingsPanel
              status={status}
              onUpdateSetting={handleUpdateSetting}
            />
          )}
        </main>

        {/* Modals */}
        <SourcesModal isOpen={sourcesOpen} onClose={() => setSourcesOpen(false)} />
        <DiagnosticsModal isOpen={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
        <PrivilegeSetupModal isOpen={privilegesOpen} onClose={() => setPrivilegesOpen(false)} />

        {/* Footer */}
        <footer className="border-t border-slate-800/80 bg-[#080d19]/90 py-4 px-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">OpenCode Router</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">v1.0.0</span>
              <span>&bull;</span>
              <span>Targeted OpenCode Proxy & Rate-Limit Router</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Created by</span>
              <span className="font-semibold text-slate-200">Ehsan Shahriyari</span>
              <span>&bull;</span>
              <a
                href="https://github.com/EhsanCreator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition"
              >
                @EhsanCreator
              </a>
              <span>&bull;</span>
              <a
                href="https://github.com/EhsanCreator/OpenCode-Router"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-medium transition"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
