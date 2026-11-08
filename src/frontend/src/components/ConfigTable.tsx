import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  Globe,
  Radio,
  FileCode,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { CandidateItem } from '../types';
import { extractCountry, formatLatency, getProtocolBadge } from '../utils/formatters';

interface ConfigTableProps {
  onRefreshSources: () => void;
  onImportConfigs: (text: string) => void;
  onOpenSources: () => void;
}

const initialSampleItems: CandidateItem[] = [
  {
    id: 5272,
    protocol: 'vless',
    address: '127.0.0.1',
    port: 19988,
    remark: 'Mock_Working_Scenario_A',
    security: 'tls',
    network: 'tcp',
    last_latency_ms: 14,
    last_status: 'working',
    consecutive_failures: 0,
    success_count: 18,
    is_active: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 456,
    protocol: 'vless',
    address: '198.51.100.15',
    port: 8445,
    remark: '🇩🇪 Frankfurt Fast-Track Node',
    security: 'reality',
    network: 'tcp',
    last_latency_ms: 187,
    last_status: 'working',
    consecutive_failures: 0,
    success_count: 12,
    is_active: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 112,
    protocol: 'trojan',
    address: '192.0.2.88',
    port: 443,
    remark: '🇳🇱 Amsterdam Cloud Router',
    security: 'tls',
    network: 'ws',
    last_latency_ms: 224,
    last_status: 'working',
    consecutive_failures: 0,
    success_count: 5,
    is_active: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 89,
    protocol: 'vmess',
    address: '198.51.100.72',
    port: 443,
    remark: '🇫🇷 Paris Low-Ping Egress',
    security: 'tls',
    network: 'ws',
    last_latency_ms: 251,
    last_status: 'working',
    consecutive_failures: 0,
    success_count: 8,
    is_active: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 310,
    protocol: 'ss',
    address: '203.0.113.24',
    port: 8388,
    remark: '🇬🇧 London Edge Proxy',
    security: 'aes-256-gcm',
    network: 'tcp',
    last_latency_ms: 480,
    last_status: 'failed',
    consecutive_failures: 2,
    success_count: 1,
    is_active: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 504,
    protocol: 'vless',
    address: '192.0.2.77',
    port: 443,
    remark: '🇺🇸 Ashburn High-Speed Node',
    security: 'reality',
    network: 'grpc',
    last_latency_ms: undefined,
    last_status: 'untested',
    consecutive_failures: 0,
    success_count: 0,
    is_active: 0,
    created_at: new Date().toISOString()
  }
];

export const ConfigTable: React.FC<ConfigTableProps> = ({
  onRefreshSources,
  onImportConfigs,
  onOpenSources
}) => {
  const [items, setItems] = useState<CandidateItem[]>(initialSampleItems);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [protocolFilter, setProtocolFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [testingId, setTestingId] = useState<number | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        protocol: protocolFilter,
        status: statusFilter,
        search: searchQuery
      });
      const res = await fetch(`/api/configs?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load proxy configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [page, protocolFilter, statusFilter, searchQuery]);

  const handleManualTest = async (id: number, remark: string) => {
    setTestingId(id);
    const toastId = toast.loading(`Probing ${remark || `node #${id}`}...`);
    try {
      const res = await fetch('/api/configs/test-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Node #${id} passed full OpenCode verification!`, { id: toastId });
      } else if (result.proxyTest?.success) {
        toast.info(`Node #${id} healthy proxy tunnel (Canary OK). OpenCode prompt note: ${result.opencodeTest?.userMessage || 'Checked'}`, { id: toastId });
      } else {
        toast.error(`Node #${id} failed: ${result.error || result.step || 'Unreachable'}`, { id: toastId });
      }
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`, { id: toastId });
    } finally {
      setTestingId(null);
    }
  };

  const handleActivate = async (id: number, remark: string) => {
    setActivatingId(id);
    const toastId = toast.loading(`Activating ${remark || `node #${id}`}...`);
    try {
      const res = await fetch(`/api/configs/${id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Active connection locked: ${remark || `Node #${id}`}`, { id: toastId });
        fetchConfigs();
      } else {
        toast.error(data.error || 'Failed to activate proxy', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Activation error: ${err.message}`, { id: toastId });
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async (id: number, remark: string) => {
    if (!window.confirm(`Delete proxy "${remark || `#${id}`}"?`)) return;
    try {
      await fetch(`/api/configs/${id}`, { method: 'DELETE' });
      toast.success('Configuration deleted');
      fetchConfigs();
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    onImportConfigs(importText);
    setImportText('');
    setShowImportModal(false);
    toast.success('Configurations submitted for parsing');
    setTimeout(fetchConfigs, 600);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-4 md:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Search & Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search remarks, endpoints..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Protocol Filter */}
          <select
            value={protocolFilter}
            onChange={(e) => {
              setProtocolFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
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
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="working">Working</option>
            <option value="failed">Failed</option>
            <option value="untested">Untested</option>
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Import Configs
          </button>

          <button
            onClick={onOpenSources}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold transition"
          >
            <Layers className="w-3.5 h-3.5" />
            Sources
          </button>

          <button
            onClick={onRefreshSources}
            title="Refresh All Sources from GitHub"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Configurations Table */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070b14]/90 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Remark / Server</th>
                <th className="py-3 px-3">Protocol</th>
                <th className="py-3 px-3">Endpoint</th>
                <th className="py-3 px-3">Security & Net</th>
                <th className="py-3 px-3">Verified Latency</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Loading cached configurations...</span>
                      </div>
                    ) : (
                      'No configurations found matching current filters.'
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const country = extractCountry(item.remark);
                  const protoBadge = getProtocolBadge(item.protocol);
                  const lat = formatLatency(item.last_latency_ms);
                  const isItemTesting = testingId === item.id;
                  const isItemActivating = activatingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        item.is_active
                          ? 'bg-emerald-500/15 border-l-4 border-l-emerald-400'
                          : item.last_status === 'working'
                          ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Remark */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2 max-w-[240px]">
                          <span className="text-base">{country.flag}</span>
                          <span className="font-semibold text-white truncate" title={item.remark}>
                            {item.remark || `Node #${item.id}`}
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
                        <span>{item.address}:{item.port}</span>
                      </td>

                      {/* Security & Net */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <span>{item.security || 'none'} / {item.network || 'tcp'}</span>
                      </td>

                      {/* Latency */}
                      <td className="py-3 px-3">
                        <span className={lat.colorClass}>{lat.text}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 font-sans">
                        {item.is_active === 1 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Active Locked
                          </span>
                        ) : item.last_status === 'working' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            Working
                          </span>
                        ) : item.last_status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-xs">
                            <XCircle className="w-3 h-3" />
                            Failed ({item.consecutive_failures || 1})
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Untested</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Single */}
                          <button
                            onClick={() => handleManualTest(item.id, item.remark)}
                            disabled={isItemTesting}
                            title="Test this node with OpenCode probe"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700/60 transition disabled:opacity-50"
                          >
                            <Play className={`w-3.5 h-3.5 ${isItemTesting ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Activate */}
                          {item.is_active !== 1 && (
                            <button
                              onClick={() => handleActivate(item.id, item.remark)}
                              disabled={isItemActivating}
                              title="Lock as active proxy"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition disabled:opacity-50"
                            >
                              <Zap className={`w-3.5 h-3.5 ${isItemActivating ? 'animate-spin' : ''}`} />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(item.id, item.remark)}
                            title="Delete configuration"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-[#090e1a]/80">
          <div>
            Showing Page <span className="font-bold text-white">{page}</span> of{' '}
            <span className="font-bold text-white">{totalPages}</span> ({totalCount} total configs)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Import Configurations Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0d1422] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Import Proxy Configurations</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">
                Paste raw V2Ray/Xray URLs (one per line) or base64-encoded subscription payload.
                Supported protocols: <code className="text-cyan-300">vless://</code>,{' '}
                <code className="text-purple-300">vmess://</code>,{' '}
                <code className="text-amber-300">trojan://</code>,{' '}
                <code className="text-emerald-300">ss://</code>
              </p>

              <textarea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="vless://...\nvmess://...\ntrojan://...\nss://..."
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importText.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  Import Nodes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
