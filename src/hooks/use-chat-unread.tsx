import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/** Deterministic channel key: "team" or "dm:<lowerId>:<higherId>". */
export function channelKey(user: { type: "team" } | { type: "direct"; peerId: string }, myId: string) {
  if (user.type === "team") return "team";
  const [a, b] = [myId, user.peerId].sort();
  return `dm:${a}:${b}`;
}

export async function markChannelSeen(myId: string, key: string) {
  await supabase.from("chat_reads").upsert({ user_id: myId, channel_key: key, last_seen_at: new Date().toISOString() });
  window.dispatchEvent(new CustomEvent("chat:seen", { detail: { key } }));
}

type Counts = { total: number; team: number; dm: Record<string, number> };

/** Per-channel + total unread counts. Realtime + read receipts. */
export function useChatUnread(): Counts & { refresh: () => void } {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ total: 0, team: 0, dm: {} });

  const tally = useCallback(async () => {
    if (!user) return;
    const { data: reads } = await supabase.from("chat_reads").select("channel_key,last_seen_at").eq("user_id", user.id);
    const seenMap = new Map<string, string>((reads ?? []).map((r) => [r.channel_key, r.last_seen_at]));
    const epoch = new Date(0).toISOString();

    // Team unread
    const teamSince = seenMap.get("team") ?? epoch;
    const { count: teamCount } = await supabase
      .from("messages").select("*", { count: "exact", head: true })
      .eq("channel_type", "team").gt("created_at", teamSince).neq("sender_id", user.id);

    // DMs to me — fetch senders + created_at, group
    const { data: dms } = await supabase
      .from("messages").select("sender_id,created_at")
      .eq("channel_type", "direct").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(500);
    const dm: Record<string, number> = {};
    for (const m of dms ?? []) {
      const key = channelKey({ type: "direct", peerId: m.sender_id }, user.id);
      const since = seenMap.get(key) ?? epoch;
      if (m.created_at > since) dm[key] = (dm[key] ?? 0) + 1;
    }
    const dmTotal = Object.values(dm).reduce((a, b) => a + b, 0);
    setCounts({ total: (teamCount ?? 0) + dmTotal, team: teamCount ?? 0, dm });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    tally();
    const ch = supabase.channel(`chat-unread-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => tally())
      .subscribe();
    const onSeen = () => tally();
    window.addEventListener("chat:seen", onSeen);
    return () => { supabase.removeChannel(ch); window.removeEventListener("chat:seen", onSeen); };
  }, [user, tally]);

  return { ...counts, refresh: tally };
}