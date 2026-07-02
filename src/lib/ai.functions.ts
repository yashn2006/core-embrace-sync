import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Kind = z.enum(["draft_reply", "summarize", "next_step"]);
const Input = z.object({ leadId: z.string().uuid(), kind: Kind, tone: z.string().optional() });

export const aiLeadAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { supabase } = context;

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id,name,company,email,phone,stage,deal_value,description,custom_status,progress,next_follow_up,business_type,website,address")
      .eq("id", data.leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) throw new Error("Lead not found");

    const { data: activities } = await supabase
      .from("activities")
      .select("type,outcome,note,created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(15);

    const context_text = [
      `Lead: ${lead.name}${lead.company ? " @ " + lead.company : ""}`,
      lead.email ? `Email: ${lead.email}` : "",
      lead.phone ? `Phone: ${lead.phone}` : "",
      lead.business_type ? `Industry: ${lead.business_type}` : "",
      `Stage: ${lead.stage} · Progress: ${lead.progress ?? 0}% · Value: ${lead.deal_value ?? 0}`,
      lead.custom_status ? `Custom status: ${lead.custom_status}` : "",
      lead.description ? `Notes: ${lead.description}` : "",
      "",
      "Recent activity:",
      ...(activities ?? []).map((a) => `- [${a.type}] ${a.outcome ?? ""} ${a.note ?? ""}`.trim()),
    ].filter(Boolean).join("\n");

    const prompts: Record<z.infer<typeof Kind>, string> = {
      draft_reply: `You are a senior B2B sales rep at a digital agency called CoreEgin. Draft a concise, friendly ${data.tone ?? "professional"} follow-up message to this lead. 3-6 short sentences, ready to send over WhatsApp/Email. No greetings like "I hope this finds you well". Get to the point, propose next step.\n\n${context_text}`,
      summarize: `Summarize the state of this lead in 4-6 bullet points: who they are, what stage, blockers, what was last discussed, and confidence of closing. Be blunt and useful.\n\n${context_text}`,
      next_step: `Suggest the single best next step to move this lead forward. Include (1) the action, (2) when to do it, (3) exact talking point in 1 sentence. Reply as a compact plan, no fluff.\n\n${context_text}`,
    };

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt: prompts[data.kind],
    });
    return { text };
  });