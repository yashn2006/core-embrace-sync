import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listLeads, type Lead, type Profile } from "@/lib/leads";
import { STAGE_LABEL, type StageKey } from "@/lib/constants";
import { toast } from "sonner";
import { Search, UserCheck, Users2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Profile[];
  /** Pre-selected rep (e.g. right after creating a user) */
  presetRepId?: string | null;
  presetRepName?: string | null;
  onDone?: () => void;
}

export function BulkAssignDialog({ open, onOpenChange, profiles, presetRepId, presetRepName, onDone }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignee, setAssignee] = useState<string>(presetRepId ?? "");
  const [scope, setScope] = useState<"unassigned" | "all">("unassigned");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssignee(presetRepId ?? "");
    setSelected(new Set());
    setLoading(true);
    listLeads().then(setLeads).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [open, presetRepId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (scope === "unassigned" && l.assigned_to) return false;
      if (t && ![l.name, l.company, l.email].some((v) => v?.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [leads, scope, q]);

  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function submit() {
    if (!assignee) return toast.error("Pick a rep");
    if (selected.size === 0) return toast.error("Select at least one lead");
    setSaving(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("leads").update({ assigned_to: assignee }).in("id", ids);
      if (error) throw error;
      const repName = profiles.find((p) => p.id === assignee)?.name ?? "rep";
      toast.success(`Assigned ${ids.length} lead${ids.length === 1 ? "" : "s"} to ${repName}`);
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const unassignedCount = leads.filter((l) => !l.assigned_to).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            {presetRepName ? `Assign leads to ${presetRepName}` : "Bulk assign leads"}
          </DialogTitle>
          <DialogDescription>
            Pick leads and hand them to a rep in one click. They'll appear in that rep's pipeline instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!presetRepId && (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Assign to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Pick a rep" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Show</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned only ({unassignedCount})</SelectItem>
                <SelectItem value="all">All leads ({leads.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="surface max-h-[340px] overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline sticky top-0 bg-card z-10">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : `Select all ${filtered.length}`}
            </span>
          </div>
          {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No leads match.</div>
          )}
          {filtered.map((l) => (
            <label key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60 cursor-pointer border-b border-hairline/60 last:border-0 transition-colors">
              <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{l.company ?? l.email ?? l.phone ?? "—"}</div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">{STAGE_LABEL[l.stage as StageKey]}</Badge>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || selected.size === 0 || !assignee}>
            <UserCheck className="h-4 w-4 mr-1.5" />
            {saving ? "Assigning…" : `Assign ${selected.size || ""} lead${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}