import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, TrendingUp, Sparkles, CheckCircle2, Clock, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({ meta: [{ title: "My earnings — CoreEgin Sales OS" }] }),
  component: EarningsPage,
});

type Row = {
  id: string;
  lead_id: string;
  rep_id: string;
  deal_value: number;
  commission_rate: number;
  commission_amount: number;
  status: "pending" | "approved" | "paid" | "voided";
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  notes: string | null;
  lead?: { name: string | null; company: string | null } | null;
};

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function EarningsPage() {
  const { user, role, displayName } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      let q = (supabase as any)
        .from("commissions")
        .select("*, lead:leads(name, company)")
        .order("created_at", { ascending: false });
      if (role !== "owner") q = q.eq("rep_id", user.id);
      const { data } = await q;
      if (mounted) {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      }
    })();
    const ch = (supabase as any)
      .channel("commissions-mine")
      .on("postgres_changes", { event: "*", schema: "public", table: "commissions" }, () => {
        (async () => {
          let q = (supabase as any)
            .from("commissions")
            .select("*, lead:leads(name, company)")
            .order("created_at", { ascending: false });
          if (role !== "owner") q = q.eq("rep_id", user.id);
          const { data } = await q;
          if (mounted) setRows((data ?? []) as Row[]);
        })();
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user, role]);

  const totals = useMemo(() => {
    const t = { pending: 0, approved: 0, paid: 0, lifetime: 0, thisMonth: 0 };
    const now = new Date();
    for (const r of rows) {
      if (r.status === "pending") t.pending += Number(r.commission_amount);
      if (r.status === "approved") t.approved += Number(r.commission_amount);
      if (r.status === "paid") {
        t.paid += Number(r.commission_amount);
        t.lifetime += Number(r.commission_amount);
        const d = new Date(r.paid_at || r.created_at);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          t.thisMonth += Number(r.commission_amount);
        }
      }
    }
    return t;
  }, [rows]);

  const nextMilestone = Math.ceil((totals.lifetime + 1) / 50000) * 50000;
  const milestonePct = Math.min(100, (totals.lifetime / nextMilestone) * 100);

  return (
    <>
      <PageHeader
        eyebrow="💰 Your revenue share"
        title={role === "owner" ? "All earnings" : `Your earnings, ${displayName}`}
        description={role === "owner" ? "Every commission across the team." : "20% of every deal you close. Auto-tracked. Owner approves and marks paid."}
      />
      <div className="p-6 md:p-8 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-hairline p-6 md:p-7" style={{ background: "linear-gradient(135deg, hsl(322 90% 96%), hsl(322 90% 99%))" }}>
          <div aria-hidden className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: "var(--gradient-magenta)" }} />
          <div className="relative grid md:grid-cols-4 gap-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" />This month</div>
              <div className="mt-1 text-3xl font-bold tabular bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-magenta)" }}>{fmt(totals.thisMonth)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3 w-3" />Lifetime paid</div>
              <div className="mt-1 text-3xl font-bold tabular">{fmt(totals.lifetime)}</div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: milestonePct + "%", background: "var(--gradient-magenta)" }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{fmt(nextMilestone - totals.lifetime)} to {fmt(nextMilestone)} milestone 🚀</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Pending</div>
              <div className="mt-1 text-2xl font-semibold tabular text-warning">{fmt(totals.pending)}</div>
              <div className="text-[10px] text-muted-foreground">Awaiting owner approval</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" />Approved</div>
              <div className="mt-1 text-2xl font-semibold tabular text-success">{fmt(totals.approved)}</div>
              <div className="text-[10px] text-muted-foreground">Ready to be paid out</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="surface overflow-hidden">
          <div className="p-4 border-b border-hairline flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <div className="font-medium text-sm">All commissions</div>
            <Badge variant="secondary" className="ml-auto text-[10px]">20% of deal value</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead className="text-right">Deal value</TableHead>
                <TableHead className="text-right">Your 20%</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (<TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>)}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No commissions yet. Close a deal (mark a lead as <b>Won</b>) and your 20% shows up here automatically. 💪
                </TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.lead?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.lead?.company ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-right tabular">{fmt(Number(r.deal_value))}</TableCell>
                  <TableCell className="text-right tabular font-semibold text-primary">{fmt(Number(r.commission_amount))}</TableCell>
                  <TableCell>
                    <StatusPill status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.paid_at || r.approved_at || r.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-primary" />
          Commissions are created automatically when a lead is marked <b>Won</b>, and voided if the lead is moved out of Won.
        </div>
      </div>
    </>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  if (status === "paid") return <Badge className="bg-success/15 text-success border-0 hover:bg-success/15">💸 Paid</Badge>;
  if (status === "approved") return <Badge className="bg-primary/15 text-primary border-0 hover:bg-primary/15">✅ Approved</Badge>;
  if (status === "voided") return <Badge variant="secondary" className="border-0 text-muted-foreground">Voided</Badge>;
  return <Badge className="bg-warning/15 text-warning-foreground border-0 hover:bg-warning/15">⏳ Pending</Badge>;
}