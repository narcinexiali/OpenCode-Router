import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Lock,
  Cpu,
  Layers,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  Database,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Sliders,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import { SystemStatus, SourceItem } from '../types';

interface SettingsPanelProps {
  status: SystemStatus | null;
  onUpdateSetting: (key: string, value: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  status,
  onUpdateSetting
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');

  const [scanLimit, setScanLimit] = useState<string>(
    String(status?.scanCandidateLimit || '100')
  );
  const [socksPort, setSocksPort] = useState<string>(status?.socksPort || '10808');
  const [httpPort, setHttpPort] = useState<string>(status?.httpPort || '10809');
  const [selectedModel, setSelectedModel] = useState<string>(
    status?.verificationModel || 'opencode/deepseek-v4.1-flash-free'
  );

  const fetchSources = async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch {
      toast.error('Failed to load subscription sources');
    } finally {
      setSourcesLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const copyLauncher = () => {
    navigator.clipboard.writeText('opencode-vpn');
    setCopied(true);
    toast.success('Copied launcher command: opencode-vpn');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveScanLimit = (val: string) => {
    setScanLimit(val);
    onUpdateSetting('scan_candidate_limit', val);
    toast.success(`Default scan limit set to ${val}`);
  };

  const handleSaveModel = (val: string) => {
    setSelectedModel(val);
    onUpdateSetting('opencode_verification_model', val);
    toast.success(`Verification model set to ${val}`);
  };

  const handleSavePorts = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSetting('socks_port', socksPort);
    onUpdateSetting('http_port', httpPort);
    toast.success('Proxy listening ports updated (takes effect on next proxy start)');
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, url: newUrl })
      });
      if (res.ok) {
        toast.success(`Added source "${newName}"`);
        setNewName('');
        setNewUrl('');
        fetchSources();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to add source');
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDeleteSource = async (id: number, name: string) => {
    if (!window.confirm(`Delete source "${name}"?`)) return;
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      toast.success(`Deleted source "${name}"`);
      fetchSources();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const handleRefreshSource = async (id: number) => {
    const tid = toast.loading('Fetching source updates from GitHub...');
    try {
      const res = await fetch(`/api/sources/${id}/refresh`, { method: 'POST' });
      const data = await res.json();
      const s = data.summary;
      toast.success(`Source refreshed! +${s.newImported} imported, ${s.duplicates} duplicates`, { id: tid });
      fetchSources();
    } catch (err: any) {
      toast.error(`Refresh error: ${err.message}`, { id: tid });
    }
  };

  const approvedModels = status?.approvedFreeModels || [
    'opencode/deepseek-v4.1-flash-free',
    'opencode/gemini-2.5-flash-free',
    'opencode/llama-3.3-70b-instruct-free',
    'opencode/mistral-large-free',
    'opencode/qwen-2.5-coder-32b-free'
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Console Preferences & Node Settings
            </h2>
            <p className="text-xs text-slate-400">
              Configure network listening ports, automated pipeline scan limits, and approved OpenCode model allowlists
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column 1: Network & Pipeline Preferences */}
        <div className="space-y-6">
          {/* Card: Verification Model Allowlist */}
          <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Automated Verification Model Allowlist
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Automated proxy verification strictly uses only free-tier OpenCode models.
              Third-party and paid providers (such as Wisdomise LiteLLM) are blocked with zero credit consumption.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Active Verification Model:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleSaveModel(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {approvedModels.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-slate-200">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Strict Allowlist Guard Enforced: Never falls back to default or paid models.</span>
            </div>
          </div>

          {/* Card: Default Candidate Scan Limit */}
          <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Default Candidate Scan Limit
              </h3>
            </div>

            <p className="text-xs text-slate-400">
              Number of deduplicated candidate nodes evaluated when "Find Working Connection" is triggered without explicit override:
            </p>

            <div className="grid grid-cols-4 gap-2">
              {['100', '250', '500', 'all'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSaveScanLimit(opt)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold transition ${
                    scanLimit === opt
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt === 'all' ? 'All (Full Pool)' : `${opt} Nodes`}
                </button>
              ))}
            </div>
          </div>

          {/* Card: Dedicated OpenCode VPN Launcher */}
          <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Terminal className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Dedicated OpenCode VPN Launcher
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              OpenCode Router operates strictly in user-space without altering system-wide network routing.
              To run OpenCode CLI through the active locked proxy tunnel, execute:
            </p>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#070b14] border border-slate-800 font-mono text-xs">
              <span className="text-emerald-400 font-bold">$ opencode-vpn</span>
              <button
                onClick={copyLauncher}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column 2: Sources Management */}
        <div className="space-y-6">
          {/* Card: GitHub Subscription Sources */}
          <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Node Subscription Sources ({sources.length})
                </h3>
              </div>
              <button
                onClick={fetchSources}
                title="Refresh Sources List"
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sourcesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Add Source Form */}
            <form onSubmit={handleAddSource} className="space-y-2.5 bg-[#090e1a] p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Add GitHub Subscription Source
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Source Name (e.g. Free-V2Ray)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-[#070b14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="url"
                  placeholder="https://raw.githubusercontent.com/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="bg-[#070b14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newName.trim() || !newUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Source
                </button>
              </div>
            </form>

            {/* Sources List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#090e1a] border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white truncate">{s.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {s.config_count || 0} nodes
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 truncate max-w-sm">{s.url}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRefreshSource(s.id)}
                      title="Fetch updates now"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSource(s.id, s.name)}
                      title="Remove source"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Zero-Root Privilege Architecture */}
          <div className="rounded-2xl bg-[#0d1422] border border-slate-800/80 p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Security Architecture & Zero Root Guarantee
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              OpenCode Router operates entirely in user-space as an unprivileged process. It runs on high loopback ports (<code className="text-cyan-300 font-mono">10808/10809</code>) and will <strong>never request your Ubuntu root password</strong>.
            </p>

            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Sensitive configuration files enforced with permission mode <code className="text-emerald-300 font-mono">0600</code>.</li>
              <li>Network binding defaults strictly to IPv4 loopback (<code className="text-cyan-300 font-mono">127.0.0.1</code>).</li>
              <li>Non-loopback binding requires mandatory Bearer API token authentication.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
