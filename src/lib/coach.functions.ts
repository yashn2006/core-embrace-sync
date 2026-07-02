import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({ repId: z.string().uuid() });

export const aiRepCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { supabase, userId } = context;

    // owner-only gate
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r) => r.role === "owner");
    if (!isOwner) throw new Error("Owner only");

    const { data: rep } = await supabase.from("profiles").select("id,name,email").eq("id", data.repId).maybeSingle();
    if (!rep) throw new Error("Rep not found");

    const { data: leads } = await supabase
      .from("leads")
      .select("id,name,company,stage,deal_value,progress,custom_status,next_follow_up,updated_at,created_at")
      .eq("assigned_to", data.repId)
      .order("updated_at", { ascending: false })
      .limit(60);

    const { data: acts } = await supabase
      .from("activities")
      .select("type,outcome,created_at")
      .eq("created_by", data.repId)
      .order("created_at", { ascending: false })
      .limit(50);

    const now = Date.now();
    const open = (leads ?? []).filter((l) => l.stage !== "won" && l.stage !== "lost");
    const won = (leads ?? []).filter((l) => l.stage === "won");
    const lost = (leads ?? []).filter((l) => l.stage === "lost");
    const overdue = open.filter((l) => l.next_follow_up && new Date(l.next_follow_up).getTime() < now);
    const stale = open.filter((l) => l.updated_at && now - new Date(l.updated_at).getTime() > 5 * 86400_000);
    const pipelineValue = open.reduce((s, l) => s + Number(l.deal_value ?? 0), 0);
    const wonValue = won.reduce((s, l) => s + Number(l.deal_value ?? 0), 0);
    const winRate = leads && leads.length ? Math.round((won.length / (won.length + lost.length || 1)) * 100) : 0;

    const summary = [
      `Rep: ${rep.name ?? rep.email}`,
      `Open leads: ${open.length} · Won: ${won.length} · Lost: ${lost.length} · Win rate: ${winRate}%`,
      `Pipeline value (open): ${pipelineValue} · Won value: ${wonValue}`,
      `Overdue follow-ups: ${overdue.length} · Stale >5d: ${stale.length}`,
      `Activities logged (recent 50): ${acts?.length ?? 0}`,
      "",
      "Top open leads:",
      ...open.slice(0, 12).map((l) => `- ${l.name}${l.company ? " @ " + l.company : ""} · ${l.stage} · ${l.progress ?? 0}% · $${l.deal_value ?? 0}${l.custom_status ? " · " + l.custom_status : ""}`),
      "",
      "Recent activity types:",
      ...(acts ?? []).slice(0, 20).map((a) => `- ${a.type}${a.outcome ? " → " + a.outcome : ""}`),
    ].join("\n");

    const prompt = `You are a sharp head-of-sales coaching a rep at a digital agency called CoreEgin. Based on the data below, write a coaching briefing with these sections and NO fluff:

1. **Verdict** — one sentence, blunt (e.g. "Strong closer, weak on follow-through").
2. **What's working** — 2 bullets, specific.
3. **What's leaking money** — 2-3 bullets tied to the numbers (overdue, stale, low activity, low win rate, small pipeline, etc.).
4. **This week's plan** — 3 numbered actions the rep should do in the next 5 days. Reference specific leads by name when possible.
5. **1:1 talking points for the owner** — 2 short questions to ask this rep in their next 1:1.

Data:
${summary}`;

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    return {
      text,
      stats: { open: open.length, won: won.length, lost: lost.length, winRate, pipelineValue, wonValue, overdue: overdue.length, stale: stale.length, activities: acts?.length ?? 0 },
      rep: { id: rep.id, name: rep.name, email: rep.email },
    };
  });