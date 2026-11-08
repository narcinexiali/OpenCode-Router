import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Copy, Check, Terminal, Info, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface PrivilegeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivilegeSetupModal: React.FC<PrivilegeSetupModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/diagnostics')
        .then((r) => r.json())
        .then((d) => setData(d.privilege))
        .catch(console.error);
    }
  }, [isOpen]);

  const copyScript = () => {
    navigator.clipboard.writeText('./scripts/setup-privileges.sh');
    setCopied(true);
    toast.success('Copied: ./scripts/setup-privileges.sh');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#0d1422] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Privilege & Security Architecture</h2>
              <p className="text-xs text-slate-400">Strict least-privilege guarantees and user-space isolation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Status highlight */}
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Check className="w-4 h-4" />
              Local Proxy Mode: Zero Root Required
            </div>
            <p className="text-slate-300 leading-relaxed">
              The primary proxy engine runs entirely in user-space as an unprivileged process binding to high ports (<code className="text-emerald-300 font-mono">10808/10809</code>).
              It will <strong>never request your Ubuntu root password</strong> during normal operation or node rotation.
            </p>
          </div>

          {/* Principle of least privilege */}
          <div className="space-y-2 text-slate-300">
            <h4 className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5 tracking-wider">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              Security Principles Enforced
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400">
              <li>Never stores passwords in plaintext.</li>
              <li>Never grants unrestricted passwordless sudo to node or user.</li>
              <li>Leaves IDEs, SSH sessions, browsers, and system traffic completely untouched.</li>
              <li>Only OpenCode receives proxy injection via <code className="text-cyan-300 font-mono">opencode-vpn</code>.</li>
              <li>Sensitive configuration files protected with mode <code className="text-emerald-300 font-mono">0600</code>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
