import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";
import type { Profile } from "@/lib/leads";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignedAvatarImage } from "@/components/signed-image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Tag, X, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { QUICK_STATUSES, applyQuickStatus } from "@/lib/quick-status";

type Message = Database["public"]["Tables"]["messages"]["Row"];

/** Shows every chat message linked to this lead; you can post more from here. */
export function LeadChatPanel({ leadId, leadName, profiles }: { leadId: string; leadName: string; profiles: Profile[] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("messages").select("*").eq("lead_id", leadId).order("created_at", { ascending: true })
      .then(({ data, error }) => { if (error) toast.error(error.message); else setMessages(data ?? []); });
    const ch = supabase.channel(`lead-msg-${leadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
        (p) => setMessages(prev => [...prev, p.new as Message]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!user) return;
    const content = input.trim();
    if (!content && !tag) return;
    setBusy(true);
    try {
      const q = tag ? QUICK_STATUSES.find(s => s.key === tag) : null;
      const { error } = await supabase.from("messages").insert({
        org_id: DEFAULT_ORG_ID, channel_type: "team", sender_id: user.id,
        content: content || q?.outcome || "",
        lead_id: leadId, quick_tag: q?.key ?? null,
      });
      if (error) throw error;
      if (q) {
        await applyQuickStatus({ leadId, userId: user.id, status: q, note: content || `via lead chat` });
        toast.success(`Lead updated: ${q.outcome}`);
      }
      setInput(""); setTag(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  const profileOf = (id: string) => profiles.find(p => p.id === id);
  const nameOf = (id: string) => profileOf(id)?.name ?? "Someone";

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3" /> Discussion about {leadName}
      </div>
      <div className="surface p-3 max-h-72 overflow-y-auto space-y-3">
        {messages.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">No messages linked yet. Post below or use Chat → attach this lead.</div>}
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          const p = profileOf(m.sender_id);
          const q = (m as any).quick_tag ? QUICK_STATUSES.find(s => s.key === (m as any).quick_tag) : null;
          return (
            <div key={m.id} className={"flex gap-2 " + (mine ? "flex-row-reverse" : "")}>
              <Avatar className="h-6 w-6 shrink-0">
                <SignedAvatarImage bucket="avatars" path={p?.avatar_url} />
                <AvatarFallback className="text-[9px] text-white" style={{ background: mine ? "var(--gradient-magenta)" : "oklch(0.65 0.02 340)" }}>
                  {nameOf(m.sender_id).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={"max-w-[80%] " + (mine ? "text-right" : "")}>
                <div className="text-[10px] text-muted-foreground mb-0.5">{mine ? "You" : nameOf(m.sender_id)} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</div>
                <div className={"inline-block rounded-2xl px-3 py-1.5 text-sm text-left " + (mine ? "text-white" : "bg-muted")} style={mine ? { background: "var(--gradient-magenta)" } : undefined}>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {q && <div className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block " + (mine ? "bg-white/20" : "bg-primary/10 text-primary")}>{q.label}</div>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2">
        {tag && (
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs">
            <Tag className="h-3 w-3" />
            {QUICK_STATUSES.find(q => q.key === tag)?.label}
            <button onClick={() => setTag(null)}><X className="h-3 w-3" /></button>
          </div>
        )}
        <TagRow value={tag} onPick={setTag} />
        <div className="flex items-center gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) { e.preventDefault(); send(); } }}
            placeholder="Post an update about this lead…" disabled={busy} className="h-9" />
          <Button size="icon" className="h-9 w-9" onClick={send} disabled={busy || (!input.trim() && !tag)}><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

function TagRow({ value, onPick }: { value: string | null; onPick: (v: string) => void }) {
  const top = useMemo(() => QUICK_STATUSES.filter(s => ["contacted", "no_answer", "warm_5050", "replied_yes", "meeting_set", "not_interested"].includes(s.key)), []);
  return (
    <div className="flex flex-wrap gap-1">
      {top.map(s => (
        <button key={s.key} onClick={() => onPick(s.key)}
          className={"text-[11px] px-2 py-1 rounded-full transition " +
            (value === s.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground")}>
          {s.label}
        </button>
      ))}
    </div>
  );
}