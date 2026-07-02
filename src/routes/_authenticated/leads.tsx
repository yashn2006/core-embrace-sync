import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Upload, X, UserCheck, Sparkles, SlidersHorizontal, KanbanSquare, Undo2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { listLeads, listProfiles, deleteLead, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGE_LABEL, STAGES, STAGE_ACCENT, type StageKey } from "@/lib/constants";
import { scoreLead, HEAT_STYLE } from "@/lib/lead-scoring";
import { LeadDialog } from "@/components/leads/lead-dialog";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { CsvImportDialog } from "@/components/leads/csv-import-dialog";
import { BulkAssignDialog } from "@/components/leads/bulk-assign-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  stage: fallback(z.string(), "all").default("all"),
  owner: fallback(z.string(), "all").default("all"),
  vmin: fallback(z.string(), "").default(""),
  vmax: fallback(z.string(), "").default(""),
  pmin: fallback(z.string(), "").default(""),
  cstatus: fallback(z.string(), "any").default("any"), // any | with | without
  sort: fallback(z.string(), "updated").default("updated"), // updated | value | progress | name
});

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — CoreEgin Sales OS" }] }),
  validateSearch: zodValidator(searchSchema),
  component: LeadsPage,
});

function LeadsPage() {
  const { role } = useAuth();
  const isOwner = role === "owner";
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [detail, setDetail] = useState<Lead | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStage, setBulkStage] = useState<string>("");

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: { q: string; stage: string; owner: string }) => ({ ...prev, ...patch }), replace: true });

  async function refresh() {
    setLoading(true);
    try {
      const [l, p] = await Promise.all([listLeads(), listProfiles()]);
      setLeads(l); setProfiles(p);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const t = search.q.trim().toLowerCase();
    const vmin = search.vmin ? Number(search.vmin) : null;
    const vmax = search.vmax ? Number(search.vmax) : null;
    const pmin = search.pmin ? Number(search.pmin) : null;
    const arr = leads.filter((l) => {
      if (search.stage !== "all" && l.stage !== search.stage) return false;
      if (search.owner !== "all" && l.assigned_to !== search.owner) return false;
      if (vmin != null && (l.deal_value ?? 0) < vmin) return false;
      if (vmax != null && (l.deal_value ?? 0) > vmax) return false;
      const prog = (l as any).progress ?? 0;
      if (pmin != null && prog < pmin) return false;
      const cs = (l as any).custom_status;
      if (search.cstatus === "with" && !cs) return false;
      if (search.cstatus === "without" && cs) return false;
      if (t && ![l.name, l.company, l.email, l.phone, l.description].some((v) => v?.toLowerCase().includes(t))) return false;
      return true;
    });
    const s = search.sort;
    arr.sort((a, b) => {
      if (s === "value") return (b.deal_value ?? 0) - (a.deal_value ?? 0);
      if (s === "progress") return (((b as any).progress ?? 0) - ((a as any).progress ?? 0));
      if (s === "name") return a.name.localeCompare(b.name);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return arr;
  }, [leads, search]);

  const advCount = (search.vmin ? 1 : 0) + (search.vmax ? 1 : 0) + (search.pmin ? 1 : 0) + (search.cstatus !== "any" ? 1 : 0) + (search.sort !== "updated" ? 1 : 0);
  const activeFilters = (search.stage !== "all" ? 1 : 0) + (search.owner !== "all" ? 1 : 0) + (search.q ? 1 : 0) + advCount;
  const unassignedCount = useMemo(() => leads.filter((l) => !l.assigned_to).length, [leads]);

  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "—";

  async function handleDelete(l: Lead) {
    if (!confirm(`Delete "${l.name}"?`)) return;
    try { await deleteLead(l.id); toast.success("Deleted"); refresh(); } catch (e: any) { toast.error(e.message); }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }

  async function bulkReassign() {
    if (!bulkAssignee || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const before = leads.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, assigned_to: l.assigned_to }));
      const { error } = await supabase.from("leads").update({ assigned_to: bulkAssignee }).in("id", ids);
      if (error) throw error;
      toast.success(`Reassigned ${ids.length} lead${ids.length === 1 ? "" : "s"} to ${nameOf(bulkAssignee)}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await Promise.all(before.map((b) => supabase.from("leads").update({ assigned_to: b.assigned_to }).eq("id", b.id)));
              toast.success("Undone");
              refresh();
            } catch (e: any) { toast.error(e.message); }
          },
        },
        duration: 8000,
      });
      setSelected(new Set()); setBulkAssignee(""); refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBulkBusy(false); }
  }
  async function bulkChangeStage() {
    if (!bulkStage || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const before = leads.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, stage: l.stage }));
      const { error } = await supabase.from("leads").update({ stage: bulkStage as any }).in("id", ids);
      if (error) throw error;
      toast.success(`Moved ${ids.length} lead${ids.length === 1 ? "" : "s"} to ${STAGE_LABEL[bulkStage as StageKey] ?? bulkStage}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await Promise.all(before.map((b) => supabase.from("leads").update({ stage: b.stage }).eq("id", b.id)));
              toast.success("Undone");
              refresh();
            } catch (e: any) { toast.error(e.message); }
          },
        },
        duration: 8000,
      });
      setSelected(new Set()); setBulkStage(""); refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBulkBusy(false); }
  }
  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
      toast.success(`Deleted ${ids.length} lead${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set()); refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBulkBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description={isOwner ? "Every lead in the org. Assign, edit, work them." : "Your leads. Add, work, close."}
        actions={
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <UserCheck className="h-4 w-4 mr-1.5" />Assign to rep
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />Import CSV/Excel
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, lead: null })}>
              <Plus className="h-4 w-4 mr-1.5" />New lead
            </Button>
          </div>
        }
      />
      <div className="p-6 md:p-8 space-y-4">
        {isOwner && unassignedCount > 0 && (
          <div className="surface p-3 flex items-center gap-3 animate-fade-in">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-magenta)" }}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 text-sm">
              <b className="tabular">{unassignedCount}</b> unassigned lead{unassignedCount === 1 ? "" : "s"} waiting to be handed to a rep.
              <span className="text-muted-foreground"> Bulk-assign them so they show up in a rep's pipeline.</span>
            </div>
            <Button size="sm" onClick={() => setAssignOpen(true)}>Assign now</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, company, email, notes…" value={search.q} onChange={(e) => setSearch({ q: e.target.value })} />
          </div>
          <Select value={search.stage} onValueChange={(v) => setSearch({ stage: v })}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isOwner && (
            <Select value={search.owner} onValueChange={(v) => setSearch({ owner: v })}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 relative">
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />More filters
                {advCount > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[9px] font-semibold text-white flex items-center justify-center">{advCount}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3" align="end">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advanced</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Value ≥</Label>
                  <Input type="number" placeholder="0" value={search.vmin} onChange={(e) => setSearch({ vmin: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Value ≤</Label>
                  <Input type="number" placeholder="∞" value={search.vmax} onChange={(e) => setSearch({ vmax: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Progress ≥ (%)</Label>
                <Input type="number" min={0} max={100} placeholder="0" value={search.pmin} onChange={(e) => setSearch({ pmin: e.target.value })} />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Custom status</Label>
                <Select value={search.cstatus} onValueChange={(v) => setSearch({ cstatus: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="with">Has custom status</SelectItem>
                    <SelectItem value="without">No custom status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Sort by</Label>
                <Select value={search.sort} onValueChange={(v) => setSearch({ sort: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Recently updated</SelectItem>
                    <SelectItem value="value">Deal value (high → low)</SelectItem>
                    <SelectItem value="progress">Progress (high → low)</SelectItem>
                    <SelectItem value="name">Name (A → Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {advCount > 0 && (
                <Button size="sm" variant="ghost" className="w-full" onClick={() => setSearch({ vmin: "", vmax: "", pmin: "", cstatus: "any", sort: "updated" })}>
                  <X className="h-3.5 w-3.5 mr-1" />Clear advanced
                </Button>
              )}
            </PopoverContent>
          </Popover>
          {activeFilters > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSearch({ q: "", stage: "all", owner: "all", vmin: "", vmax: "", pmin: "", cstatus: "any", sort: "updated" })}>
              <X className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground tabular whitespace-nowrap">{filtered.length} of {leads.length}</div>
        </div>

        {isOwner && selected.size > 0 && (
          <div className="surface p-3 flex flex-wrap items-center gap-2 animate-fade-in border-primary/40 ring-1 ring-primary/20">
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-0">{selected.size} selected</Badge>
            <span className="text-xs text-muted-foreground">Reassign to</span>
            <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Pick a rep" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={bulkReassign} disabled={!bulkAssignee || bulkBusy}>
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />Reassign
            </Button>
            <span className="text-xs text-muted-foreground ml-2">Move to</span>
            <Select value={bulkStage} onValueChange={setBulkStage}>
              <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Pick a stage" /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={bulkChangeStage} disabled={!bulkStage || bulkBusy}>
              <KanbanSquare className="h-3.5 w-3.5 mr-1.5" />Move
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={bulkBusy}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
              <Undo2 className="h-3.5 w-3.5 mr-1" />Clear selection
            </Button>
          </div>
        )}

        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {isOwner && (
                  <TableHead className="w-8">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                )}
                <TableHead>Lead</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={isOwner ? 8 : 7} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={isOwner ? 8 : 7} className="py-12 text-center text-sm text-muted-foreground">
                  No leads yet. Click <b>New lead</b> to get started.
                </TableCell></TableRow>
              )}
              {filtered.map((l) => (
                <TableRow key={l.id} className={"cursor-pointer group " + (selected.has(l.id) ? "bg-primary/5" : "")} onClick={() => setDetail(l)}>
                  {isOwner && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.company ?? l.email ?? l.phone ?? "—"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {(() => {
                        const s = scoreLead(l);
                        const st = HEAT_STYLE[s.heat];
                        return (
                          <span title={s.reasons.join(" · ") || "Lead heat"} className={"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium " + st.className}>
                            <span>{st.emoji}</span>{st.label}<span className="tabular opacity-70">{s.score}</span>
                          </span>
                        );
                      })()}
                      {(l as any).custom_status && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
                        <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                        <span className="truncate max-w-[220px]">{(l as any).custom_status}</span>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const a = STAGE_ACCENT[l.stage as StageKey];
                      return (
                        <span className={"inline-flex items-center gap-1.5 rounded-full ring-1 px-2 py-0.5 text-[11px] font-medium " + a.bg + " " + a.text + " " + a.ring}>
                          <span className={"h-1.5 w-1.5 rounded-full " + a.dot} />
                          {STAGE_LABEL[l.stage as StageKey]}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="tabular">{formatCurrency(l.deal_value)}</TableCell>
                  <TableCell className="text-sm">{nameOf(l.assigned_to)}</TableCell>
                  <TableCell className="w-[160px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-[width]" style={{ width: `${(l as any).progress ?? 0}%`, background: "var(--gradient-magenta)" }} />
                      </div>
                      <span className="text-[10px] tabular text-muted-foreground w-8 text-right">{(l as any).progress ?? 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" onClick={() => handleDelete(l)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <LeadDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog({ open: v, lead: v ? dialog.lead : null })}
        lead={dialog.lead}
        profiles={profiles}
        isOwner={isOwner}
        onSaved={refresh}
      />
      <LeadDetailSheet
        lead={detail}
        profiles={profiles}
        onClose={() => setDetail(null)}
        onEdit={(l) => { setDetail(null); setDialog({ open: true, lead: l }); }}
        onChanged={() => { refresh(); if (detail) listLeads().then((l) => setDetail(l.find((x) => x.id === detail.id) ?? null)); }}
      />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} profiles={profiles} onDone={refresh} />
      {isOwner && <BulkAssignDialog open={assignOpen} onOpenChange={setAssignOpen} profiles={profiles.filter((p) => p.id)} onDone={refresh} />}
    </>
  );
}