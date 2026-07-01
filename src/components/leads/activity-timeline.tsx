import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Phone, Mail, MessageCircle, CalendarDays, StickyNote, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/constants";
import { listActivitiesForLead, logActivity, type Activity, type Profile } from "@/lib/leads";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: CalendarDays,
  note: StickyNote,
};

export function ActivityTimeline({ leadId, profiles }: { leadId: string; profiles: Profile[] }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ActivityType>("call");
  const [outcome, setOutcome] = useState("");
  const [text, setText] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setItems(await listActivitiesForLead(leadId)); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [leadId]);

  async function submit() {
    if (!text.trim() && !outcome.trim()) { toast.error("Add an outcome or note"); return; }
    setSaving(true);
    try {
      await logActivity({ lead_id: leadId, type, outcome: outcome || null, response_text: text || null, next_action: next || null, created_by: user!.id });
      setOutcome(""); setText(""); setNext("");
      await refresh();
      toast.success("Activity logged");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "Someone";

  return (
    <div className="space-y-4">
      <div className="surface p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Log activity</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Outcome</Label>
            <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. interested, no answer" />
          </div>
        </div>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did they say?" />
        <div className="flex items-center gap-2">
          <Input className="flex-1" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Next action (optional)" />
          <Button size="sm" onClick={submit} disabled={saving}><Send className="h-3.5 w-3.5 mr-1" />{saving ? "…" : "Log"}</Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-muted-foreground italic py-8 text-center">No activity yet — log the first touch above.</div>
        )}
        {items.map((a) => {
          const Icon = ICONS[a.type as ActivityType] ?? StickyNote;
          return (
            <div key={a.id} className="flex gap-3 group">
              <div className="mt-0.5 h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0 border-l border-hairline pl-4 -ml-4 pb-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{nameOf(a.created_by)}</span>{" "}
                    <span className="text-muted-foreground">logged {a.type}</span>
                    {a.outcome && <span className="text-primary"> · {a.outcome}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular shrink-0">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
                {a.response_text && <div className="text-sm text-foreground/80 mt-1">{a.response_text}</div>}
                {a.next_action && <div className="text-xs text-muted-foreground mt-1">→ {a.next_action}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}