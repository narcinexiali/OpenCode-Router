import React, { useState, useEffect } from 'react';
import {
  Zap,
  Square,
  RefreshCw,
  PowerOff,
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  ShieldCheck,
  Globe,
  Sliders,
  Server,
  Network,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { SystemStatus } from '../types';
import { NetworkCharts, HistoryItem } from './NetworkCharts';
import { extractCountry, formatLatency, getProtocolBadge } from '../utils/formatters';

interface DashboardProps {
  status: SystemStatus | null;
  onStartWorkflow: (forceRefresh?: boolean, scanLimit?: number | 'all') => void;
  onStopWorkflow: () => void;
  onDisconnectVpn: () => void;
  onTestCurrent: () => void;
  onRefreshSources: () => void;
  actionLoading: boolean;
  onSelectTab: (tab: any) => void;
  onUpdateVerificationModel: (model: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  status,
  onStartWorkflow,
  onStopWorkflow,
  onDisconnectVpn,
  onTestCurrent,
  onRefreshSources,
  actionLoading,
  onSelectTab,
  onUpdateVerificationModel
}) => {
  const isTesting = status?.isRunning || false;
  const activeConn = status?.activeConnection;
  const metrics = status?.pipelineMetrics;
  const country = extractCountry(activeConn?.remark);
  const protoBadge = getProtocolBadge(activeConn?.protocol || '');
  const activeLatency = formatLatency(activeConn?.latency_ms);

  const [scanOption, setScanOption] = useState<string>(
    String(status?.scanCandidateLimit || '100')
  );
  const [customLimit, setCustomLimit] = useState<number>(100);
  const [selectedModel, setSelectedModel] = useState<string>(
    status?.verificationModel || 'opencode/deepseek-v4.1-flash-free'
  );
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Keep selectedModel synced with status
  useEffect(() => {
    if (status?.verificationModel) {
      setSelectedModel(status.verificationModel);
    }
  }, [status?.verificationModel]);

  // Fetch real diagnostic history for charts
  useEffect(() => {
    fetch('/api/diagnostics')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.history) {
          setHistory(data.history);
        }
      })
      .catch(() => {});
  }, [status?.phase]);

  const getEffectiveScanLimit = (): number | 'all' => {
    if (scanOption === 'all') return 'all';
    if (scanOption === 'custom') return customLimit || 100;
    return parseInt(scanOption, 10) || 100;
  };

  const handleStart = () => {
    const limit = getEffectiveScanLimit();
    onStartWorkflow(false, limit);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    onUpdateVerificationModel(model);
  };

  // KPI Calculations
  const totalCached = status?.stats.totalConfigs || 0;
  const scannedCount = metrics?.totalSelected || (isTesting ? 100 : status?.stats.workingCount ? status.stats.workingCount + (status.stats.failedCount || 0) : 0);
  const tcpPassed = metrics?.tcp.passed ?? (status?.stats.workingCount || 0);
  const tunnelHealthy = metrics?.tunnel.passed ?? (status?.stats.workingCount || 0);
  const opencodeVerified = metrics?.opencode.passed ?? (status?.activeConnection?.reason?.toLowerCase().includes('verified working with opencode') ? 1 : 0);

  const approvedModels = status?.approvedFreeModels && status.approvedFreeModels.length > 0
    ? status.approvedFreeModels
    : [
        'opencode/deepseek-v4.1-flash-free',
        'opencode/gemini-2.5-flash-free',
        'opencode/llama-3.3-70b-instruct-free',
        'opencode/mistral-large-free',
        'opencode/qwen-2.5-coder-32b-free'
      ];

  return (
    <div className="space-y-6">
      {/* =========================================================================
          HERO & PRIMARY COMMAND CENTER
         ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1424] via-[#0b101c] to-[#070b13] border border-slate-800/80 p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Top badges & Title */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <span className={`w-2 h-2 rounded-full ${isTesting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                  {isTesting ? '3-STAGE PIPELINE SCANNING' : 'PARALLEL 3-STAGE PIPELINE'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Zero-Root User-Space
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-mono">
                  {totalCached} Nodes Cached
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Network Operations Console
              </h1>
              <p className="text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed">
                Parallel non-blocking TCP screening, isolated ephemeral HTTP canary probing, and ranked OpenCode verification without OS disruption.
              </p>
            </div>

            {/* Verification Model Selection */}
            <div className="flex flex-col items-start lg:items-end gap-1.5 bg-[#080d19]/80 border border-slate-800 p-3 rounded-xl max-w-sm">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Verification Target Model:</span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <select
                  value={selectedModel}
                  disabled={isTesting}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full bg-[#0c1322] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
                >
                  {approvedModels.map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-slate-200">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Zero-Credit Protected (Free OpenCode Tier Only)
              </span>
            </div>
          </div>

          {/* Action Row & Candidate Limit Selector */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Prominent Action Button */}
              {!isTesting ? (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  Find Working Connection
                </button>
              ) : (
                <button
                  onClick={onStopWorkflow}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 transition transform active:scale-95 animate-pulse"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Stop Verification
                </button>
              )}

              {/* Scan Limit Selector Pills */}
              <div className="flex items-center bg-[#070b14] border border-slate-800 rounded-xl p-1 text-xs">
                <span className="px-2 text-slate-400 font-semibold flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-cyan-400" />
                  Scan:
                </span>
                {['100', '250', '500', 'all'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setScanOption(opt)}
                    className={`px-3 py-1.5 rounded-lg font-mono font-medium transition ${
                      scanOption === opt
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt === 'all' ? 'All' : opt}
                  </button>
                ))}
                <button
                  onClick={() => setScanOption('custom')}
                  className={`px-2.5 py-1.5 rounded-lg font-mono transition ${
                    scanOption === 'custom'
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom
                </button>

                {scanOption === 'custom' && (
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={customLimit}
                    onChange={(e) => setCustomLimit(Math.max(1, parseInt(e.target.value, 10) || 100))}
                    className="w-16 ml-1.5 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded-md text-emerald-300 text-center font-mono focus:outline-none"
                  />
                )}
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center gap-2">
              {activeConn && (
                <button
                  onClick={onDisconnectVpn}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-rose-400 hover:text-rose-300 border border-slate-800 text-xs font-semibold transition"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              )}

              <button
                onClick={onRefreshSources}
                disabled={isTesting || actionLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin text-emerald-400' : ''}`} />
                Refresh Nodes
              </button>
            </div>
          </div>

          {/* Live Pipeline Status Banner */}
          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isTesting ? 'bg-amber-400 animate-ping' : activeConn ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className="text-slate-400 font-medium">Pipeline Status:</span>
              <span className="font-semibold text-slate-200">
                {status?.message || 'Ready'}
              </span>
            </div>

            {activeConn && (
              <button
                onClick={onTestCurrent}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition"
              >
                Re-verify Outbound Route
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          PERFORMANCE OVERVIEW: 4 VISUALLY DISTINCT KPIS
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Candidates Scanned */}
        <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-lg space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Candidates Scanned
            </span>
            <div className="p-2 rounded-xl bg-slate-800/60 text-slate-400 border border-slate-700/50">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {scannedCount}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {totalCached} Pool</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            Deduplicated candidate endpoints
          </p>
        </div>

        {/* KPI 2: TCP Reachable */}
        <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-lg space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              TCP Reachable
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-cyan-300 font-mono tracking-tight">
              {tcpPassed}
            </span>
            <span className="text-xs text-cyan-500 font-mono">Stage 1 Handshake OK</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            Parallel bounded socket verification
          </p>
        </div>

        {/* KPI 3: Healthy Proxy Tunnels */}
        <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-lg space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Healthy Proxy Tunnels
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {tunnelHealthy}
            </span>
            <span className="text-xs text-emerald-500 font-mono">Canary Verified</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            Isolated ephemeral HTTP GET 204 verified
          </p>
        </div>

        {/* KPI 4: OpenCode Verified */}
        <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-lg space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              OpenCode Verified
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-teal-300 font-mono tracking-tight">
              {opencodeVerified}
            </span>
            <span className="text-xs text-teal-500 font-mono">End-to-End Ready</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            Prompt test confirmed with free tier model
          </p>
        </div>
      </div>

      {/* =========================================================================
          THREE-STAGE PIPELINE VISUALIZATION
         ========================================================================= */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              3-Stage Verification Pipeline Architecture
            </h2>
          </div>
          {metrics?.currentCandidate && (
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400">Testing Candidate:</span>
              <span className="font-mono text-cyan-300 font-bold truncate max-w-xs">{metrics.currentCandidate}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stage 1: Parallel TCP Screening */}
          <div className="p-4 rounded-xl bg-[#090e1a] border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">Stage 1 — Parallel TCP Screening</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                25 Workers
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Concurrent non-blocking socket handshakes discard dead candidates fast.
            </p>
            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${metrics && metrics.totalSelected > 0 ? (metrics.tcp.passed / metrics.totalSelected) * 100 : 0}%`
                }}
              />
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{
                  width: `${metrics && metrics.totalSelected > 0 ? (metrics.tcp.failed / metrics.totalSelected) * 100 : 0}%`
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
              <span className="text-emerald-400 font-semibold">{metrics?.tcp.passed || 0} Passed</span>
              <span className="text-rose-400">{metrics?.tcp.failed || 0} Failed</span>
            </div>
          </div>

          {/* Stage 2: Parallel Tunnel Verification */}
          <div className="p-4 rounded-xl bg-[#090e1a] border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">Stage 2 — Parallel Tunnel Canary</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                5 Isolated Ports
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ephemeral workers probe HTTP canary endpoints without touching active config.
            </p>
            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${metrics && metrics.tcp.passed > 0 ? (metrics.tunnel.passed / metrics.tcp.passed) * 100 : 0}%`
                }}
              />
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{
                  width: `${metrics && metrics.tcp.passed > 0 ? (metrics.tunnel.failed / metrics.tcp.passed) * 100 : 0}%`
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
              <span className="text-emerald-400 font-semibold">{metrics?.tunnel.passed || 0} Healthy</span>
              <span className="text-rose-400">{metrics?.tunnel.failed || 0} Failed</span>
            </div>
          </div>

          {/* Stage 3: Sequential OpenCode Verification */}
          <div className="p-4 rounded-xl bg-[#090e1a] border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">Stage 3 — OpenCode Verification</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30">
                Early Exit #1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ranked top tunnel tested using strictly approved free model. Stops on pass.
            </p>
            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-teal-400 transition-all duration-300"
                style={{ width: `${metrics && metrics.opencode.passed > 0 ? 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
              <span className="text-teal-400 font-semibold">
                {metrics?.opencode.passed ? '1 Verified Pass' : 'Pending Verification'}
              </span>
              <span className="text-slate-500 truncate max-w-[120px]">{selectedModel.split('/')[1] || selectedModel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ACTIVE CONNECTION PANEL (IF ACTIVE)
         ========================================================================= */}
      {activeConn && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0d1c28] to-[#0a1522] border border-emerald-500/40 p-6 shadow-2xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-extrabold text-white">
                    {country.flag} {activeConn.remark || activeConn.address}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${protoBadge.badgeClass}`}>
                    {protoBadge.label}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {activeConn.address}:{activeConn.port}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Active Locked
                  </span>
                </div>

                {/* Status Badges & Explanations */}
                <div className="flex items-center gap-3 flex-wrap text-xs pt-1">
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tunnel Healthy (HTTP GET 204 Verified)
                  </span>

                  {activeConn.reason?.toLowerCase().includes('quota') ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Tunnel Healthy / OpenCode Quota Exhausted
                    </span>
                  ) : activeConn.reason?.toLowerCase().includes('credential') || activeConn.reason?.toLowerCase().includes('auth') ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" />
                      OpenCode Auth Required (Tunnel Preserved)
                    </span>
                  ) : activeConn.reason?.toLowerCase().includes('verified working with opencode') || (activeConn.reason?.toLowerCase().includes('opencode') && !activeConn.reason?.toLowerCase().includes('canary')) ? (
                    <span className="inline-flex items-center gap-1.5 text-teal-300 font-bold bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      OpenCode Verified Session
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-cyan-300 font-semibold bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                      <Server className="w-3.5 h-3.5 text-cyan-400" />
                      Tunnel Canary Active (OpenCode Route Unconfirmed)
                    </span>
                  )}
                </div>

                <div className="pt-1.5 space-y-1">
                  <p className="text-[11px] text-slate-300 font-mono">
                    {activeConn.reason || 'Verified working connection'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Last Verified: {new Date(activeConn.connected_at).toLocaleString()} (UTC: {new Date(activeConn.connected_at).toISOString()})
                  </p>
                </div>
              </div>
            </div>

            {/* Latency & Actions */}
            <div className="flex items-center gap-6 self-end lg:self-center">
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  Verified Latency
                </span>
                <div className="text-2xl font-extrabold font-mono text-emerald-400">
                  {activeConn.latency_ms ? `${activeConn.latency_ms} ms` : 'Active'}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Egress: {activeConn.egress_ip || 'Tunneling'}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onTestCurrent}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition"
                >
                  Re-verify Now
                </button>
                <button
                  onClick={onDisconnectVpn}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          NETWORK PERFORMANCE CHARTS (ONLY REAL DATA)
         ========================================================================= */}
      <NetworkCharts
        history={history}
        pipelineMetrics={metrics}
        stats={status?.stats}
      />
    </div>
  );
};
