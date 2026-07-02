import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Only the owner can perform this action.");
}

export const approveCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase
      .from("commissions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: userId,
        notes: data.notes ?? null,
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markCommissionPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase
      .from("commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_by: userId,
        notes: data.notes ?? null,
      })
      .eq("id", data.id)
      .in("status", ["pending", "approved"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const voidCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase
      .from("commissions")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        notes: data.notes ?? null,
      })
      .eq("id", data.id)
      .in("status", ["pending", "approved"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkApproveForRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { repId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error, count } = await supabase
      .from("commissions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: userId,
      }, { count: "exact" })
      .eq("rep_id", data.repId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });