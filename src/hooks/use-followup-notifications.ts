import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "coreegin:followup-notified";
const POLL_MS = 120_000; // 2 min

function loadSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveSeen(map: Record<string, string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}

/**
 * Foreground follow-up alerts. Uses the browser Notification API when the tab
 * is open. Real background push (offline) requires VAPID + service worker +
 * cron — this is the always-available first layer.
 */
export function useFollowupNotifications() {
  const { user, role } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;

    async function poll() {
      const nowIso = new Date().toISOString();
      const inHrs = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      let q = supabase
        .from("leads")
        .select("id, name, company, next_follow_up, assigned_to, stage")
        .not("next_follow_up", "is", null)
        .lte("next_follow_up", inHrs)
        .not("stage", "in", "(won,lost)");
      if (role !== "owner") q = q.eq("assigned_to", user!.id);
      const { data } = await q;
      if (cancelled || !data) return;

      const seen = loadSeen();
      const dayKey = new Date().toDateString();

      data.forEach((l: any) => {
        const key = `${l.id}:${dayKey}`;
        if (seen[key]) return;
        const due = new Date(l.next_follow_up);
        const overdue = due.getTime() < Date.now();
        try {
          new Notification(overdue ? "Follow-up overdue" : "Follow-up due soon", {
            body: `${l.name}${l.company ? ` · ${l.company}` : ""}`,
            icon: "/CEWHITE.png",
            tag: `followup-${l.id}`,
            silent: false,
          });
          seen[key] = nowIso;
        } catch {}
      });
      saveSeen(seen);
    }

    poll();
    const t = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [user, role]);
}

export async function requestFollowupPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  return await Notification.requestPermission();
}

export function currentFollowupPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}