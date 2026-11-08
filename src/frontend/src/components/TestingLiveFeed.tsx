import React, { useState, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  ShieldCheck,
  Server,
  ArrowUpDown
} from 'lucide-react';
import { extractCountry, formatLatency, getProtocolBadge } from '../utils/formatters';

export interface LiveCandidateLog {
  id: number;
  protocol: string;
  address: string;
  port: number;
  remark: string;
  security: string;
  latencyMs?: number;
  tcpLatencyMs?: number;
  tunnelLatencyMs?: number;
  status:
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
  error?: string;
  timestamp: string;
}

interface TestingLiveFeedProps {
  logs: LiveCandidateLog[];
  isTesting: boolean;
  currentMessage: string;
  activeConnectionId?: number;
}

export const TestingLiveFeed: React.FC<TestingLiveFeedProps> = ({
  logs,
  isTesting,
  currentMessage,
  activeConnectionId
}) => {
  const [search, setSearch] = useState<string>('');
  const [protocolFilter, setProtocolFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField] = useState<'time' | 'tcpLatency' | 'tunnelLatency' | 'remark'>('time');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Toggle sort
  const handleSort = (field: 'time' | 'tcpLatency' | 'tunnelLatency' | 'remark') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) => l.remark.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
      );
    }

    // Protocol filter
    if (protocolFilter) {
      result = result.filter((l) => l.protocol.toLowerCase() === protocolFilter.toLowerCase());
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((l) => {
        if (statusFilter === 'verified') return l.status === 'opencode_verified' || l.status === 'working';
        if (statusFilter === 'tunnel_healthy') return l.status === 'tunnel_healthy';
        if (statusFilter === 'failed') return l.status.includes('failed');
        if (statusFilter === 'quota') return l.status.includes('quota') || l.status === 'rate_limited';
        if (statusFilter === 'testing') return l.status.includes('checking') || l.status.includes('testing');
        return l.status === statusFilter;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'tcpLatency') {
        comparison = (a.tcpLatencyMs || 9999) - (b.tcpLatencyMs || 9999);
      } else if (sortField === 'tunnelLatency') {
        const latA = a.tunnelLatencyMs || a.latencyMs || 9999;
        const latB = b.tunnelLatencyMs || b.latencyMs || 9999;
        comparison = latA - latB;
      } else if (sortField === 'remark') {
        comparison = a.remark.localeCompare(b.remark);
      } else {
        // default: time (order in list)
        comparison = 0;
      }
      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [logs, search, protocolFilter, statusFilter, sortField, sortAsc]);

  if (logs.length === 0 && !isTesting) {
    return (
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-8 text-center space-y-3">
        <Activity className="w-10 h-10 text-slate-600 mx-auto" />
        <h3 className="text-sm font-bold text-slate-200">Live Monitor Standby</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No live screening active. Trigger "Find Working Connection" on the Dashboard to stream real-time candidate evaluations.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 overflow-hidden shadow-2xl space-y-0">
      {/* Table Header Controls */}
      <div className="p-4 md:p-5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#090e1a]/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Live Candidate Screening & Verification Feed
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {filteredLogs.length} events
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {currentMessage || 'Evaluating candidates across 3-stage screening pipeline'}
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter remarks, IPs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#070b14] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Protocol Filter */}
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="bg-[#070b14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Protocols</option>
            <option value="vless">VLESS</option>
            <option value="vmess">VMess</option>
            <option value="trojan">Trojan</option>
            <option value="ss">Shadowsocks</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#070b14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="verified">Verified Working</option>
            <option value="tunnel_healthy">Tunnel Healthy</option>
            <option value="testing">Testing / Checking</option>
            <option value="quota">Quota Exhausted</option>
            <option value="failed">Failed / Dead</option>
          </select>

          {isTesting && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Scanning</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#070b14]/90 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th
                onClick={() => handleSort('remark')}
                className="py-3 px-4 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>Candidate / Node</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-3">Protocol</th>
              <th className="py-3 px-3">Endpoint</th>
              <th
                onClick={() => handleSort('tcpLatency')}
                className="py-3 px-3 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>Stage 1 TCP</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('tunnelLatency')}
                className="py-3 px-3 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>Stage 2 Canary</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4">Verification Stage & Status</th>
              <th
                onClick={() => handleSort('time')}
                className="py-3 px-4 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>Time</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-3 text-right">Details</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredLogs.map((item, idx) => {
              const rowKey = `${item.id}-${idx}`;
              const isExpanded = expandedId === rowKey;
              const isWorking = item.status === 'opencode_verified' || item.status === 'working';
              const isTunnelHealthy = item.status === 'tunnel_healthy';
              const isChecking = item.status.includes('checking') || item.status.includes('testing');
              const isFailed = item.status.includes('failed');
              const isActiveLocked = activeConnectionId === item.id || item.status === 'active_locked';

              const country = extractCountry(item.remark);
              const protoBadge = getProtocolBadge(item.protocol);
              const tcpLat = formatLatency(item.tcpLatencyMs);
              const tunnelLat = formatLatency(item.tunnelLatencyMs || item.latencyMs);

              return (
                <React.Fragment key={rowKey}>
                  <tr
                    className={`transition-colors group ${
                      isActiveLocked
                        ? 'bg-emerald-500/15 border-l-4 border-l-emerald-400'
                        : isWorking
                        ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                        : isTunnelHealthy
                        ? 'bg-cyan-500/5'
                        : isChecking
                        ? 'bg-amber-500/5'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Node Remark */}
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center gap-2 max-w-[240px]">
                        <span className="text-base">{country.flag}</span>
                        <span className="font-semibold text-slate-200 truncate" title={item.remark}>
                          {item.remark}
                        </span>
                      </div>
                    </td>

                    {/* Protocol */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${protoBadge.badgeClass}`}>
                        {protoBadge.label}
                      </span>
                    </td>

                    {/* Endpoint */}
                    <td className="py-3 px-3 text-slate-400">
                      <span className="font-mono text-xs">{item.address}:{item.port}</span>
                    </td>

                    {/* TCP Latency */}
                    <td className="py-3 px-3">
                      <span className={tcpLat.colorClass}>{tcpLat.text}</span>
                    </td>

                    {/* Tunnel Latency */}
                    <td className="py-3 px-3">
                      <span className={tunnelLat.colorClass}>{tunnelLat.text}</span>
                    </td>

                    {/* Verification Status Badges */}
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.status === 'tcp_checking' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            TCP Checking
                          </span>
                        )}

                        {item.status === 'tcp_failed' && (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium" title={item.error}>
                            <XCircle className="w-3.5 h-3.5" />
                            TCP Unreachable
                          </span>
                        )}

                        {item.status === 'tunnel_checking' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Tunnel Probing
                          </span>
                        )}

                        {item.status === 'tunnel_failed' && (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium" title={item.error}>
                            <XCircle className="w-3.5 h-3.5" />
                            Tunnel Failed
                          </span>
                        )}

                        {item.status === 'tunnel_healthy' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tunnel Healthy
                          </span>
                        )}

                        {item.status === 'opencode_testing' && (
                          <span className="inline-flex items-center gap-1 text-cyan-400 font-medium">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            OpenCode Testing
                          </span>
                        )}

                        {isWorking && (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-extrabold bg-emerald-500/20 px-2.5 py-0.5 rounded border border-emerald-500/40">
                            <Zap className="w-3.5 h-3.5 fill-current text-emerald-400" />
                            OpenCode Verified
                          </span>
                        )}

                        {item.status === 'opencode_quota' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20" title={item.error}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Quota Exhausted
                          </span>
                        )}

                        {item.status === 'opencode_auth_error' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20" title={item.error}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Auth Required
                          </span>
                        )}

                        {isActiveLocked && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Active Locked
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {item.timestamp}
                    </td>

                    {/* Expand Details Trigger */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* Expandable Details Drawer */}
                  {isExpanded && (
                    <tr className="bg-[#070c17] text-slate-300">
                      <td colSpan={8} className="p-4 border-b border-slate-800 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px] uppercase">Node Address & Port</span>
                            <span className="font-mono text-white">{item.address}:{item.port}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px] uppercase">Security & Transport</span>
                            <span className="font-mono text-white">{item.security || 'none'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px] uppercase">Candidate ID</span>
                            <span className="font-mono text-white">#{item.id}</span>
                          </div>
                        </div>

                        {item.error && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                            <span className="font-bold">Failure Details: </span>
                            {item.error}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
