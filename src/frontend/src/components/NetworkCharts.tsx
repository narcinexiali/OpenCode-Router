import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Activity, BarChart3, Clock, Layers } from 'lucide-react';
import { PipelineMetrics, SystemStatus } from '../types';
import { formatTimestamp } from '../utils/formatters';

export interface HistoryItem {
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

interface NetworkChartsProps {
  history: HistoryItem[];
  pipelineMetrics?: PipelineMetrics;
  stats?: SystemStatus['stats'];
}

export const NetworkCharts: React.FC<NetworkChartsProps> = ({
  history,
  pipelineMetrics,
  stats
}) => {
  // Filter history to items with valid latency
  const latencyData = (history || [])
    .filter((h) => h.latency_ms && h.latency_ms > 0)
    .slice(-12) // last 12 points
    .reverse()
    .map((h, i) => ({
      index: i + 1,
      time: formatTimestamp(h.timestamp),
      latency: h.latency_ms,
      remark: h.remark || `Node #${h.config_id}`,
      protocol: (h.protocol || 'PROXY').toUpperCase(),
      success: h.proxy_success === 1
    }));

  // Triage breakdown based on actual pipeline or database counts
  const triageData = pipelineMetrics && pipelineMetrics.totalSelected > 0
    ? [
        { name: 'TCP OK', count: pipelineMetrics.tcp.passed, fill: '#10b981' },
        { name: 'TCP Dead', count: pipelineMetrics.tcp.failed, fill: '#f43f5e' },
        { name: 'Tunnel OK', count: pipelineMetrics.tunnel.passed, fill: '#06b6d4' },
        { name: 'Tunnel Fail', count: pipelineMetrics.tunnel.failed, fill: '#f59e0b' },
        { name: 'Verified', count: pipelineMetrics.opencode.passed, fill: '#3b82f6' }
      ]
    : [
        { name: 'Working', count: stats?.workingCount || 0, fill: '#10b981' },
        { name: 'Failed', count: stats?.failedCount || 0, fill: '#f43f5e' },
        { name: 'Untested', count: Math.min(stats?.untestedCount || 0, 500), fill: '#64748b' }
      ];

  const hasLatencyData = latencyData.length > 0;
  const hasTriageData = triageData.some((d) => d.count > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1: Tunnel Latency History */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Verified Tunnel Latency History
              </h3>
              <p className="text-[11px] text-slate-400">
                Real HTTP canary response times across verified probes
              </p>
            </div>
          </div>
          {hasLatencyData && (
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {latencyData[latencyData.length - 1]?.latency} ms latest
            </span>
          )}
        </div>

        {hasLatencyData ? (
          <div className="h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                  unit="ms"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-[#090e1a] border border-slate-700 p-2.5 text-xs shadow-xl space-y-1">
                          <p className="font-semibold text-white truncate max-w-[200px]">{data.remark}</p>
                          <div className="flex items-center justify-between gap-4 font-mono">
                            <span className="text-slate-400">{data.time}</span>
                            <span className="text-emerald-400 font-bold">{data.latency} ms</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-cyan-400">{data.protocol}</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#latencyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-52 w-full flex flex-col items-center justify-center rounded-xl bg-slate-950/40 border border-slate-800/60 p-6 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-semibold text-slate-300">
              No historical latency probes recorded yet
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Live measurements will populate automatically as candidate tunnels are verified.
            </p>
          </div>
        )}
      </div>

      {/* Chart 2: Pipeline Screening / Triage Breakdown */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Candidate Screening Distribution
              </h3>
              <p className="text-[11px] text-slate-400">
                {pipelineMetrics && pipelineMetrics.totalSelected > 0
                  ? 'Real-time 3-stage candidate pass/fail evaluation'
                  : 'Database node operational status breakdown'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {stats?.totalConfigs || 0} Total Cached
          </span>
        </div>

        {hasTriageData ? (
          <div className="h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={triageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-[#090e1a] border border-slate-700 p-2.5 text-xs shadow-xl font-mono">
                          <span className="text-slate-400">{data.name}:</span>{' '}
                          <span className="text-white font-bold">{data.count} candidates</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {triageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-52 w-full flex flex-col items-center justify-center rounded-xl bg-slate-950/40 border border-slate-800/60 p-6 text-center space-y-2">
            <Layers className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-semibold text-slate-300">
              No screening data available
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Execute "Find Working Connection" to start multi-stage screening.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
