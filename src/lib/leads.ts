import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_ORG_ID, type ActivityType, type SourceKey, type StageKey } from "./constants";

export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function listLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export interface LeadInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  description?: string | null;
  source: SourceKey;
  stage: StageKey;
  deal_value?: number | null;
  assigned_to?: string | null;
  next_follow_up?: string | null;
}

export async function createLead(input: LeadInput, userId: string) {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...input,
      org_id: DEFAULT_ORG_ID,
      created_by: userId,
      assigned_to: input.assigned_to ?? userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id: string, patch: Partial<LeadInput> & { won_at?: string | null; lost_at?: string | null; handoff_note?: string | null }) {
  const { data, error } = await supabase.from("leads").update(patch as never).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateLeadCustomStatus(id: string, status: string | null) {
  const { data, error } = await supabase
    .from("leads")
    .update({ custom_status: status } as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function logActivity(args: {
  lead_id: string;
  type: ActivityType;
  outcome?: string | null;
  response_text?: string | null;
  next_action?: string | null;
  created_by: string;
}) {
  const { data, error } = await supabase
    .from("activities")
    .insert({ ...args, org_id: DEFAULT_ORG_ID })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listActivitiesForLead(leadId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function recordLostReason(leadId: string, reason: string, note: string | null, userId: string) {
  const { error } = await supabase.from("lost_reasons").insert({
    lead_id: leadId,
    org_id: DEFAULT_ORG_ID,
    reason,
    note,
    created_by: userId,
  });
  if (error) throw error;
}

export function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}