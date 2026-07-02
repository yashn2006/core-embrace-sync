// Daily follow-up email digest for each sales rep, powered by Resend via the Lovable connector gateway.
// Invoked by pg_cron once per day (recommended: 08:00 in your local TZ).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "CoreEgin <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://coreegin.com";
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  deal_value: number | null;
  progress: number | null;
  custom_status: string | null;
  next_follow_up: string | null;
  updated_at: string;
  assigned_to: string;
};

const STAGE_LABEL: Record<string, string> = {
  new: "New", qualified: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

function money(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function buildHtml(name: string, overdue: Lead[], today: Lead[], stale: Lead[]) {
  const row = (l: Lead, tag?: string) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1e6ee;">
        <div style="font-weight:600;color:#111;">${l.name}${tag ? ` <span style="color:#EC4899;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-left:6px;">${tag}</span>` : ""}</div>
        <div style="font-size:12px;color:#6b7280;">${l.company ?? STAGE_LABEL[l.stage] ?? l.stage} · ${money(l.deal_value)}${l.custom_status ? ` · ${l.custom_status}` : ""}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1e6ee;text-align:right;">
        <a href="${APP_URL}/leads" style="color:#EC4899;font-weight:600;font-size:12px;text-decoration:none;">Open →</a>
      </td>
    </tr>`;
  const section = (title: string, list: Lead[], tag?: string) => list.length === 0 ? "" : `
    <div style="margin:20px 0 8px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6b7280;">${title} (${list.length})</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #f1e6ee;border-radius:12px;overflow:hidden;">
      ${list.map((l) => row(l, tag)).join("")}
    </table>`;
  return `<!doctype html><html><body style="margin:0;background:#fdf2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#EC4899,#DB2777);color:#fff;font-weight:800;font-size:20px;padding:10px 18px;border-radius:12px;letter-spacing:-.02em;">CoreEgin</div>
      </div>
      <h1 style="font-size:22px;font-weight:700;margin:0 0 6px;">Good morning, ${name} ☀️</h1>
      <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Your follow-up plan for today. ${overdue.length + today.length + stale.length} leads need attention.</p>
      ${section("🔴 Overdue", overdue, "Overdue")}
      ${section("📅 Today", today)}
      ${section("💤 Going cold (5+ days)", stale)}
      ${overdue.length + today.length + stale.length === 0 ? `<div style="padding:32px;text-align:center;background:#fff;border:1px solid #f1e6ee;border-radius:12px;color:#6b7280;">🎯 Inbox zero. No follow-ups due today. Prospect something new!</div>` : ""}
      <div style="text-align:center;margin-top:28px;">
        <a href="${APP_URL}/pipeline" style="display:inline-block;background:linear-gradient(135deg,#EC4899,#DB2777);color:#fff;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;">Open Pipeline</a>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:24px;">CoreEgin Sales OS · Daily digest</p>
    </div>
  </body></html>`;
}

async function sendResend(to: string, subject: string, html: string) {
  const res = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  return res.json();
}

Deno.serve(async () => {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);

    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("id,name,email");
    if (pErr) throw pErr;

    const { data: leadsAll, error: lErr } = await admin
      .from("leads")
      .select("id,name,company,stage,deal_value,progress,custom_status,next_follow_up,updated_at,assigned_to")
      .in("stage", ["new", "qualified", "proposal", "negotiation"]);
    if (lErr) throw lErr;

    let sent = 0, skipped = 0, failed = 0;
    for (const p of profs ?? []) {
      if (!p.email) { skipped++; continue; }
      const mine = (leadsAll ?? []).filter((l: Lead) => l.assigned_to === p.id);
      const overdue = mine.filter((l) => l.next_follow_up && new Date(l.next_follow_up) < now);
      const today = mine.filter((l) => l.next_follow_up && new Date(l.next_follow_up) >= now && new Date(l.next_follow_up) <= todayEnd);
      const stale = mine.filter((l) => !l.next_follow_up && new Date(l.updated_at) < fiveDaysAgo).slice(0, 8);
      // Skip email if nothing to say AND rep has zero active leads
      if (mine.length === 0) { skipped++; continue; }
      try {
        const first = (p.name ?? "there").split(" ")[0];
        await sendResend(p.email, `☀️ ${overdue.length + today.length} follow-ups today · CoreEgin`, buildHtml(first, overdue, today, stale));
        sent++;
      } catch (e) {
        failed++;
        console.error("digest send failed for", p.email, e);
      }
    }
    return Response.json({ ok: true, sent, skipped, failed });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});