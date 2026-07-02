import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff, Users, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { listLeads, listProfiles, updateLead, logActivity, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGES, ACTIVE_STAGES, STAGE_ACCENT, STAGE_LABEL, type StageKey } from "@/lib/constants";
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
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [detail, setDetail] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pendingWon, setPendingWon] = useState<Lead | null>(null);
  const [pendingLost, setPendingLost] = useState<Lead | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [repFilter, setRepFilter] = useState<string>("all"); // owner-only: 'all' | 'unassigned' | <userId>
  const [q, setQ] = useState("");
  const [cstatus, setCstatus] = useState<"any" | "with" | "without">("any");
  const [vmin, setVmin] = useState("");
  const [pmin, setPmin] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function refresh() {
    try {
      const [l, p] = await Promise.all([listLeads(), listProfiles()]);
      setLeads(l); setProfiles(p);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  // Keep top/bottom scroll bars in sync and measure content width for the proxy.
  useEffect(() => {
    const top = topScrollRef.current, bottom = bottomScrollRef.current;
    if (!top || !bottom) return;
    const syncFromTop = () => { bottom.scrollLeft = top.scrollLeft; };
    const syncFromBottom = () => { top.scrollLeft = bottom.scrollLeft; };
    top.addEventListener("scroll", syncFromTop, { passive: true });
    bottom.addEventListener("scroll", syncFromBottom, { passive: true });
    const measure = () => setContentWidth(bottom.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bottom);
    return () => {
      top.removeEventListener("scroll", syncFromTop);
      bottom.removeEventListener("scroll", syncFromBottom);
      ro.disconnect();
    };
  }, [leads.length]);

  const filteredLeads = useMemo(() => {
    const t = q.trim().toLowerCase();
    const vm = vmin ? Number(vmin) : null;
    const pm = pmin ? Number(pmin) : null;
    return leads.filter((l) => {
      if (isOwner && repFilter !== "all") {
        if (repFilter === "unassigned" ? !!l.assigned_to : l.assigned_to !== repFilter) return false;
      }
      if (vm != null && (l.deal_value ?? 0) < vm) return false;
      if (pm != null && ((l as any).progress ?? 0) < pm) return false;
      const cs = (l as any).custom_status;
      if (cstatus === "with" && !cs) return false;
      if (cstatus === "without" && cs) return false;
      if (t && ![l.name, l.company, l.email, l.description].some((v) => v?.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [leads, isOwner, repFilter, q, cstatus, vmin, pmin]);

  const advCount = (cstatus !== "any" ? 1 : 0) + (vmin ? 1 : 0) + (pmin ? 1 : 0);

  const grouped = useMemo(() => {
    const map = new Map<StageKey, Lead[]>();
    STAGES.forEach((s) => map.set(s.key, []));
    filteredLeads.forEach((l) => map.get(l.stage as StageKey)?.push(l));
    return map;
  }, [filteredLeads]);

  const reps = useMemo(() => profiles.filter((p) => p.is_active !== false), [profiles]);
  const repCounts = useMemo(() => {
    const m = new Map<string, number>();
    let unassigned = 0;
    leads.forEach((l) => {
      if (!l.assigned_to) unassigned++;
      else m.set(l.assigned_to, (m.get(l.assigned_to) ?? 0) + 1);
    });
    return { m, unassigned };
  }, [leads]);

  const visibleStages = showClosed ? STAGES : ACTIVE_STAGES;
  const wonCount = grouped.get("won")?.length ?? 0;
  const lostCount = grouped.get("lost")?.length ?? 0;

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
        description="Only active leads. Drag between stages — every move is logged."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8 w-[180px] text-xs" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 relative">
                  <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Filters</span>
                  {advCount > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[9px] font-semibold text-white flex items-center justify-center">{advCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3" align="end">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advanced filters</div>
                <div>
                  <Label className="text-[10px] uppercase">Deal value ≥</Label>
                  <Input type="number" placeholder="0" value={vmin} onChange={(e) => setVmin(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Progress ≥ (%)</Label>
                  <Input type="number" min={0} max={100} placeholder="0" value={pmin} onChange={(e) => setPmin(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Custom status</Label>
                  <Select value={cstatus} onValueChange={(v) => setCstatus(v as any)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="with">Has custom status</SelectItem>
                      <SelectItem value="without">No custom status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {advCount > 0 && (
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => { setCstatus("any"); setVmin(""); setPmin(""); }}>
                    <X className="h-3.5 w-3.5 mr-1" />Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            {isOwner && (
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reps ({leads.length})</SelectItem>
                  <SelectItem value="unassigned">Unassigned ({repCounts.unassigned})</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({repCounts.m.get(r.id) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowClosed((v) => !v)} className="hidden sm:inline-flex">
              {showClosed ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
              {showClosed ? "Hide closed" : `Show closed (${wonCount + lostCount})`}
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, lead: null })}><Plus className="h-4 w-4 mr-1.5" />New lead</Button>
          </div>
        }
      />
      <div className="p-4 md:p-6">
        {/* Top horizontal scrollbar proxy (mirrors the board below) */}
        <div ref={topScrollRef} className="overflow-x-auto overflow-y-hidden mb-2 h-3">
          <div style={{ width: contentWidth || "100%", height: 1 }} />
        </div>
        <div ref={bottomScrollRef} className="overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="flex gap-3 min-w-max pb-4">
            {visibleStages.map((s) => {
              const items = grouped.get(s.key) ?? [];
              const total = items.reduce((sum, l) => sum + (l.deal_value ?? 0), 0);
              return (
                <Column key={s.key} id={s.key} stageKey={s.key} label={s.label} count={items.length} total={total}>
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
      </div>

      <LeadDialog open={dialog.open} onOpenChange={(v) => setDialog({ open: v, lead: v ? dialog.lead : null })} lead={dialog.lead} profiles={profiles} isOwner={isOwner} onSaved={refresh} />
      <LeadDetailSheet lead={detail} profiles={profiles} onClose={() => setDetail(null)} onEdit={(l) => { setDetail(null); setDialog({ open: true, lead: l }); }} onChanged={refresh} />
      <WonDialog open={!!pendingWon} onOpenChange={(v) => !v && setPendingWon(null)} lead={pendingWon} onDone={refresh} />
      <LostDialog open={!!pendingLost} onOpenChange={(v) => !v && setPendingLost(null)} lead={pendingLost} onDone={refresh} />
    </>
  );
}

function Column({ id, stageKey, label, count, total, children }: { id: string; stageKey: StageKey; label: string; count: number; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const accent = STAGE_ACCENT[stageKey];
  const isClosed = stageKey === "won" || stageKey === "lost";
  return (
    <div className="w-72 shrink-0">
      <div className={"flex items-center justify-between mb-2 px-2 py-1.5 rounded-md ring-1 " + accent.bg + " " + accent.ring}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + accent.dot} />
          <div className={"text-[11px] uppercase tracking-wider font-semibold truncate " + accent.text}>{label}</div>
          <div className={"text-[10px] rounded-full px-1.5 py-0.5 tabular bg-white/70 " + accent.text}>{count}</div>
        </div>
        {total > 0 && <div className={"text-[10px] tabular font-medium " + accent.text}>{formatCurrency(total)}</div>}
      </div>
      <div ref={setNodeRef} className={"surface min-h-[500px] p-2 space-y-2 transition-colors " + (isOver ? "ring-2 ring-primary/40 bg-primary/5" : "") + (isClosed ? " opacity-70" : "")}>
        {children}
        {count === 0 && <div className="text-xs text-muted-foreground text-center py-10 opacity-70">{isClosed ? (stageKey === "won" ? "No wins yet" : "No losses") : "Drop here"}</div>}
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
  const accent = STAGE_ACCENT[lead.stage as StageKey];
  return (
    <div className={"relative rounded-lg border border-hairline bg-card p-3 hover:border-primary/30 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all " + (dragging ? "shadow-[var(--shadow-lift)] rotate-1" : "")}>
      <span className={"absolute left-0 top-2 bottom-2 w-0.5 rounded-r " + accent.dot} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{lead.name}</div>
          {lead.company && <div className="text-xs text-muted-foreground truncate">{lead.company}</div>}
        </div>
        {lead.deal_value != null && <div className="text-xs font-medium tabular text-primary shrink-0">{formatCurrency(lead.deal_value)}</div>}
      </div>
      {lead.custom_status && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium rounded-md bg-primary/10 text-primary px-1.5 py-0.5 max-w-full">
          <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
          <span className="truncate">{lead.custom_status}</span>
        </div>
      )}
      {typeof (lead as any).progress === "number" && (lead as any).progress > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(lead as any).progress}%`, background: "var(--gradient-magenta)" }} />
          </div>
          <span className="text-[9px] tabular text-muted-foreground">{(lead as any).progress}%</span>
        </div>
      )}
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