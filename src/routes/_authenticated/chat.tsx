import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listProfiles, type Profile } from "@/lib/leads";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { Send, Hash, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — CoreEgin Sales OS" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<{ type: "team" } | { type: "direct"; peerId: string }>({ type: "team" });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listProfiles().then(setProfiles).catch((e) => toast.error(e.message)); }, []);

  // Fetch + subscribe
  useEffect(() => {
    if (!user) return;
    let query = supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200);
    if (channel.type === "team") {
      query = query.eq("channel_type", "team");
    } else {
      query = query.eq("channel_type", "direct").or(`and(sender_id.eq.${user.id},recipient_id.eq.${channel.peerId}),and(sender_id.eq.${channel.peerId},recipient_id.eq.${user.id})`);
    }
    query.then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setMessages(data ?? []);
    });

    const ch = supabase
      .channel(`msg-${channel.type}-${channel.type === "direct" ? channel.peerId : "team"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (channel.type === "team" && m.channel_type === "team") {
          setMessages((p) => [...p, m]);
        } else if (channel.type === "direct" && m.channel_type === "direct") {
          const isConvo = (m.sender_id === user.id && m.recipient_id === channel.peerId) ||
                          (m.sender_id === channel.peerId && m.recipient_id === user.id);
          if (isConvo) setMessages((p) => [...p, m]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, channel]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || !user) return;
    setInput("");
    const row: any = {
      org_id: DEFAULT_ORG_ID,
      channel_type: channel.type,
      sender_id: user.id,
      content,
      recipient_id: channel.type === "direct" ? channel.peerId : null,
    };
    const { error } = await supabase.from("messages").insert(row);
    if (error) { toast.error(error.message); setInput(content); }
  }

  const peers = useMemo(() => profiles.filter((p) => p.id !== user?.id), [profiles, user?.id]);
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "Someone";
  const currentPeer = channel.type === "direct" ? profiles.find((p) => p.id === channel.peerId) : null;

  return (
    <>
      <PageHeader title="Team chat" description="Quick coordination. Real-time." />
      <div className="p-4 md:p-6">
        <div className="surface grid grid-cols-[240px_1fr] h-[calc(100vh-220px)] min-h-[500px] overflow-hidden">
          <aside className="border-r border-hairline p-2 overflow-y-auto bg-surface-elevated/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-2">Channels</div>
            <ChannelBtn active={channel.type === "team"} onClick={() => setChannel({ type: "team" })} icon={<Hash className="h-3.5 w-3.5" />} label="team" />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-2 mt-2 flex items-center gap-1"><Users className="h-3 w-3" /> Direct</div>
            {peers.map((p) => (
              <ChannelBtn
                key={p.id}
                active={channel.type === "direct" && channel.peerId === p.id}
                onClick={() => setChannel({ type: "direct", peerId: p.id })}
                avatar={p.name.slice(0, 1).toUpperCase()}
                label={p.name}
              />
            ))}
            {peers.length === 0 && <div className="text-xs text-muted-foreground px-2 py-3">No other members yet.</div>}
          </aside>

          <section className="flex flex-col min-w-0">
            <div className="h-12 border-b border-hairline flex items-center px-4 gap-2">
              {channel.type === "team" ? (
                <><Hash className="h-3.5 w-3.5 text-muted-foreground" /><div className="text-sm font-medium">team</div><div className="text-xs text-muted-foreground">· everyone</div></>
              ) : (
                <><div className="h-5 w-5 rounded-full text-[10px] flex items-center justify-center text-white font-medium" style={{ background: "var(--gradient-magenta)" }}>{currentPeer?.name.slice(0, 1)}</div><div className="text-sm font-medium">{currentPeer?.name}</div></>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">No messages yet. Say hi 👋</div>}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={"flex gap-2 " + (mine ? "flex-row-reverse" : "")}>
                    <div className="h-7 w-7 rounded-full text-[10px] flex items-center justify-center text-white font-medium shrink-0" style={{ background: mine ? "var(--gradient-magenta)" : "oklch(0.65 0.02 340)" }}>
                      {nameOf(m.sender_id).slice(0, 1).toUpperCase()}
                    </div>
                    <div className={"max-w-[70%] " + (mine ? "text-right" : "")}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        {mine ? "You" : nameOf(m.sender_id)} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                      <div className={"inline-block rounded-2xl px-3.5 py-2 text-sm " + (mine ? "text-white" : "bg-muted text-foreground")} style={mine ? { background: "var(--gradient-magenta)" } : undefined}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-hairline p-3 flex items-center gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" />
              <Button size="icon" onClick={send} disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ChannelBtn({ active, onClick, icon, label, avatar }: { active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; avatar?: string }) {
  return (
    <button
      onClick={onClick}
      className={"w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors " + (active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
    >
      {avatar ? (
        <div className="h-5 w-5 rounded-full text-[10px] flex items-center justify-center text-white font-medium" style={{ background: "var(--gradient-magenta)" }}>{avatar}</div>
      ) : icon}
      <span className="truncate">{label}</span>
    </button>
  );
}