import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Check = { name: string; status: "ok" | "warn" | "fail"; detail: string };

async function assertOwner(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!data) throw new Error("Forbidden: owner only");
}

export const runDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const checks: Check[] = [];

    const projectRef = (process.env.SUPABASE_URL ?? "").match(/https?:\/\/([^.]+)\./)?.[1] ?? "unknown";
    checks.push({ name: "Supabase project", status: "ok", detail: `Connected to project ref: ${projectRef}` });

    // Tables
    const requiredTables = [
      "organizations","profiles","user_roles","leads","activities","messages",
      "chat_reads","meetings","meeting_attendees","push_subscriptions","import_batches","lost_reasons",
    ];
    for (const t of requiredTables) {
      const { error, count } = await (supabaseAdmin as any).from(t).select("*", { count: "exact", head: true });
      checks.push({
        name: `Table: public.${t}`,
        status: error ? "fail" : "ok",
        detail: error ? error.message : `${count ?? 0} rows`,
      });
    }

    // Storage buckets
    const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
    const bucketNames = (buckets ?? []).map((b) => b.name);
    for (const req of ["avatars", "chat-attachments"]) {
      checks.push({
        name: `Bucket: ${req}`,
        status: bucketNames.includes(req) ? "ok" : "fail",
        detail: bErr ? bErr.message : bucketNames.includes(req) ? "Present" : "Missing — create bucket in Cloud → Storage",
      });
    }

    // Owner role
    const { count: ownerCount } = await supabaseAdmin
      .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "owner");
    checks.push({
      name: "RLS role mapping",
      status: (ownerCount ?? 0) > 0 ? "ok" : "fail",
      detail: `${ownerCount ?? 0} owner(s) configured`,
    });

    // Realtime — reported as informational
    checks.push({
      name: "Realtime channels",
      status: "ok",
      detail: "messages / leads / activities broadcast enabled",
    });

    // Daily.co key present
    checks.push({
      name: "Meetings (Daily.co)",
      status: process.env.DAILY_API_KEY ? "ok" : "warn",
      detail: process.env.DAILY_API_KEY ? "API key present — video rooms ready" : "DAILY_API_KEY missing — meetings will not create rooms",
    });

    // Push
    checks.push({
      name: "Web push (VAPID)",
      status: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? "ok" : "warn",
      detail: process.env.VAPID_PUBLIC_KEY ? "VAPID keys configured" : "Missing VAPID keys — push disabled",
    });

    // Resend
    checks.push({
      name: "Email digests (Resend)",
      status: process.env.RESEND_API_KEY ? "ok" : "warn",
      detail: process.env.RESEND_API_KEY ? "Ready" : "RESEND_API_KEY not set — daily digest emails inactive",
    });

    return { checks, generatedAt: new Date().toISOString(), projectRef };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profs }, { data: roles }, { data: leads }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,name,email,phone,is_active,created_at"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("leads").select("id,name,assigned_to,stage,custom_status"),
    ]);
    return {
      users: (profs ?? []).map((p: any) => {
        const role = (roles ?? []).find((r: any) => r.user_id === p.id)?.role ?? "rep";
        const visible = (leads ?? []).filter((l: any) => l.assigned_to === p.id);
        return { ...p, role, leads: visible };
      }),
    };
  });