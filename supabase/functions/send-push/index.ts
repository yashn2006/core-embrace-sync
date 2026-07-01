// Supabase Edge Function: flush push_notifications_queue via Web Push (VAPID).
// Invoked by pg_cron every minute. Stable URL — safe for scheduling.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@coreegin.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const nowIso = new Date().toISOString();

  const { data: pending, error } = await admin
    .from("push_notifications_queue")
    .select("id,user_id,title,body,url,tag")
    .is("sent_at", null)
    .lte("scheduled_for", nowIso)
    .lt("attempts", 5)
    .limit(200);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!pending || pending.length === 0) return Response.json({ ok: true, sent: 0 });

  const userIds = [...new Set(pending.map((p) => p.user_id))];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id,endpoint,p256dh,auth")
    .in("user_id", userIds);
  const byUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
  (subs ?? []).forEach((s) => {
    const a = byUser.get(s.user_id) ?? [];
    a.push(s);
    byUser.set(s.user_id, a);
  });

  let sent = 0;
  for (const n of pending) {
    const userSubs = byUser.get(n.user_id) ?? [];
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag });
    let anyOk = false;
    for (const s of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        anyOk = true;
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    if (anyOk) {
      await admin.from("push_notifications_queue").update({ sent_at: new Date().toISOString() }).eq("id", n.id);
      sent++;
    } else {
      await admin.from("push_notifications_queue")
        .update({ attempts: userSubs.length ? 1 : 5, last_error: userSubs.length ? "send failed" : "no subscription" })
        .eq("id", n.id);
    }
  }

  return Response.json({ ok: true, sent, total: pending.length });
});