import React, { useState, useEffect } from 'react';
import {
  History,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import { extractCountry, formatLatency, getProtocolBadge, formatTimestamp } from '../utils/formatters';

interface HistoryRecord {
  id: number;
  config_id: number;
  timestamp: string;
  latency_ms: number;
  proxy_success: number;
  opencode_success: number;
  error_category?: string;
  error_message?: string;
  remark?: string;
  protocol?: string;
  address?: string;
  port?: number;
}

const initialSampleHistory: HistoryRecord[] = [
  {
    id: 1,
    config_id: 5272,
    timestamp: new Date().toISOString(),
    latency_ms: 14,
    proxy_success: 1,
    opencode_success: 1,
    remark: 'Mock_Working_Scenario_A',
    protocol: 'vless',
    address: '127.0.0.1',
    port: 19988
  },
  {
    id: 2,
    config_id: 456,
    timestamp: new Date(Date.now() - 60000).toISOString(),
    latency_ms: 187,
    proxy_success: 1,
    opencode_success: 1,
    remark: '🇩🇪 Frankfurt Fast-Track Node',
    protocol: 'vless',
    address: '198.51.100.15',
    port: 8445
  },
  {
    id: 3,
    config_id: 112,
    timestamp: new Date(Date.now() - 120000).toISOString(),
    latency_ms: 224,
    proxy_success: 1,
    opencode_success: 1,
    remark: '🇳🇱 Amsterdam Cloud Router',
    protocol: 'trojan',
    address: '192.0.2.88',
    port: 443
  },
  {
    id: 4,
    config_id: 310,
    timestamp: new Date(Date.now() - 180000).toISOString(),
    latency_ms: 480,
    proxy_success: 0,
    opencode_success: 0,
    error_category: 'PROXY_CONNECTIVITY_FAILED',
    error_message: 'TCP Handshake Timeout (1500ms)',
    remark: '🇬🇧 London Edge Proxy',
    protocol: 'ss',
    address: '203.0.113.24',
    port: 8388
  }
];

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<HistoryRecord[]>(initialSampleHistory);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const data = await res.json();
      setLogs(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = logs.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.remark || '').toLowerCase().includes(q) ||
      (item.address || '').toLowerCase().includes(q) ||
      (item.error_category || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Audit & Verification History Log
            </h2>
            <p className="text-xs text-slate-400">
              Persistent record of all verified tunnel probes, response times, and OpenCode prompt evaluations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search history records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070b14]/90 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Candidate Node</th>
                <th className="py-3 px-3">Protocol</th>
                <th className="py-3 px-3">Endpoint</th>
                <th className="py-3 px-3">Latency</th>
                <th className="py-3 px-4">Proxy Tunnel</th>
                <th className="py-3 px-4">OpenCode Verification</th>
                <th className="py-3 px-4">Classification Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        <span>Loading audit history records...</span>
                      </div>
                    ) : (
                      'No past verification audit events recorded yet.'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const country = extractCountry(item.remark);
                  const protoBadge = getProtocolBadge(item.protocol || '');
                  const lat = formatLatency(item.latency_ms);

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {formatTimestamp(item.timestamp)}
                      </td>

                      {/* Candidate */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2 max-w-[220px]">
                          <span className="text-base">{country.flag}</span>
                          <span className="font-semibold text-white truncate" title={item.remark}>
                            {item.remark || `Node #${item.config_id}`}
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
                      <td className="py-3 px-3 text-slate-300">
                        <span>{item.address}:{item.port || '--'}</span>
                      </td>

                      {/* Latency */}
                      <td className="py-3 px-3">
                        <span className={lat.colorClass}>{lat.text}</span>
                      </td>

                      {/* Proxy Tunnel */}
                      <td className="py-3 px-4 font-sans">
                        {item.proxy_success === 1 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Canary OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* OpenCode Verification */}
                      <td className="py-3 px-4 font-sans">
                        {item.opencode_success === 1 ? (
                          <span className="inline-flex items-center gap-1 text-teal-300 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                            Verified Session
                          </span>
                        ) : item.error_category === 'RATE_LIMIT' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Quota Exhausted
                          </span>
                        ) : item.error_category === 'AUTH_ERROR' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Auth Required
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Unverified</span>
                        )}
                      </td>

                      {/* Error / Category */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate" title={item.error_message || item.error_category}>
                        {item.error_message || item.error_category || '--'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
