import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-invoked endpoint that flushes the push_notifications_queue.
 * Auth = Supabase anon key in `apikey` header (route is under /api/public/*
 * which bypasses site auth; we read privileged data via service role inside).
 */
export const Route = createFileRoute("/api/public/hooks/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("Authorization")?.replace("Bearer ", "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@coreegin.com";
        if (!vapidPublic || !vapidPrivate) {
          return new Response(JSON.stringify({ error: "vapid missing" }), { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

        const nowIso = new Date().toISOString();
        const { data: pending, error } = await supabaseAdmin
          .from("push_notifications_queue")
          .select("id,user_id,title,body,url,tag")
          .is("sent_at", null)
          .lte("scheduled_for", nowIso)
          .lt("attempts", 5)
          .limit(200);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        if (!pending || pending.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }));

        // Group by user for lookup
        const userIds = Array.from(new Set(pending.map((p) => p.user_id)));
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("user_id,endpoint,p256dh,auth")
          .in("user_id", userIds);
        const subsByUser = new Map<string, typeof subs>();
        (subs ?? []).forEach((s) => {
          const arr = subsByUser.get(s.user_id) ?? [];
          arr.push(s);
          subsByUser.set(s.user_id, arr as any);
        });

        let sent = 0;
        for (const n of pending) {
          const userSubs = subsByUser.get(n.user_id) ?? [];
          const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag });
          let anyOk = false;
          for (const s of userSubs) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              anyOk = true;
            } catch (e: unknown) {
              const status = (e as { statusCode?: number })?.statusCode;
              if (status === 404 || status === 410) {
                // Subscription gone
                await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
              }
            }
          }
          if (anyOk) {
            await supabaseAdmin.from("push_notifications_queue").update({ sent_at: new Date().toISOString() }).eq("id", n.id);
            sent++;
          } else {
            await supabaseAdmin.from("push_notifications_queue").update({ attempts: (userSubs.length ? 1 : 5), last_error: userSubs.length ? "send failed" : "no subscription" }).eq("id", n.id);
          }
        }

        return new Response(JSON.stringify({ ok: true, sent, total: pending.length }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});