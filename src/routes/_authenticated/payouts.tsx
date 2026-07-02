import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, DollarSign, Sparkles, Users, Wallet, Ban } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { approveCommission, markCommissionPaid, voidCommission, bulkApproveForRep } from "@/lib/commissions.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({ meta: [{ title: "Payouts — CoreEgin Sales OS" }] }),
  component: PayoutsPage,
});

type Row = {
  id: string;
  rep_id: string;
  lead_id: string;
  deal_value: number;
  commission_amount: number;
  status: "pending" | "approved" | "paid" | "voided";
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  lead?: { name: string | null; company: string | null } | null;
};

type Profile = { id: string; name: string | null; email: string };

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function PayoutsPage() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!authLoading && role !== "owner") navigate({ to: "/dashboard", replace: true }); }, [authLoading, role, navigate]);

  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "paid" | "all">("pending");

  const approve = useServerFn(approveCommission);
  const pay = useServerFn(markCommissionPaid);
  const voidFn = useServerFn(voidCommission);
  const bulkApprove = useServerFn(bulkApproveForRep);

  async function refresh() {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      (supabase as any).from("commissions").select("*, lead:leads(name, company)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, name, email"),
    ]);
    setRows((cs ?? []) as Row[]);
    const map: Record<string, Profile> = {};
    for (const p of (ps ?? []) as Profile[]) map[p.id] = p;
    setProfiles(map);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const ch = (supabase as any)
      .channel("commissions-owner")
      .on("postgres_changes", { event: "*", schema: "public", table: "commissions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = {};
    for (const r of rows) (g[r.rep_id] ??= []).push(r);
    return g;
  }, [rows]);

  const totals = useMemo(() => {
    const t = { pending: 0, approved: 0, paid: 0 };
    for (const r of rows) {
      if (r.status === "pending") t.pending += Number(r.commission_amount);
      else if (r.status === "approved") t.approved += Number(r.commission_amount);
      else if (r.status === "paid") t.paid += Number(r.commission_amount);
    }
    return t;
  }, [rows]);

  const liability = totals.pending + totals.approved;

  async function doAction(fn: () => Promise<any>, id: string, label: string) {
    setBusy(id);
    try { await fn(); toast.success(label); await refresh(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Owner control"
        title="Payouts"
        description="Approve and mark commissions paid. Reps get real-time updates and a push notification."
      />
      <div className="p-6 md:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total liability" value={fmt(liability)} icon={<Wallet className="h-4 w-4" />} accent />
          <Kpi label="⏳ Pending" value={fmt(totals.pending)} icon={<Sparkles className="h-4 w-4" />} />
          <Kpi label="✅ Approved" value={fmt(totals.approved)} icon={<CheckCircle2 className="h-4 w-4" />} />
          <Kpi label="💸 Paid lifetime" value={fmt(totals.paid)} icon={<DollarSign className="h-4 w-4" />} />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {(["pending", "approved", "paid", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={"px-3 py-1.5 rounded-full text-xs font-medium transition-all " +
                (tab === t ? "text-white shadow-[var(--shadow-glow)]" : "bg-muted text-muted-foreground hover:bg-muted/70")}
              style={tab === t ? { background: "var(--gradient-magenta)" } : undefined}>
              {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Per-rep */}
        <div className="space-y-4">
          {loading && <div className="surface p-6 text-sm text-muted-foreground">Loading…</div>}
          {!loading && Object.keys(grouped).length === 0 && (
            <div className="surface p-10 text-center text-sm text-muted-foreground">
              No commissions yet. Mark a lead as <b>Won</b> and it lands here for approval.
            </div>
          )}
          {Object.entries(grouped).map(([repId, list]) => {
            const rep = profiles[repId];
            const filtered = tab === "all" ? list : list.filter((r) => r.status === tab);
            if (filtered.length === 0) return null;
            const repPending = list.filter((r) => r.status === "pending");
            const repTotal = filtered.reduce((s, r) => s + Number(r.commission_amount), 0);
            return (
              <div key={repId} className="surface overflow-hidden">
                <div className="p-4 border-b border-hairline flex items-center gap-3 flex-wrap">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-magenta)" }}>
                    {(rep?.name ?? rep?.email ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{rep?.name ?? rep?.email ?? "Unknown rep"}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{filtered.length} commission{filtered.length === 1 ? "" : "s"} · {fmt(repTotal)}</div>
                  </div>
                  {repPending.length > 0 && (
                    <Button size="sm" variant="outline" className="ml-auto text-xs"
                      onClick={() => doAction(() => bulkApprove({ data: { repId } }), "bulk-" + repId, `Approved ${repPending.length} pending`)}
                      disabled={busy === "bulk-" + repId}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve all {repPending.length} pending
                    </Button>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead className="text-right">Deal</TableHead>
                      <TableHead className="text-right">20% commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{r.lead?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.lead?.company ?? ""}</div>
                        </TableCell>
                        <TableCell className="text-right tabular text-sm">{fmt(Number(r.deal_value))}</TableCell>
                        <TableCell className="text-right tabular font-semibold text-primary">{fmt(Number(r.commission_amount))}</TableCell>
                        <TableCell>
                          {r.status === "pending" && <Badge className="bg-warning/15 text-warning-foreground border-0 hover:bg-warning/15">⏳ Pending</Badge>}
                          {r.status === "approved" && <Badge className="bg-primary/15 text-primary border-0 hover:bg-primary/15">✅ Approved</Badge>}
                          {r.status === "paid" && <Badge className="bg-success/15 text-success border-0 hover:bg-success/15">💸 Paid</Badge>}
                          {r.status === "voided" && <Badge variant="secondary" className="border-0">Voided</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                            {r.status === "pending" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                disabled={busy === r.id}
                                onClick={() => doAction(() => approve({ data: { id: r.id } }), r.id, "Approved")}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                              </Button>
                            )}
                            {(r.status === "pending" || r.status === "approved") && (
                              <>
                                <Button size="sm" className="h-7 text-xs text-white" style={{ background: "var(--gradient-magenta)" }}
                                  disabled={busy === r.id}
                                  onClick={() => doAction(() => pay({ data: { id: r.id } }), r.id, "Marked as paid")}>
                                  <DollarSign className="h-3 w-3 mr-1" />Mark paid
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  disabled={busy === r.id}
                                  onClick={() => { if (confirm("Void this commission?")) doAction(() => voidFn({ data: { id: r.id } }), r.id, "Voided"); }}>
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={"surface p-4 relative overflow-hidden " + (accent ? "ring-1 ring-primary/40" : "")}>
      {accent && <div aria-hidden className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: "var(--gradient-magenta)" }} />}
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
        <div className={"mt-1 text-2xl font-bold tabular " + (accent ? "bg-clip-text text-transparent" : "")} style={accent ? { backgroundImage: "var(--gradient-magenta)" } : undefined}>{value}</div>
      </div>
    </div>
  );
}