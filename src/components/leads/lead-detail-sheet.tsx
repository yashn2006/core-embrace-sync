import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, XCircle, Pencil, Building2, Mail, Phone, Calendar, User } from "lucide-react";
import { formatCurrency, updateLead, type Lead, type Profile } from "@/lib/leads";
import { STAGE_LABEL, STAGES, type StageKey } from "@/lib/constants";
import { ActivityTimeline } from "./activity-timeline";
import { LeadChatPanel } from "./lead-chat-panel";
import { WonDialog, LostDialog } from "./won-lost-dialog";
import { QuickStatusBar } from "./quick-status-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logActivity } from "@/lib/leads";
import { useAuth } from "@/hooks/use-auth";

export function LeadDetailSheet({
  lead,
  profiles,
  onClose,
  onEdit,
  onChanged,
}: {
  lead: Lead | null;
  profiles: Profile[];
  onClose: () => void;
  onEdit: (l: Lead) => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  if (!lead) return null;
  const owner = profiles.find((p) => p.id === lead.assigned_to);
  const creator = profiles.find((p) => p.id === lead.created_by);

  async function moveStage(next: StageKey) {
    if (next === "won") { setWonOpen(true); return; }
    if (next === "lost") { setLostOpen(true); return; }
    try {
      await updateLead(lead!.id, { stage: next });
      await logActivity({ lead_id: lead!.id, type: "note", outcome: `stage → ${STAGE_LABEL[next]}`, created_by: user!.id });
      toast.success("Stage updated");
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <Sheet open={!!lead} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <div className="p-6 border-b border-hairline">
            <SheetHeader className="text-left mb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl">{lead.name}</SheetTitle>
                  {lead.company && <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><Building2 className="h-3.5 w-3.5" />{lead.company}</div>}
                </div>
                <Button size="sm" variant="outline" onClick={() => onEdit(lead)}><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" />{STAGE_LABEL[lead.stage as StageKey]}</Badge>
                {lead.deal_value != null && <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-transparent tabular">{formatCurrency(lead.deal_value)}</Badge>}
                <Badge variant="outline" className="capitalize">{lead.source.replace("_", " ")}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {lead.email && <InfoRow icon={Mail} label="Email" value={lead.email} />}
                {lead.phone && <InfoRow icon={Phone} label="Phone" value={lead.phone} />}
                {owner && <InfoRow icon={User} label="Owner" value={owner.name} />}
                {creator && creator.id !== owner?.id && <InfoRow icon={User} label="Sourced by" value={creator.name} />}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Move to</div>
                <Select value={lead.stage} onValueChange={(v) => moveStage(v as StageKey)}>
                  <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="ml-auto text-primary" onClick={() => setWonOpen(true)}><Trophy className="h-3.5 w-3.5 mr-1" />Won</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setLostOpen(true)}><XCircle className="h-3.5 w-3.5 mr-1" />Lost</Button>
              </div>
            </SheetHeader>
          </div>

          <div className="p-6">
            <Tabs defaultValue="timeline">
              <TabsList>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="mt-4 space-y-4">
                <QuickStatusBar leadId={lead.id} onDone={onChanged} />
                <ActivityTimeline leadId={lead.id} profiles={profiles} />
              </TabsContent>
              <TabsContent value="chat" className="mt-4">
                <LeadChatPanel leadId={lead.id} leadName={lead.name} profiles={profiles} />
              </TabsContent>
              <TabsContent value="details" className="mt-4 space-y-3 text-sm">
                <DetailLine k="Description" v={lead.description ?? "—"} />
                <DetailLine k="Next follow-up" v={lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "—"} />
                <DetailLine k="Created" v={new Date(lead.created_at).toLocaleString()} />
                <DetailLine k="Updated" v={new Date(lead.updated_at).toLocaleString()} />
                {lead.won_at && <DetailLine k="Won at" v={new Date(lead.won_at).toLocaleString()} />}
                {lead.lost_at && <DetailLine k="Lost at" v={new Date(lead.lost_at).toLocaleString()} />}
                {lead.handoff_note && <DetailLine k="Handoff note" v={lead.handoff_note} />}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
      <WonDialog open={wonOpen} onOpenChange={setWonOpen} lead={lead} onDone={onChanged} />
      <LostDialog open={lostOpen} onOpenChange={setLostOpen} lead={lead} onDone={onChanged} />
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function DetailLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground pt-0.5">{k}</div>
      <div className="text-sm whitespace-pre-wrap">{v}</div>
    </div>
  );
}