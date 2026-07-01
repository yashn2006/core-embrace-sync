import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { listLeads, listProfiles, type Lead, type Profile } from "@/lib/leads";
import { STAGE_ACCENT, type StageKey } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { MessagesSquare, Search, Tag, User as UserIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export const Route = createFileRoute("/_authenticated/lead-logs")({
  head: () => ({ meta: [{ title: "Lead logs — CoreEgin Sales OS" }] }),
  component: LeadLogsPage,
});

function LeadLogsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([listLeads(), listProfiles()]);
      setLeads(l); setProfiles(p);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      setMessages(data ?? []);
    })();

    const ch = supabase
      .channel("lead-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (m.lead_id) setMessages((prev) => [m, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const grouped = useMemo(() => {
    const map = new Map<string, { lead: Lead; msgs: Message[] }>();
    for (const m of messages) {
      const lead = leadMap.get(m.lead_id!);
      if (!lead) continue;
      const cur = map.get(lead.id) ?? { lead, msgs: [] };
      cur.msgs.push(m);
      map.set(lead.id, cur);
    }
    let arr = Array.from(map.values()).sort((a, b) => new Date(b.msgs[0].created_at).getTime() - new Date(a.msgs[0].created_at).getTime());
    if (q.trim()) {
      const needle = q.toLowerCase();
      arr = arr.filter(({ lead, msgs }) =>
        lead.name.toLowerCase().includes(needle) ||
        (lead.company ?? "").toLowerCase().includes(needle) ||
        msgs.some((m) => (m.content ?? "").toLowerCase().includes(needle)),
      );
    }
    return arr;
  }, [messages, leadMap, q]);

  const activeGroup = grouped.find((g) => g.lead.id === activeLeadId) ?? grouped[0];

  return (
    <>
      <PageHeader
        title="Lead logs"
        description="Every chat message linked to a lead, grouped and searchable."
      />
      <div className="p-4 md:p-6 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <aside className="surface p-2 h-[calc(100vh-220px)] flex flex-col">
          <div className="relative px-2 pt-1 pb-2">
            <Search className="absolute left-4 top-3.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads or messages" className="pl-8 h-9 text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            {grouped.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-10">No lead-linked messages yet. Tag a message in Chat with a lead to see it here.</div>
            ) : grouped.map(({ lead, msgs }) => {
              const last = msgs[0];
              const sender = profileMap.get(last.sender_id);
              const accent = STAGE_ACCENT[lead.stage as StageKey];
              const isActive = activeGroup?.lead.id === lead.id;
              return (
                <button
                  key={lead.id}
                  onClick={() => setActiveLeadId(lead.id)}
                  className={"w-full text-left p-2.5 rounded-lg mb-1 transition-colors " + (isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60")}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + accent.dot} />
                    <span className="text-sm font-medium truncate flex-1">{lead.name}</span>
                    <span className="text-[10px] tabular text-muted-foreground shrink-0">{formatDistanceToNow(new Date(last.created_at), { addSuffix: false })}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground truncate pl-3.5">
                    <span className="font-medium">{sender?.name ?? "…"}:</span> {last.content ?? "attachment"}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 pl-3.5">
                    <span className={"text-[10px] rounded-full px-1.5 py-0.5 " + accent.bg + " " + accent.text}>{accent.label}</span>
                    {(lead as any).custom_status && (
                      <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 inline-flex items-center gap-0.5">
                        <Tag className="h-2.5 w-2.5" />{(lead as any).custom_status}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{msgs.length} msg{msgs.length > 1 ? "s" : ""}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="surface p-4 h-[calc(100vh-220px)] overflow-y-auto">
          {!activeGroup ? (
            <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">
              <div>
                <MessagesSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Select a lead to see its full chat log.
              </div>
            </div>
          ) : (
            <ActiveThread group={activeGroup} profileMap={profileMap} />
          )}
        </section>
      </div>
    </>
  );
}

function ActiveThread({ group, profileMap }: { group: { lead: Lead; msgs: Message[] }; profileMap: Map<string, Profile> }) {
  const accent = STAGE_ACCENT[group.lead.stage as StageKey];
  const sortedAsc = [...group.msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return (
    <div>
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-hairline">
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{group.lead.name}</div>
          {group.lead.company && <div className="text-xs text-muted-foreground truncate">{group.lead.company}</div>}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={"inline-flex items-center gap-1 rounded-full ring-1 px-2 py-0.5 text-[10px] font-semibold " + accent.bg + " " + accent.text + " " + accent.ring}>
              <span className={"h-1.5 w-1.5 rounded-full " + accent.dot} />
              {accent.label}
            </span>
            {(group.lead as any).custom_status && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5">
                <Tag className="h-3 w-3" />{(group.lead as any).custom_status}
              </span>
            )}
          </div>
        </div>
        <Link to="/leads" search={{ q: group.lead.name, stage: "all", owner: "all" }} className="text-xs text-primary hover:underline shrink-0">Open lead →</Link>
      </div>
      <div className="space-y-3 pt-4">
        {sortedAsc.map((m) => {
          const sender = profileMap.get(m.sender_id);
          return (
            <div key={m.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                {sender?.avatar_url && <AvatarImage src={sender.avatar_url} />}
                <AvatarFallback className="text-[10px]"><UserIcon className="h-3 w-3" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{sender?.name ?? "Unknown"}</span>
                  <span className="text-[10px] tabular text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                </div>
                {m.content && <div className="text-sm mt-0.5 whitespace-pre-wrap break-words">{m.content}</div>}
                {(m as any).attachment_url && (
                  <a href={(m as any).attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">Attachment</a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}