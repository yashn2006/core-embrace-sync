import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { DEFAULT_ORG_ID } from "./constants";

export type AiProviderKind = "lovable" | "openai" | "gemini";

export interface ResolvedAiProvider {
  provider: AiProviderKind;
  model: string;
  /** LanguageModel factory ready to hand to generateText/streamText. */
  make: () => ReturnType<ReturnType<typeof createOpenAICompatible>>;
}

const DEFAULT_MODELS: Record<AiProviderKind, string> = {
  lovable: "google/gemini-3-flash-preview",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

function createOpenAiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

function createGeminiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/**
 * Resolve the AI provider based on owner-configured settings in the
 * `ai_settings` table. Falls back to Lovable AI Gateway (LOVABLE_API_KEY)
 * when nothing is configured or when the configured key is missing.
 */
export async function resolveAiProvider(): Promise<ResolvedAiProvider> {
  const lovableKey = process.env.LOVABLE_API_KEY;

  // Read settings using the service role (bypasses RLS — table is protected
  // at the API layer by owner-only RLS, but server-side we need to read it
  // for every user's AI call).
  type SettingsRow = { provider: AiProviderKind; api_key: string | null; model: string | null };
  let row: SettingsRow | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: SettingsRow | null }>;
          };
        };
      };
    };
    const { data } = await admin.from("ai_settings").select("provider,api_key,model").eq("org_id", DEFAULT_ORG_ID).maybeSingle();
    row = data ?? null;
  } catch {
    row = null;
  }

  const provider = (row?.provider ?? "lovable") as AiProviderKind;
  const model = row?.model?.trim() || DEFAULT_MODELS[provider];

  if (provider === "openai" && row?.api_key) {
    const key = row.api_key;
    return { provider, model, make: () => createOpenAiProvider(key)(model) };
  }
  if (provider === "gemini" && row?.api_key) {
    const key = row.api_key;
    return { provider, model, make: () => createGeminiProvider(key)(model) };
  }

  // Default / fallback: Lovable AI
  if (!lovableKey) throw new Error("AI is not configured. Set an API key in Admin → AI Settings.");
  return {
    provider: "lovable",
    model: DEFAULT_MODELS.lovable,
    make: () => createLovableAiGatewayProvider(lovableKey)(DEFAULT_MODELS.lovable),
  };
}