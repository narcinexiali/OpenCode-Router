import React, { useState, useEffect } from 'react';
import { Database, Plus, RefreshCw, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SourceItem } from '../types';

interface SourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({ isOpen, onClose }) => {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch {
      toast.error('Failed to fetch node sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchSources();
  }, [isOpen]);

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
        toast.success(`Source "${newName}" added`);
        setNewName('');
        setNewUrl('');
        fetchSources();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add source');
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleRefreshSource = async (id: number) => {
    setRefreshingId(id);
    const tid = toast.loading('Syncing source configurations from GitHub...');
    try {
      const res = await fetch(`/api/sources/${id}/refresh`, { method: 'POST' });
      const data = await res.json();
      const s = data.summary;
      toast.success(`Source synced! +${s.newImported} new, ${s.duplicates} duplicates`, { id: tid });
      fetchSources();
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`, { id: tid });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDeleteSource = async (id: number, name: string) => {
    if (!window.confirm(`Delete source "${name}"?`)) return;
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      toast.success(`Removed source "${name}"`);
      fetchSources();
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#0d1422] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">GitHub Node Subscriptions</h2>
              <p className="text-xs text-slate-400">Manage automated GitHub upstream repository sources for V2Ray/Xray nodes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Source Input */}
        <form onSubmit={handleAddSource} className="space-y-3 bg-[#080d19] p-4 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Add Upstream Subscription</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              placeholder="Friendly Name (e.g. Daily-Free-Nodes)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#0d1422] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="url"
              placeholder="https://raw.githubusercontent.com/..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="bg-[#0d1422] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newName.trim() || !newUrl.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Source
            </button>
          </div>
        </form>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3.5 rounded-xl bg-[#080d19] border border-slate-800 hover:border-slate-700 transition"
            >
              <div className="min-w-0 flex-1 mr-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white truncate">{s.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {s.config_count || 0} nodes
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{s.url}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleRefreshSource(s.id)}
                  disabled={refreshingId === s.id}
                  title="Sync this source now"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === s.id ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
                <button
                  onClick={() => handleDeleteSource(s.id, s.name)}
                  title="Delete source"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {sources.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">No subscription sources added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
