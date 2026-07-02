import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, LogOut, Wallet, Users, TrendingUp, MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/view-as/$repId")({
  head: () => ({ meta: [{ title: "View as rep — CoreEgin Sales OS" }] }),
  component: ViewAsPage,
});

type Lead = { id: string; name: string; company: string | null; stage: string; deal_value: number | null; progress: number | null; custom_status: string | null; updated_at: string };
type Commission = { id: string; status: string; commission_amount: number; created_at: string };
type Activity = { id: string; type: string; outcome: string | null; response_text: string | null; created_at: string; lead_id: string | null };

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function ViewAsPage() {
  const { repId } = Route.useParams();
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!authLoading && role !== "owner") navigate({ to: "/dashboard", replace: true }); }, [authLoading, role, navigate]);

  const [rep, setRep] = useState<{ name: string | null; email: string; phone: string | null } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: ls }, { data: cs }, { data: acts }] = await Promise.all([
        supabase.from("profiles").select("name, email, phone").eq("id", repId).maybeSingle(),
        supabase.from("leads").select("id, name, company, stage, deal_value, progress, custom_status, updated_at").eq("assigned_to", repId).order("updated_at", { ascending: false }),
        (supabase as any).from("commissions").select("id, status, commission_amount, created_at").eq("rep_id", repId),
        supabase.from("activities").select("id, type, outcome, response_text, created_at, lead_id").eq("created_by", repId).order("created_at", { ascending: false }).limit(20),
      ]);
      setRep(p as any);
      setLeads((ls ?? []) as Lead[]);
      setCommissions((cs ?? []) as Commission[]);
      setActivities((acts ?? []) as Activity[]);
      setLoading(false);
    })();
  }, [repId]);

  const kpi = useMemo(() => {
    const stages: Record<string, number> = {};
    let pipelineValue = 0;
    let wonValue = 0;
    for (const l of leads) {
      stages[l.stage] = (stages[l.stage] ?? 0) + 1;
      if (l.stage !== "won" && l.stage !== "lost") pipelineValue += Number(l.deal_value ?? 0);
      if (l.stage === "won") wonValue += Number(l.deal_value ?? 0);
    }
    const earned = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount), 0);
    const pending = commissions.filter((c) => c.status === "pending" || c.status === "approved").reduce((s, c) => s + Number(c.commission_amount), 0);
    return { stages, pipelineValue, wonValue, earned, pending, total: leads.length };
  }, [leads, commissions]);

  return (
    <>
      {/* Impersonation banner */}
      <div className="sticky top-0 z-20 border-b border-primary/30 text-white flex items-center gap-3 px-4 md:px-8 py-2.5" style={{ background: "var(--gradient-magenta)" }}>
        <Eye className="h-4 w-4 animate-pulse" />
        <div className="text-sm font-medium">
          Viewing as <b>{rep?.name ?? rep?.email ?? "…"}</b> — read-only mirror
        </div>
        <Link to="/permissions" className="ml-auto">
          <Button size="sm" variant="secondary" className="h-7 text-xs">
            <LogOut className="h-3 w-3 mr-1" />Exit view
          </Button>
        </Link>
      </div>

      <PageHeader
        eyebrow="👁 Read-only observer mode"
        title={rep?.name ?? rep?.email ?? "Rep dashboard"}
        description={rep?.email + (rep?.phone ? "  ·  " + rep.phone : "")}
      />

      <div className="p-6 md:p-8 space-y-6">
        {loading ? (
          <div className="surface p-6 text-sm text-muted-foreground">Loading rep workspace…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Total leads" value={String(kpi.total)} icon={<Users className="h-4 w-4" />} />
              <Kpi label="Pipeline value" value={fmt(kpi.pipelineValue)} icon={<TrendingUp className="h-4 w-4" />} />
              <Kpi label="Won value" value={fmt(kpi.wonValue)} icon={<TrendingUp className="h-4 w-4" />} />
              <Kpi label="💰 Earned" value={fmt(kpi.earned)} accent />
              <Kpi label="⏳ Awaiting" value={fmt(kpi.pending)} />
            </div>

            {/* Stage breakdown */}
            <div className="surface p-4">
              <div className="text-sm font-medium mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Stage breakdown</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(kpi.stages).map(([s, n]) => (
                  <Badge key={s} variant="secondary" className="border-0 text-xs">
                    {s}: <b className="ml-1 tabular">{n}</b>
                  </Badge>
                ))}
                {Object.keys(kpi.stages).length === 0 && <span className="text-xs text-muted-foreground italic">No leads assigned.</span>}
              </div>
            </div>

            {/* Their leads */}
            <div className="surface overflow-hidden">
              <div className="p-4 border-b border-hairline text-sm font-medium">Their leads ({leads.length})</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Deal</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No leads.</TableCell></TableRow>}
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell><div className="font-medium text-sm">{l.name}</div><div className="text-xs text-muted-foreground">{l.company}</div></TableCell>
                      <TableCell><Badge variant="secondary" className="border-0 text-[10px]">{l.stage}</Badge></TableCell>
                      <TableCell>{l.custom_status ? <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "var(--gradient-magenta)" }}>{l.custom_status}</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right tabular text-sm">{fmt(Number(l.deal_value ?? 0))}</TableCell>
                      <TableCell className="text-right"><span className="tabular text-xs">{l.progress ?? 0}%</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(l.updated_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Recent activity */}
            <div className="surface overflow-hidden">
              <div className="p-4 border-b border-hairline text-sm font-medium flex items-center gap-2"><MessagesSquare className="h-4 w-4 text-primary" />Recent activity</div>
              <div className="divide-y divide-hairline">
                {activities.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>}
                {activities.map((a) => (
                  <div key={a.id} className="p-3 flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full mt-1.5" style={{ background: "var(--gradient-magenta)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{a.type}{a.outcome ? ` · ${a.outcome}` : ""}</div>
                      {a.response_text && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.response_text}</div>}
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={"surface p-4 " + (accent ? "ring-1 ring-primary/40" : "")}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={"mt-1 text-xl font-bold tabular " + (accent ? "bg-clip-text text-transparent" : "")} style={accent ? { backgroundImage: "var(--gradient-magenta)" } : undefined}>{value}</div>
    </div>
  );
}