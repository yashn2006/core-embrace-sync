import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, Database, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { runDiagnostics, listAdminUsers } from "@/lib/diagnostics.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({ meta: [{ title: "System Health — CoreEgin Sales OS" }] }),
  component: HealthPage,
});

function HealthPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && role !== "owner") navigate({ to: "/dashboard", replace: true }); }, [loading, role, navigate]);

  const runFn = useServerFn(runDiagnostics);
  const usersFn = useServerFn(listAdminUsers);
  const [checks, setChecks] = useState<Array<{ name: string; status: "ok"|"warn"|"fail"; detail: string }>>([]);
  const [projectRef, setProjectRef] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  async function refresh() {
    setBusy(true);
    try {
      const [d, u] = await Promise.all([runFn(), usersFn()]);
      setChecks((d as any).checks); setProjectRef((d as any).projectRef);
      setUsers((u as any).users);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { if (role === "owner") refresh(); }, [role]);

  const okCount = checks.filter(c => c.status === "ok").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const failCount = checks.filter(c => c.status === "fail").length;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="System Health"
        description={`Backend diagnostics · project ref: ${projectRef || "…"}`}
        actions={<Button size="sm" variant="outline" onClick={refresh} disabled={busy}><RefreshCw className={"h-4 w-4 mr-1.5 " + (busy ? "animate-spin" : "")} />Re-run</Button>}
      />
      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="surface p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Passing</div><div className="text-2xl font-semibold mt-1 tabular">{okCount}</div></div>
          <div className="surface p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning" />Warnings</div><div className="text-2xl font-semibold mt-1 tabular">{warnCount}</div></div>
          <div className="surface p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" />Failing</div><div className="text-2xl font-semibold mt-1 tabular">{failCount}</div></div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-3"><Activity className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Backend checks</h3></div>
          <div className="divide-y divide-hairline">
            {busy && <div className="py-6 text-sm text-muted-foreground text-center">Running diagnostics…</div>}
            {!busy && checks.map((c) => (
              <div key={c.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="text-sm font-medium truncate">{c.name}</div><div className="text-xs text-muted-foreground truncate">{c.detail}</div></div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">RLS verification — leads visible per user</h3></div>
          <div className="text-xs text-muted-foreground mb-3">Confirms each rep only sees leads assigned to them. Owner sees all.</div>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="rounded-lg border border-hairline p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: "var(--gradient-magenta)" }}>{u.name?.[0]?.toUpperCase() ?? "?"}</div>
                    <div>
                      <div className="text-sm font-medium">{u.name} {u.phone && <span className="text-xs text-muted-foreground">· {u.phone}</span>}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                  <Badge variant={u.role === "owner" ? "default" : "outline"} className={u.role === "owner" ? "bg-primary/10 text-primary border-transparent" : ""}>{u.role === "owner" ? "Founder" : "Rep"}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5"><Database className="h-3 w-3" />{u.leads.length} lead(s) assigned{u.leads.length > 0 && ": " + u.leads.slice(0,4).map((l: any) => l.name).join(", ") + (u.leads.length > 4 ? ` +${u.leads.length-4} more` : "")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: "ok"|"warn"|"fail" }) {
  if (status === "ok") return <Badge className="bg-success/10 text-success border-transparent gap-1"><CheckCircle2 className="h-3 w-3" />OK</Badge>;
  if (status === "warn") return <Badge className="bg-warning/10 text-warning border-transparent gap-1"><AlertTriangle className="h-3 w-3" />Warn</Badge>;
  return <Badge className="bg-destructive/10 text-destructive border-transparent gap-1"><XCircle className="h-3 w-3" />Fail</Badge>;
}