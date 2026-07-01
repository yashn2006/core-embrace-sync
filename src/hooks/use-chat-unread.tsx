import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const KEY = "coreegin:chat:lastSeen";

function getLastSeen(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(KEY) ?? 0);
}

export function markChatSeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, String(Date.now()));
  window.dispatchEvent(new Event("chat:seen"));
}

/** Returns the number of unread chat messages (team + DMs to me) since last seen. */
export function useChatUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    async function tally() {
      const since = new Date(getLastSeen()).toISOString();
      const { count: c } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gt("created_at", since)
        .neq("sender_id", user!.id)
        .or(`channel_type.eq.team,recipient_id.eq.${user!.id}`);
      if (alive) setCount(c ?? 0);
    }
    tally();

    const ch = supabase
      .channel("chat-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => tally())
      .subscribe();

    const onSeen = () => setCount(0);
    window.addEventListener("chat:seen", onSeen);

    return () => {
      alive = false;
      supabase.removeChannel(ch);
      window.removeEventListener("chat:seen", onSeen);
    };
  }, [user]);

  return count;
}