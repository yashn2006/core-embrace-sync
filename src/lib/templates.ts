import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ORG_ID } from "./constants";

export interface MessageTemplate {
  id: string;
  org_id: string;
  title: string;
  body: string;
  category: string;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_CATEGORIES = [
  "outreach",
  "follow-up",
  "proposal",
  "objection",
  "closing",
  "onboarding",
  "general",
] as const;

export async function listTemplates(): Promise<MessageTemplate[]> {
  const { data, error } = await supabase
    .from("message_templates" as any)
    .select("*")
    .order("category")
    .order("title");
  if (error) throw error;
  return (data ?? []) as unknown as MessageTemplate[];
}

export async function createTemplate(input: { title: string; body: string; category: string; is_shared?: boolean }, userId: string) {
  const { data, error } = await supabase
    .from("message_templates" as any)
    .insert({ ...input, org_id: DEFAULT_ORG_ID, created_by: userId, is_shared: input.is_shared ?? true } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as MessageTemplate;
}

export async function updateTemplate(id: string, patch: Partial<{ title: string; body: string; category: string; is_shared: boolean }>) {
  const { error } = await supabase.from("message_templates" as any).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from("message_templates" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Renders {{name}}, {{company}}, {{first_name}} variables against a lead. */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_, k) => (vars[k] ?? "").toString());
}