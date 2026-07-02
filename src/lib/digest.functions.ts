import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const aiWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r) => r.role === "owner")) throw new Error("Owner only");

    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [{ data: profiles }, { data: leads }, { data: acts }] = await Promise.all([
      supabase.from("profiles").select("id,name,email"),
      supabase.from("leads").select("id,name,company,stage,deal_value,assigned_to,won_at,lost_at,created_at,updated_at").gte("updated_at", weekAgo),
      supabase.from("activities").select("type,outcome,created_by,created_at").gte("created_at", weekAgo),
    ]);

    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? "Unknown"]));
    type Row = { name: string; wonCount: number; wonValue: number; lostCount: number; newLeads: number; activities: number };
    const perRep = new Map<string, Row>();
    const ensure = (id: string) => {
      if (!perRep.has(id)) perRep.set(id, { name: nameOf.get(id) ?? "Unknown", wonCount: 0, wonValue: 0, lostCount: 0, newLeads: 0, activities: 0 });
      return perRep.get(id)!;
    };

    let totalWonValue = 0, totalWon = 0, totalLost = 0, totalNew = 0;
    for (const l of leads ?? []) {
      const rid = l.assigned_to ?? "unassigned";
      const r = ensure(rid);
      if (l.won_at && new Date(l.won_at) >= new Date(weekAgo)) { r.wonCount++; r.wonValue += Number(l.deal_value ?? 0); totalWon++; totalWonValue += Number(l.deal_value ?? 0); }
      if (l.lost_at && new Date(l.lost_at) >= new Date(weekAgo)) { r.lostCount++; totalLost++; }
      if (new Date(l.created_at) >= new Date(weekAgo)) { r.newLeads++; totalNew++; }
    }
    for (const a of acts ?? []) {
      if (!a.created_by) continue;
      ensure(a.created_by).activities++;
    }

    const ranked = [...perRep.values()].sort((a, b) => b.wonValue - a.wonValue || b.wonCount - a.wonCount);
    const summary = [
      `Week ending: ${new Date().toDateString()}`,
      `New leads: ${totalNew} · Won: ${totalWon} ($${totalWonValue.toLocaleString()}) · Lost: ${totalLost}`,
      "",
      "Per rep:",
      ...ranked.map((r) => `- ${r.name}: ${r.wonCount} won ($${r.wonValue.toLocaleString()}), ${r.lostCount} lost, ${r.newLeads} new, ${r.activities} activities`),
    ].join("\n");

    const prompt = `You are head of sales at CoreEgin, a digital agency. Write a crisp weekly digest to send to the founder. Sections in order:

1. **Headline** — one bold sentence naming the week's biggest win or biggest concern.
2. **The numbers** — 3-4 bullets, plain English (not just repeating the data).
3. **Star of the week** — name the top rep and why (one sentence).
4. **Needs a nudge** — name any rep who's slipping and what to say to them.
5. **Next week's focus** — 3 concrete priorities for the team.

Tone: direct, no fluff. Data:

${summary}`;

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({ model: gateway("google/gemini-3-flash-preview"), prompt });
    return { text, stats: { totalNew, totalWon, totalWonValue, totalLost, reps: ranked } };
  });