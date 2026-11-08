import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Extract country code and flag emoji from remark string or address
 */
export function extractCountry(remark?: string): { flag: string; name: string } {
  if (!remark) return { flag: '🌐', name: 'Global' };

  // Common country flag emojis
  const flagRegex = /([\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF])/;
  const match = remark.match(flagRegex);
  if (match) {
    return { flag: match[1], name: remark.replace(match[1], '').trim().slice(0, 24) };
  }

  // Country prefix keywords
  const lower = remark.toLowerCase();
  if (lower.includes('germany') || lower.includes('de') || lower.includes('frankfurt')) return { flag: '🇩🇪', name: 'Germany' };
  if (lower.includes('united states') || lower.includes('usa') || lower.includes('us')) return { flag: '🇺🇸', name: 'United States' };
  if (lower.includes('singapore') || lower.includes('sg')) return { flag: '🇸🇬', name: 'Singapore' };
  if (lower.includes('netherlands') || lower.includes('nl') || lower.includes('amsterdam')) return { flag: '🇳🇱', name: 'Netherlands' };
  if (lower.includes('france') || lower.includes('fr') || lower.includes('paris')) return { flag: '🇫🇷', name: 'France' };
  if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('london') || lower.includes('gb')) return { flag: '🇬🇧', name: 'United Kingdom' };
  if (lower.includes('japan') || lower.includes('jp') || lower.includes('tokyo')) return { flag: '🇯🇵', name: 'Japan' };
  if (lower.includes('hong kong') || lower.includes('hk')) return { flag: '🇭🇰', name: 'Hong Kong' };
  if (lower.includes('turkey') || lower.includes('tr') || lower.includes('istanbul')) return { flag: '🇹🇷', name: 'Turkey' };
  if (lower.includes('finland') || lower.includes('fi') || lower.includes('helsinki')) return { flag: '🇫🇮', name: 'Finland' };
  if (lower.includes('canada') || lower.includes('ca')) return { flag: '🇨🇦', name: 'Canada' };

  return { flag: '🌐', name: remark.slice(0, 24) };
}

/**
 * Format latency with appropriate color tier
 */
export function formatLatency(latencyMs?: number | null): { text: string; colorClass: string; badgeClass: string } {
  if (latencyMs === undefined || latencyMs === null || latencyMs < 0) {
    return { text: '--', colorClass: 'text-slate-500', badgeClass: 'bg-slate-800 text-slate-400 border-slate-700' };
  }
  if (latencyMs < 150) {
    return { text: `${latencyMs} ms`, colorClass: 'text-emerald-400 font-bold', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  }
  if (latencyMs < 400) {
    return { text: `${latencyMs} ms`, colorClass: 'text-cyan-400 font-semibold', badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
  }
  if (latencyMs < 800) {
    return { text: `${latencyMs} ms`, colorClass: 'text-amber-400', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  }
  return { text: `${latencyMs} ms`, colorClass: 'text-rose-400', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
}

/**
 * Format protocol badge
 */
export function getProtocolBadge(protocol: string): { label: string; badgeClass: string } {
  const p = (protocol || '').toLowerCase();
  switch (p) {
    case 'vless':
      return { label: 'VLESS', badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
    case 'vmess':
      return { label: 'VMESS', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    case 'trojan':
      return { label: 'TROJAN', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'ss':
    case 'shadowsocks':
      return { label: 'SHADOWSOCKS', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    default:
      return { label: (protocol || 'PROXY').toUpperCase(), badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

/**
 * Format timestamp nicely
 */
export function formatTimestamp(isoString?: string): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}
