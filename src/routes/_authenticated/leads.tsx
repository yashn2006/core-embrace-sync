import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import { listLeads, listProfiles, deleteLead, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGE_LABEL, type StageKey } from "@/lib/constants";
import { LeadDialog } from "@/components/leads/lead-dialog";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { CsvImportDialog } from "@/components/leads/csv-import-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — CoreEgin Sales OS" }] }),
  component: LeadsPage,
});

function LeadsPage() {
  const { role } = useAuth();
  const isOwner = role === "owner";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [detail, setDetail] = useState<Lead | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [l, p] = await Promise.all([listLeads(), listProfiles()]);
      setLeads(l); setProfiles(p);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return leads;
    return leads.filter((l) =>
      [l.name, l.company, l.email, l.phone].some((v) => v?.toLowerCase().includes(t)),
    );
  }, [leads, q]);

  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "—";

  async function handleDelete(l: Lead) {
    if (!confirm(`Delete "${l.name}"?`)) return;
    try { await deleteLead(l.id); toast.success("Deleted"); refresh(); } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description={isOwner ? "Every lead in the org. Assign, edit, work them." : "Your leads. Add, work, close."}
        actions={
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />Import CSV
              </Button>
            )}
            <Button size="sm" onClick={() => setDialog({ open: true, lead: null })}>
              <Plus className="h-4 w-4 mr-1.5" />New lead
            </Button>
          </div>
        }
      />
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, company, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground tabular whitespace-nowrap">{filtered.length} of {leads.length}</div>
        </div>

        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No leads yet. Click <b>New lead</b> to get started.
                </TableCell></TableRow>
              )}
              {filtered.map((l) => (
                <TableRow key={l.id} className="cursor-pointer group" onClick={() => setDetail(l)}>
                  <TableCell>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.company ?? l.email ?? l.phone ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{STAGE_LABEL[l.stage as StageKey]}</Badge>
                  </TableCell>
                  <TableCell className="tabular">{formatCurrency(l.deal_value)}</TableCell>
                  <TableCell className="text-sm">{nameOf(l.assigned_to)}</TableCell>
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
    </>
  );
}