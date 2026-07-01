import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listLeads, listProfiles, type Lead, type Profile } from "@/lib/leads";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { Send, Hash, Users, Paperclip, X, Menu, Tag, Link2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { channelKey, markChannelSeen, useChatUnread } from "@/hooks/use-chat-unread";
import { QUICK_STATUSES, applyQuickStatus } from "@/lib/quick-status";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type ChannelSel = { type: "team" } | { type: "direct"; peerId: string };

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — CoreEgin Sales OS" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<ChannelSel>({ type: "team" });
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [pendingTag, setPendingTag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { team: unreadTeam, dm: unreadDm } = useChatUnread();

  useEffect(() => {
    listProfiles().then(setProfiles).catch((e) => toast.error(e.message));
    listLeads().then(setLeads).catch(() => {});
  }, []);

  // mark current channel seen when it opens or new messages arrive
  useEffect(() => {
    if (!user) return;
    markChannelSeen(user.id, channelKey(channel, user.id));
  }, [channel, messages.length, user]);

  useEffect(() => {
    if (!user) return;
    let query = supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200);
    if (channel.type === "team") {
      query = query.eq("channel_type", "team");
    } else {
      query = query.eq("channel_type", "direct").or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${channel.peerId}),and(sender_id.eq.${channel.peerId},recipient_id.eq.${user.id})`
      );
    }
    query.then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setMessages(data ?? []);
    });

    const ch = supabase.channel(`msg-${channel.type}-${channel.type === "direct" ? channel.peerId : "team"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (channel.type === "team" && m.channel_type === "team") setMessages((p) => [...p, m]);
        else if (channel.type === "direct" && m.channel_type === "direct") {
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
    if ((!content && !pendingFile && !pendingTag) || !user) return;
    setUploading(true);
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;
    let imageUrl: string | null = null;
    try {
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, pendingFile);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (pendingFile.type.startsWith("image/")) imageUrl = signed?.signedUrl ?? null;
        else {
          attachmentUrl = signed?.signedUrl ?? null;
          attachmentName = pendingFile.name;
          attachmentType = pendingFile.type || ext;
        }
      }

      const tag = pendingTag ? QUICK_STATUSES.find(q => q.key === pendingTag) : null;
      const row: any = {
        org_id: DEFAULT_ORG_ID,
        channel_type: channel.type,
        sender_id: user.id,
        content: content || (tag ? tag.outcome : (imageUrl ? "📷 Image" : attachmentName ? `📎 ${attachmentName}` : "")),
        image_url: imageUrl,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_type: attachmentType,
        recipient_id: channel.type === "direct" ? channel.peerId : null,
        lead_id: pendingLeadId,
        quick_tag: tag?.key ?? null,
      };
      const { error } = await supabase.from("messages").insert(row);
      if (error) throw error;

      // If tagged AND linked to a lead → auto-apply to lead
      if (tag && pendingLeadId) {
        await applyQuickStatus({
          leadId: pendingLeadId, userId: user.id, status: tag,
          note: content || `via chat (${channel.type === "team" ? "team" : "DM"})`,
        });
        toast.success(`Lead updated: ${tag.outcome}`);
      }

      setInput(""); setPendingFile(null); setPendingTag(null); setPendingLeadId(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message); setInput(content);
    } finally {
      setUploading(false);
    }
  }

  const peers = useMemo(() => profiles.filter((p) => p.id !== user?.id), [profiles, user?.id]);
  const profileOf = (id: string) => profiles.find((p) => p.id === id);
  const nameOf = (id: string) => profileOf(id)?.name ?? "Someone";
  const leadOf = (id: string | null) => leads.find((l) => l.id === id);
  const currentPeer = channel.type === "direct" ? profileOf(channel.peerId) : null;

  const ChannelSidebar = (
    <div className="h-full flex flex-col bg-surface-elevated/50">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 pt-4 pb-2">Channels</div>
      <div className="px-2 space-y-0.5">
        <ChannelBtn
          active={channel.type === "team"}
          onClick={() => { setChannel({ type: "team" }); setSidebarOpen(false); }}
          icon={<Hash className="h-3.5 w-3.5" />} label="team" unread={unreadTeam}
        />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 pt-4 pb-2 flex items-center gap-1"><Users className="h-3 w-3" /> Direct</div>
      <div className="px-2 space-y-0.5 flex-1 overflow-y-auto">
        {peers.map((p) => {
          const key = user ? channelKey({ type: "direct", peerId: p.id }, user.id) : "";
          return (
            <ChannelBtn key={p.id}
              active={channel.type === "direct" && channel.peerId === p.id}
              onClick={() => { setChannel({ type: "direct", peerId: p.id }); setSidebarOpen(false); }}
              profile={p} label={p.name} unread={unreadDm[key] ?? 0}
            />
          );
        })}
        {peers.length === 0 && <div className="text-xs text-muted-foreground px-2 py-3">No other members yet.</div>}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Team chat" description="Real-time. Tag messages to leads and quick-update stage." />
      <div className="p-2 md:p-6">
        <div className="surface grid grid-cols-1 md:grid-cols-[240px_1fr] h-[calc(100vh-180px)] md:h-[calc(100vh-220px)] min-h-[500px] overflow-hidden">
          <aside className="hidden md:block border-r border-hairline overflow-hidden">{ChannelSidebar}</aside>

          <section className="flex flex-col min-w-0">
            <div className="h-12 border-b border-hairline flex items-center px-3 md:px-4 gap-2 shrink-0">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button size="icon" variant="ghost" className="md:hidden h-8 w-8 -ml-1">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  <SheetTitle className="sr-only">Channels</SheetTitle>
                  {ChannelSidebar}
                </SheetContent>
              </Sheet>
              {channel.type === "team" ? (
                <><Hash className="h-3.5 w-3.5 text-muted-foreground" /><div className="text-sm font-medium">team</div><div className="text-xs text-muted-foreground hidden sm:inline">· everyone</div></>
              ) : (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={currentPeer?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] text-white" style={{ background: "var(--gradient-magenta)" }}>
                      {currentPeer?.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-sm font-medium truncate">{currentPeer?.name}</div>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
              {messages.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">No messages yet. Say hi 👋</div>}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const senderProfile = profileOf(m.sender_id);
                const lead = leadOf((m as any).lead_id);
                const tag = (m as any).quick_tag ? QUICK_STATUSES.find(q => q.key === (m as any).quick_tag) : null;
                return (
                  <div key={m.id} className={"flex gap-2 " + (mine ? "flex-row-reverse" : "")}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={senderProfile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] text-white font-medium" style={{ background: mine ? "var(--gradient-magenta)" : "oklch(0.65 0.02 340)" }}>
                        {nameOf(m.sender_id).slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={"max-w-[80%] md:max-w-[70%] " + (mine ? "text-right" : "")}>
                      <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1.5 flex-wrap" style={mine ? { justifyContent: "flex-end" } : undefined}>
                        <span className="font-medium text-foreground/80">{mine ? "You" : nameOf(m.sender_id)}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                      </div>
                      <div className={"inline-block rounded-2xl px-3.5 py-2 text-sm text-left " + (mine ? "text-white" : "bg-muted text-foreground")} style={mine ? { background: "var(--gradient-magenta)" } : undefined}>
                        {(m as any).image_url && (
                          <a href={(m as any).image_url} target="_blank" rel="noreferrer" className="block mb-1">
                            <img src={(m as any).image_url} alt="attachment" className="rounded-lg max-h-64 max-w-full object-cover" />
                          </a>
                        )}
                        {(m as any).attachment_url && (
                          <a href={(m as any).attachment_url} target="_blank" rel="noreferrer"
                            className={"flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 " + (mine ? "bg-white/15 hover:bg-white/25" : "bg-background/70 hover:bg-background")}>
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="text-xs truncate">{(m as any).attachment_name}</span>
                          </a>
                        )}
                        {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                        {(tag || lead) && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {tag && <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium " + (mine ? "bg-white/20" : "bg-primary/10 text-primary")}>{tag.label}</span>}
                            {lead && <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 " + (mine ? "bg-white/20" : "bg-secondary/10 text-secondary")}>
                              <Link2 className="h-2.5 w-2.5" />{lead.name}
                            </span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-hairline p-2 md:p-3 space-y-2 shrink-0">
              {(pendingFile || pendingLeadId || pendingTag) && (
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  {pendingFile && (
                    <div className="flex items-center gap-1.5 bg-muted/60 rounded-full px-2.5 py-1">
                      <Paperclip className="h-3 w-3 text-primary" />
                      <span className="truncate max-w-[140px]">{pendingFile.name}</span>
                      <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  {pendingLeadId && (
                    <div className="flex items-center gap-1.5 bg-secondary/10 text-secondary rounded-full px-2.5 py-1">
                      <Link2 className="h-3 w-3" />
                      <span className="truncate max-w-[140px]">{leadOf(pendingLeadId)?.name}</span>
                      <button onClick={() => setPendingLeadId(null)}><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  {pendingTag && (
                    <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1">
                      <Tag className="h-3 w-3" />
                      <span>{QUICK_STATUSES.find(q => q.key === pendingTag)?.label}</span>
                      <button onClick={() => setPendingTag(null)}><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  {pendingTag && !pendingLeadId && (
                    <div className="text-[10px] text-muted-foreground">Attach a lead to auto-update it</div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-1.5">
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} title="Attach file">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input
                  ref={fileRef} type="file" className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10 MB"); return; }
                    setPendingFile(f);
                  }}
                />
                <LeadPickerPopover leads={leads} value={pendingLeadId} onChange={setPendingLeadId} />
                <TagPickerPopover value={pendingTag} onChange={setPendingTag} />
                <Input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !uploading) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…" disabled={uploading} className="h-9" />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={send} disabled={uploading || (!input.trim() && !pendingFile && !pendingTag)}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ChannelBtn({ active, onClick, icon, label, profile, unread }: {
  active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; profile?: Profile; unread?: number;
}) {
  return (
    <button onClick={onClick}
      className={"w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors " +
        (active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
      {profile ? (
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px] text-white" style={{ background: "var(--gradient-magenta)" }}>
            {profile.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : icon}
      <span className="truncate flex-1 text-left">{label}</span>
      {unread && unread > 0 ? (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white tabular" style={{ background: "var(--gradient-magenta)" }}>
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

function LeadPickerPopover({ leads, value, onChange }: { leads: Lead[]; value: string | null; onChange: (v: string | null) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return leads.slice(0, 30);
    return leads.filter(l => (l.name + " " + (l.company ?? "")).toLowerCase().includes(t)).slice(0, 30);
  }, [leads, q]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant={value ? "default" : "ghost"} className="h-9 w-9 shrink-0" title="Attach lead">
          <Link2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input placeholder="Search lead…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2 h-8" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filtered.map(l => (
            <button key={l.id} onClick={() => onChange(l.id)}
              className={"w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted transition " + (value === l.id ? "bg-primary/10 text-primary" : "")}>
              <div className="font-medium truncate">{l.name}</div>
              {l.company && <div className="text-[10px] text-muted-foreground truncate">{l.company}</div>}
            </button>
          ))}
          {filtered.length === 0 && <div className="text-xs text-muted-foreground px-2 py-3 text-center">No matches</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagPickerPopover({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant={value ? "default" : "ghost"} className="h-9 w-9 shrink-0" title="Quick tag">
          <Tag className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 py-1 font-medium">Quick outcome</div>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_STATUSES.map(s => (
            <button key={s.key} onClick={() => onChange(s.key)}
              className={"text-xs px-2 py-1.5 rounded-md text-left transition " +
                (value === s.key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground px-1 pt-2">Attach a lead to auto-update it.</div>
      </PopoverContent>
    </Popover>
  );
}