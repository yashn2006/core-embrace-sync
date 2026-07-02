import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ORG_ID } from "./constants";
import type { Lead } from "./leads";

export interface SalesGoal {
  id: string;
  org_id: string;
  rep_id: string;
  month: string; // YYYY-MM-DD (first)
  target_amount: number;
  target_leads: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function monthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export async function listGoals(month: string = monthKey()): Promise<SalesGoal[]> {
  const { data, error } = await supabase
    .from("sales_goals" as any)
    .select("*")
    .eq("month", month);
  if (error) throw error;
  return (data ?? []) as unknown as SalesGoal[];
}

export async function upsertGoal(input: { rep_id: string; month: string; target_amount: number; target_leads: number }, userId: string) {
  const { error } = await supabase
    .from("sales_goals" as any)
    .upsert({ ...input, org_id: DEFAULT_ORG_ID, created_by: userId } as never, { onConflict: "org_id,rep_id,month" });
  if (error) throw error;
}

export interface GoalProgress {
  wonAmount: number;
  newLeads: number;
  amountPct: number;
  leadsPct: number;
  pacePct: number; // fraction of month elapsed
}

export function computeGoalProgress(leads: Lead[], repId: string, goal?: SalesGoal | null): GoalProgress {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const mine = leads.filter((l) => l.assigned_to === repId);
  const wonThisMonth = mine.filter((l) => l.stage === "won" && l.won_at && new Date(l.won_at) >= start && new Date(l.won_at) <= end);
  const newThisMonth = mine.filter((l) => new Date(l.created_at) >= start);
  const wonAmount = wonThisMonth.reduce((s, l) => s + (l.deal_value ?? 0), 0);
  const newLeads = newThisMonth.length;
  const target_amount = goal?.target_amount ?? 0;
  const target_leads = goal?.target_leads ?? 0;
  const amountPct = target_amount > 0 ? Math.min(100, (wonAmount / target_amount) * 100) : 0;
  const leadsPct = target_leads > 0 ? Math.min(100, (newLeads / target_leads) * 100) : 0;
  const totalMs = end.getTime() - start.getTime();
  const pacePct = Math.min(100, ((now.getTime() - start.getTime()) / totalMs) * 100);
  return { wonAmount, newLeads, amountPct, leadsPct, pacePct };
}