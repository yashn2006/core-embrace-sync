import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Plus, Calendar, Clock, Users2, X, Copy, CalendarPlus, Pencil, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { scheduleMeeting, cancelMeeting, updateMeeting, completeMeeting } from "@/lib/meetings.functions";
import { toast } from "sonner";
import { MeetingRoom } from "@/components/meetings/meeting-room";
import { downloadIcs } from "@/lib/ics";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "Meetings — CoreEgin Sales OS" }] }),
  component: MeetingsPage,
});

interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  lead_id: string | null;
  scheduled_by: string;
  start_at: string;
  end_at: string;
  daily_room_url: string | null;
  status: string;
  attendees: { user_id: string; profile: { name: string; avatar_url: string | null } | null }[];
  lead: { name: string } | null;
  host: { name: string; avatar_url: string | null } | null;
}

interface Prof { id: string; name: string; email: string; avatar_url: string | null }
interface Lead { id: string; name: string; company: string | null }

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingsPage() {
  const { user, displayName } = useAuth();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState<MeetingRow | null>(null);
  const [rescheduling, setRescheduling] = useState<MeetingRow | null>(null);
  const [completing, setCompleting] = useState<MeetingRow | null>(null);
  const scheduleFn = useServerFn(scheduleMeeting);
  const cancelFn = useServerFn(cancelMeeting);
  const updateFn = useServerFn(updateMeeting);
  const completeFn = useServerFn(completeMeeting);

  async function refresh() {
    setLoading(true);
    const [{ data: ms }, { data: profs }, { data: lds }] = await Promise.all([
      supabase
        .from("meetings")
        .select("id,title,description,lead_id,scheduled_by,start_at,end_at,daily_room_url,status")
        .order("start_at", { ascending: true }),
      supabase.from("profiles").select("id,name,email,avatar_url").eq("is_active", true),
      supabase.from("leads").select("id,name,company").order("name"),
    ]);
    const meetingIds = (ms ?? []).map((m) => m.id);
    const { data: atts } = meetingIds.length
      ? await supabase.from("meeting_attendees").select("meeting_id,user_id").in("meeting_id", meetingIds)
      : { data: [] as { meeting_id: string; user_id: string }[] };
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    const lmap = new Map((lds ?? []).map((l) => [l.id, l]));
    const attByMeeting = new Map<string, { user_id: string; profile: Prof | null }[]>();
    (atts ?? []).forEach((a) => {
      const arr = attByMeeting.get(a.meeting_id) ?? [];
      arr.push({ user_id: a.user_id, profile: pmap.get(a.user_id) ?? null });
      attByMeeting.set(a.meeting_id, arr);
    });
    setMeetings(
      (ms ?? []).map((m) => ({
        ...m,
        attendees: attByMeeting.get(m.id) ?? [],
        lead: m.lead_id ? { name: lmap.get(m.lead_id)?.name ?? "Lead" } : null,
        host: pmap.get(m.scheduled_by) ?? null,
      })),
    );
    setProfiles(profs ?? []);
    setLeads(lds ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("meetings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const now = Date.now();
  const upcoming = useMemo(
    () => meetings.filter((m) => m.status !== "cancelled" && new Date(m.end_at).getTime() > now - 30 * 60_000),
    [meetings, now],
  );
  const past = useMemo(
    () => meetings.filter((m) => m.status === "cancelled" || new Date(m.end_at).getTime() <= now - 30 * 60_000).slice(0, 20),
    [meetings, now],
  );

  async function onCancel(id: string) {
    if (!confirm("Cancel this meeting? The video room will be deleted.")) return;
    try {
      await cancelFn({ data: { meeting_id: id } });
      toast.success("Meeting cancelled");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Meetings"
        title="Video calls & scheduling"
        description="Schedule HD video meetings with your team or with leads. Powered by Daily.co."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2" style={{ background: "var(--gradient-magenta)" }}>
            <Plus className="h-4 w-4" /> New meeting
          </Button>
        }
      />

      <div className="px-6 md:px-8 py-6 space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</h2>
            <span className="text-xs text-muted-foreground tabular">({upcoming.length})</span>
          </div>
          {loading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-card/40 p-10 text-center text-sm text-muted-foreground">
              No upcoming meetings. Click <span className="text-foreground">New meeting</span> to schedule one.
            </div>
          ) : (
            <div className="grid gap-3">
              {upcoming.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                currentUserId={user?.id ?? ""}
                onJoin={() => setJoining(m)}
                onCancel={() => onCancel(m.id)}
                onReschedule={() => setRescheduling(m)}
                onIcs={() => downloadFor(m)}
              />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Past</h2>
            <div className="grid gap-3">
              {past.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                currentUserId={user?.id ?? ""}
                onJoin={() => setJoining(m)}
                onCancel={() => onCancel(m.id)}
                onReschedule={() => setRescheduling(m)}
                onIcs={() => downloadFor(m)}
                onComplete={m.status !== "cancelled" && m.status !== "completed" ? () => setCompleting(m) : undefined}
                isPast
              />
              ))}
            </div>
          </section>
        )}
      </div>

      <ScheduleDialog
        open={open}
        onOpenChange={setOpen}
        profiles={profiles.filter((p) => p.id !== user?.id)}
        leads={leads}
        onSubmit={async (payload) => {
          try {
            await scheduleFn({ data: payload });
            toast.success("Meeting scheduled — video room ready");
            setOpen(false);
            refresh();
          } catch (e: any) {
            toast.error(e?.message ?? "Failed to schedule");
          }
        }}
      />

      {joining && (
        <MeetingRoom meeting={joining} userName={displayName} onLeave={() => setJoining(null)} />
      )}

      <RescheduleDialog
        meeting={rescheduling}
        onClose={() => setRescheduling(null)}
        onSubmit={async (payload) => {
          try {
            await updateFn({ data: payload });
            toast.success("Meeting updated — attendees notified");
            setRescheduling(null);
            refresh();
          } catch (e: any) { toast.error(e?.message ?? "Failed to update"); }
        }}
      />

      <CompleteDialog
        meeting={completing}
        onClose={() => setCompleting(null)}
        onSubmit={async (payload) => {
          try {
            await completeFn({ data: payload });
            toast.success("Meeting notes saved to lead timeline");
            setCompleting(null);
            refresh();
          } catch (e: any) { toast.error(e?.message ?? "Failed to save"); }
        }}
      />
    </div>
  );

  function downloadFor(m: MeetingRow) {
    downloadIcs({
      uid: m.id,
      title: m.title,
      description: [m.description, m.daily_room_url ? `Join: ${m.daily_room_url}` : null].filter(Boolean).join("\n\n"),
      location: m.daily_room_url ?? undefined,
      startISO: m.start_at,
      endISO: m.end_at,
      url: m.daily_room_url,
    });
    toast.success("Calendar file downloaded");
  }
}

function MeetingCard({ m, currentUserId, onJoin, onCancel, onReschedule, onIcs, onComplete, isPast }: {
  m: MeetingRow;
  currentUserId: string;
  onJoin: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onIcs: () => void;
  onComplete?: () => void;
  isPast?: boolean;
}) {
  const start = new Date(m.start_at);
  const end = new Date(m.end_at);
  const now = Date.now();
  const canJoin = !isPast && m.status !== "cancelled" && now >= start.getTime() - 10 * 60_000 && now <= end.getTime() + 30 * 60_000;
  const isHost = m.scheduled_by === currentUserId;
  const dateStr = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeStr = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

  return (
    <div className="group relative rounded-xl border border-hairline bg-card/60 hover:bg-card/80 backdrop-blur p-4 transition-colors">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-lg flex items-center justify-center text-white shadow-[var(--shadow-glow)]"
          style={{ background: m.status === "cancelled" ? "hsl(var(--muted))" : "var(--gradient-magenta)" }}>
          <Video className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{m.title}</h3>
            {m.status === "cancelled" && <Badge variant="outline" className="text-[10px]">Cancelled</Badge>}
            {m.lead && <Badge variant="secondary" className="text-[10px]">Lead: {m.lead.name}</Badge>}
          </div>
          {m.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 tabular"><Calendar className="h-3.5 w-3.5" />{dateStr}</span>
            <span className="inline-flex items-center gap-1 tabular"><Clock className="h-3.5 w-3.5" />{timeStr}</span>
            <span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />{m.attendees.length} attendee{m.attendees.length === 1 ? "" : "s"}</span>
          </div>
          {m.attendees.length > 0 && (
            <div className="mt-2 flex -space-x-2">
              {m.attendees.slice(0, 6).map((a) => (
                <div key={a.user_id} title={a.profile?.name ?? "?"} className="h-6 w-6 rounded-full border-2 border-background bg-muted overflow-hidden flex items-center justify-center text-[10px] font-semibold">
                  {a.profile?.avatar_url ? <img src={a.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (a.profile?.name?.[0] ?? "?").toUpperCase()}
                </div>
              ))}
              {m.attendees.length > 6 && <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px]">+{m.attendees.length - 6}</div>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {m.daily_room_url && !isPast && m.status !== "cancelled" && (
            <Button onClick={onJoin} disabled={!canJoin} size="sm" className="gap-1.5" style={canJoin ? { background: "var(--gradient-magenta)" } : undefined}>
              <Video className="h-3.5 w-3.5" /> {canJoin ? "Join" : "Not yet"}
            </Button>
          )}
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {m.daily_room_url && (
              <button
                onClick={() => { navigator.clipboard.writeText(m.daily_room_url!); toast.success("Link copied"); }}
                className="hover:text-foreground inline-flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            )}
            <button onClick={onIcs} className="hover:text-foreground inline-flex items-center gap-1">
              <CalendarPlus className="h-3 w-3" /> .ics
            </button>
            {isHost && m.status !== "cancelled" && (
              <button onClick={onReschedule} className="hover:text-foreground inline-flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
            {isHost && m.status !== "cancelled" && !isPast && (
              <button onClick={onCancel} className="hover:text-destructive inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Cancel
              </button>
            )}
            {onComplete && (
              <button onClick={onComplete} className="hover:text-primary inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Notes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleDialog({ open, onOpenChange, profiles, leads, onSubmit }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Prof[];
  leads: Lead[];
  onSubmit: (p: { title: string; description?: string; lead_id?: string | null; start_at: string; end_at: string; attendee_ids: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState<string>("none");
  const [start, setStart] = useState(() => {
    const d = new Date(Math.ceil(Date.now() / (15 * 60_000)) * 15 * 60_000);
    return toLocalInput(d);
  });
  const [duration, setDuration] = useState("30");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) { setTitle(""); setDescription(""); setLeadId("none"); setAttendees([]); setDuration("30"); } }, [open]);

  async function submit() {
    if (!title.trim()) { toast.error("Title required"); return; }
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + parseInt(duration, 10) * 60_000);
    setSaving(true);
    try {
      await onSubmit({
        title,
        description: description.trim() || undefined,
        lead_id: leadId === "none" ? null : leadId,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        attendee_ids: attendees,
      });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Schedule a video meeting</DialogTitle>
          <DialogDescription>An HD video room is created automatically. Share the join link with clients.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Discovery call with Acme" autoFocus />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Agenda, questions, links…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Link to lead (optional)</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}{l.company ? ` · ${l.company}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Invite team</Label>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-hairline divide-y divide-hairline">
              {profiles.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">No teammates yet.</div>
              ) : profiles.map((p) => {
                const checked = attendees.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/40">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setAttendees(e.target.checked ? [...attendees, p.id] : attendees.filter((x) => x !== p.id))}
                      className="accent-primary"
                    />
                    <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px] font-semibold">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : p.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{p.email}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">You're added automatically as the host.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} style={{ background: "var(--gradient-magenta)" }}>
            {saving ? "Creating room…" : "Schedule & create room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}