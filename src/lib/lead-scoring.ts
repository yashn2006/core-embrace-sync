import type { Lead } from "./leads";

export type HeatLevel = "hot" | "warm" | "cold";

export interface LeadScore {
  score: number; // 0-100
  heat: HeatLevel;
  reasons: string[];
}

/**
 * Deterministic heuristic score for a lead — no ML, no server call.
 * Factors: deal value, stage momentum, progress, custom status,
 * follow-up due, and recency of updates.
 */
export function scoreLead(lead: Lead): LeadScore {
  const reasons: string[] = [];
  let score = 0;

  // Deal value (max 25)
  const v = Number(lead.deal_value ?? 0);
  if (v >= 100000) { score += 25; reasons.push("High-value deal"); }
  else if (v >= 25000) { score += 15; reasons.push("Mid-value deal"); }
  else if (v > 0) { score += 8; }

  // Stage (max 30)
  const stageWeights: Record<string, number> = {
    new: 6, contacted: 12, qualified: 20, proposal: 26, negotiation: 30, won: 30, lost: 0,
  };
  score += stageWeights[lead.stage as string] ?? 5;
  if ((lead.stage as string) === "negotiation" || (lead.stage as string) === "proposal") {
    reasons.push("Late-stage momentum");
  }

  // Progress (max 20)
  const p = Number((lead as unknown as { progress?: number }).progress ?? 0);
  score += Math.round((p / 100) * 20);
  if (p >= 70) reasons.push(`${p}% complete`);

  // Custom status signal (max 10)
  const cs = ((lead as unknown as { custom_status?: string | null }).custom_status ?? "").toLowerCase();
  if (cs) {
    if (/(process|progress|under|working|ongoing)/.test(cs)) { score += 10; reasons.push("Actively worked"); }
    else if (/(hold|wait|stuck)/.test(cs)) { score -= 5; }
    else score += 4;
  }

  // Follow-up urgency (max 10)
  const nfu = (lead as unknown as { next_follow_up?: string | null }).next_follow_up;
  if (nfu) {
    const due = new Date(nfu).getTime();
    const now = Date.now();
    if (due < now) { score += 10; reasons.push("Follow-up overdue"); }
    else if (due - now < 24 * 3600 * 1000) { score += 7; reasons.push("Follow-up today"); }
  }

  // Freshness (max 5) / staleness penalty
  const upd = lead.updated_at ? new Date(lead.updated_at).getTime() : 0;
  const daysSince = upd ? (Date.now() - upd) / 86400000 : 999;
  if (daysSince < 2) score += 5;
  else if (daysSince > 14) { score -= 10; reasons.push("Stale (14d+)"); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const heat: HeatLevel = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
  return { score, heat, reasons };
}

export const HEAT_STYLE: Record<HeatLevel, { label: string; className: string; emoji: string }> = {
  hot: {
    label: "Hot",
    emoji: "🔥",
    className: "bg-primary/10 text-primary border border-primary/30",
  },
  warm: {
    label: "Warm",
    emoji: "✨",
    className: "bg-amber-500/10 text-amber-600 border border-amber-500/30 dark:text-amber-400",
  },
  cold: {
    label: "Cold",
    emoji: "❄️",
    className: "bg-muted text-muted-foreground border border-hairline",
  },
};