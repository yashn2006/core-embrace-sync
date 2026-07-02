import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "./constants";
import { resolveAiProvider } from "./ai-gateway.server";

const Provider = z.enum(["lovable", "openai", "gemini"]);

async function ensureOwner(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "owner")) throw new Error("Owner only");
}

/** Owner-only: fetch current AI settings. api_key returned MASKED. */
export const getAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureOwner(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data } = await admin.from("ai_settings").select("provider,api_key,model,updated_at,updated_by").eq("org_id", DEFAULT_ORG_ID).maybeSingle();
    if (!data) return { provider: "lovable" as const, model: "", hasKey: false, keyPreview: "", updated_at: null as string | null };
    const key = (data.api_key as string | null) ?? "";
    return {
      provider: data.provider as "lovable" | "openai" | "gemini",
      model: (data.model as string | null) ?? "",
      hasKey: key.length > 0,
      keyPreview: key.length > 8 ? key.slice(0, 4) + "…" + key.slice(-4) : (key ? "••••" : ""),
      updated_at: data.updated_at as string | null,
    };
  });

/** Owner-only: save AI settings. Empty api_key keeps the existing one. */
export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      provider: Provider,
      api_key: z.string().optional(),
      model: z.string().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureOwner(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: existing } = await admin.from("ai_settings").select("id,api_key").eq("org_id", DEFAULT_ORG_ID).maybeSingle();
    const patch: Record<string, unknown> = {
      provider: data.provider,
      model: data.model?.trim() || null,
      updated_by: (context as { userId: string }).userId,
    };
    // Only overwrite the key when a non-empty value is provided; for Lovable, clear it.
    if (data.provider === "lovable") patch.api_key = null;
    else if (data.api_key && data.api_key.trim().length > 0) patch.api_key = data.api_key.trim();

    if (existing) {
      const { error } = await admin.from("ai_settings").update(patch).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("ai_settings").insert({ org_id: DEFAULT_ORG_ID, ...patch });
      if (error) throw error;
    }
    return { ok: true };
  });

/** Owner-only: run a tiny generation to verify the configured provider works. */
export const testAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureOwner(context as never);
    const started = Date.now();
    const ai = await resolveAiProvider();
    const { text } = await generateText({
      model: ai.make(),
      prompt: "Reply with exactly the word: PONG",
    });
    return { ok: true, provider: ai.provider, model: ai.model, latencyMs: Date.now() - started, sample: text.slice(0, 120) };
  });

/** Owner-only: reset to Lovable AI (removes stored key). */
export const resetAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureOwner(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    await admin.from("ai_settings").delete().eq("org_id", DEFAULT_ORG_ID);
    return { ok: true };
  });