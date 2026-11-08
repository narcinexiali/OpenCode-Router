import { db } from '../db/database';

export interface RankedConfigRow {
  id: number;
  protocol: string;
  address: string;
  port: number;
  remark: string;
  security: string;
  network: string;
  details_json: string;
  last_status: string;
  last_latency_ms: number | null;
  consecutive_failures: number;
  success_count: number;
  score: number;
}

export class CandidateRanker {
  /**
   * Get sorted and deduplicated candidate configurations ready for testing.
   * Supports fixed limit (100, 250, 500), custom limits, or 'all'.
   */
  public static getRankedCandidates(limit: number | 'all' = 100): RankedConfigRow[] {
    const isAll = limit === 'all' || limit <= 0;
    const query = `
      SELECT
        id, protocol, address, port, remark, security, network, details_json,
        last_status, last_latency_ms, consecutive_failures, success_count
      FROM configs
      WHERE consecutive_failures < 5
      ORDER BY
        CASE
          WHEN last_status = 'working' THEN 1
          WHEN last_status = 'untested' THEN 2
          ELSE 3
        END,
        consecutive_failures ASC,
        success_count DESC,
        CASE
          WHEN protocol = 'vless' AND security = 'reality' THEN 1
          WHEN protocol = 'vless' THEN 2
          WHEN protocol = 'trojan' THEN 3
          WHEN protocol = 'ss' THEN 4
          ELSE 5
        END,
        CASE WHEN last_latency_ms IS NOT NULL AND last_latency_ms > 0 THEN last_latency_ms ELSE 9999 END ASC,
        id ASC
      ${isAll ? '' : 'LIMIT ?'}
    `;

    const rows = (isAll
      ? db.prepare(query).all()
      : db.prepare(query).all((limit as number) * 3)) as any[];

    // Calculate smart score
    const scored: RankedConfigRow[] = rows.map((r) => {
      let score = 100;

      // Bonus for currently verified working status
      if (r.last_status === 'working') score += 50;

      // Bonus for past success
      score += r.success_count * 50;

      // Penalty for consecutive failures
      score -= r.consecutive_failures * 30;

      // Bonus for VLESS Reality/TLS and lightweight Shadowsocks
      if (r.protocol === 'ss') score += 25;
      if (r.protocol === 'vless') score += 20;
      if (r.security === 'reality') score += 15;
      if (r.protocol === 'trojan') score += 10;

      // Latency factor
      if (r.last_latency_ms && r.last_latency_ms > 0) {
        if (r.last_latency_ms < 150) score += 25;
        else if (r.last_latency_ms < 300) score += 10;
        else if (r.last_latency_ms > 800) score -= 20;
      }

      return {
        ...r,
        score
      };
    });

    // Deduplicate by normalized address:port, keeping the highest scoring config
    const seenEndpoints = new Set<string>();
    const deduplicated: RankedConfigRow[] = [];

    // Sort descending by score first so deduplication preserves highest quality config
    scored.sort((a, b) => b.score - a.score);

    for (const item of scored) {
      const endpointKey = `${item.address.toLowerCase().trim()}:${item.port}`;
      if (!seenEndpoints.has(endpointKey)) {
        seenEndpoints.add(endpointKey);
        deduplicated.push(item);
      }
    }

    if (isAll) {
      return deduplicated;
    }

    return deduplicated.slice(0, limit as number);
  }
}
