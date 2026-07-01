import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { listLeads, listProfiles, updateLead, logActivity, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGES, STAGE_LABEL, type StageKey } from "@/lib/constants";
import { LeadDialog } from "@/components/leads/lead-dialog";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { WonDialog, LostDialog } from "@/components/leads/won-lost-dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — CoreEgin Sales OS" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const { role, user } = useAuth();
  const isOwner = role === "owner";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [detail, setDetail] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pendingWon, setPendingWon] = useState<Lead | null>(null);
  const [pendingLost, setPendingLost] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function refresh() {
    try {
      const [l, p] = await Promise.all([listLeads(), listProfiles()]);
      setLeads(l); setProfiles(p);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<StageKey, Lead[]>();
    STAGES.forEach((s) => map.set(s.key, []));
    leads.forEach((l) => map.get(l.stage as StageKey)?.push(l));
    return map;
  }, [leads]);

  async function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const leadId = String(e.active.id);
    const nextStage = e.over?.id as StageKey | undefined;
    if (!nextStage) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === nextStage) return;

    if (nextStage === "won") { setPendingWon(lead); return; }
    if (nextStage === "lost") { setPendingLost(lead); return; }

    // optimistic
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: nextStage } : l)));
    try {
      await updateLead(leadId, { stage: nextStage });
      await logActivity({ lead_id: leadId, type: "note", outcome: `stage → ${STAGE_LABEL[nextStage]}`, created_by: user!.id });
    } catch (e: any) {
      toast.error(e.message);
      refresh();
    }
  }

  const activeLead = leads.find((l) => l.id === dragId);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag cards between stages. Every move is logged."
        actions={<Button size="sm" onClick={() => setDialog({ open: true, lead: null })}><Plus className="h-4 w-4 mr-1.5" />New lead</Button>}
      />
      <div className="p-4 md:p-6 overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="flex gap-3 min-w-max pb-4">
            {STAGES.map((s) => {
              const items = grouped.get(s.key) ?? [];
              const total = items.reduce((sum, l) => sum + (l.deal_value ?? 0), 0);
              return (
                <Column key={s.key} id={s.key} label={s.label} count={items.length} total={total}>
                  {items.map((l) => (
                    <DraggableCard key={l.id} lead={l} profiles={profiles} onClick={() => setDetail(l)} />
                  ))}
                </Column>
              );
            })}
          </div>
          <DragOverlay>
            {activeLead && <Card lead={activeLead} profiles={profiles} dragging />}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadDialog open={dialog.open} onOpenChange={(v) => setDialog({ open: v, lead: v ? dialog.lead : null })} lead={dialog.lead} profiles={profiles} isOwner={isOwner} onSaved={refresh} />
      <LeadDetailSheet lead={detail} profiles={profiles} onClose={() => setDetail(null)} onEdit={(l) => { setDetail(null); setDialog({ open: true, lead: l }); }} onChanged={refresh} />
      <WonDialog open={!!pendingWon} onOpenChange={(v) => !v && setPendingWon(null)} lead={pendingWon} onDone={refresh} />
      <LostDialog open={!!pendingLost} onOpenChange={(v) => !v && setPendingLost(null)} lead={pendingLost} onDone={refresh} />
    </>
  );
}

function Column({ id, label, count, total, children }: { id: string; label: string; count: number; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1.5">
        <div className="flex items-center gap-2">
          <div className="text-xs uppercase tracking-wider font-medium">{label}</div>
          <div className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 tabular text-muted-foreground">{count}</div>
        </div>
        {total > 0 && <div className="text-[10px] tabular text-muted-foreground">{formatCurrency(total)}</div>}
      </div>
      <div ref={setNodeRef} className={"surface min-h-[500px] p-2 space-y-2 transition-colors " + (isOver ? "ring-2 ring-primary/40 bg-primary/5" : "")}>
        {children}
        {count === 0 && <div className="text-xs text-muted-foreground text-center py-10 opacity-70">Drop here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ lead, profiles, onClick }: { lead: Lead; profiles: Profile[]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onClick} className={isDragging ? "opacity-30" : ""}>
      <Card lead={lead} profiles={profiles} />
    </div>
  );
}

function Card({ lead, profiles, dragging }: { lead: Lead; profiles: Profile[]; dragging?: boolean }) {
  const owner = profiles.find((p) => p.id === lead.assigned_to);
  return (
    <div className={"rounded-lg border border-hairline bg-card p-3 hover:border-primary/30 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all " + (dragging ? "shadow-[var(--shadow-lift)] rotate-1" : "")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{lead.name}</div>
          {lead.company && <div className="text-xs text-muted-foreground truncate">{lead.company}</div>}
        </div>
        {lead.deal_value != null && <div className="text-xs font-medium tabular text-primary shrink-0">{formatCurrency(lead.deal_value)}</div>}
      </div>
      {owner && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white" style={{ background: "var(--gradient-magenta)" }}>
            {owner.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{owner.name}</div>
        </div>
      )}
    </div>
  );
}