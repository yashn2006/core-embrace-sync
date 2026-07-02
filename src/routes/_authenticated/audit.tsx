import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit log — CoreEgin Sales OS" }] }),
  component: AuditPage,
});

type Row = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: "insert" | "update" | "delete";
  changes: Record<string, unknown> | null;
  created_at: string;
};

type Profile = { id: string; name: string | null; email: string };
type LeadLite = { id: string; name: string };

function AuditPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && role !== "owner") navigate({ to: "/dashboard", replace: true }); }, [loading, role, navigate]);

  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [leads, setLeads] = useState<Record<string, LeadLite>>({});
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"all" | Row["action"]>("all");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      const [{ data: logs }, { data: profs }, { data: lds }] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id,name,email"),
        supabase.from("leads").select("id,name"),
      ]);
      if (!alive) return;
      setRows((logs ?? []) as Row[]);
      setProfiles(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p])));
      setLeads(Object.fromEntries((lds ?? []).map((l: any) => [l.id, l])));
      setBusy(false);
    })();
    const ch = supabase.channel("audit-log-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (p) => {
      setRows((prev) => [p.new as Row, ...prev].slice(0, 500));
    }).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (action !== "all" && r.action !== action) return false;
    if (!q) return true;
    const actor = r.actor_id ? profiles[r.actor_id]?.name ?? profiles[r.actor_id]?.email ?? "" : "";
    const lead = leads[r.entity_id]?.name ?? "";
    return (actor + " " + lead + " " + JSON.stringify(r.changes ?? {})).toLowerCase().includes(q.toLowerCase());
  }), [rows, action, q, profiles, leads]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Audit log"
        description="Every change to every lead — who, what, when."
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search actor, lead or field…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1">
          {(["all", "insert", "update", "delete"] as const).map((k) => (
            <button key={k} onClick={() => setAction(k)} className={`px-3 py-1.5 text-xs rounded-md border transition ${action === k ? "bg-primary text-primary-foreground border-primary" : "border-hairline hover:bg-muted"}`}>{k}</button>
          ))}
        </div>
      </div>

      {busy ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">No audit entries yet.</div>
      ) : (
        <ol className="space-y-2">
          {filtered.map((r) => {
            const actor = r.actor_id ? profiles[r.actor_id] : null;
            const lead = leads[r.entity_id];
            const Icon = r.action === "insert" ? Plus : r.action === "delete" ? Trash2 : Pencil;
            const tone = r.action === "insert" ? "text-emerald-600 bg-emerald-50" : r.action === "delete" ? "text-rose-600 bg-rose-50" : "text-primary bg-primary/10";
            return (
              <li key={r.id} className="rounded-xl border border-hairline p-3 bg-card">
                <div className="flex items-start gap-3">
                  <span className={`h-8 w-8 rounded-lg grid place-items-center ${tone}`}><Icon className="h-4 w-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{actor?.name ?? actor?.email ?? "System"}</span>
                      <Badge variant="outline" className="capitalize text-[10px]">{r.action}</Badge>
                      <span className="text-muted-foreground truncate">{lead?.name ?? r.entity_type}</span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </div>
                    {r.changes && r.action === "update" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(r.changes as Record<string, { from: unknown; to: unknown }>).map(([field, ch]) => (
                          <span key={field} className="text-[11px] px-2 py-0.5 rounded-md bg-muted border border-hairline">
                            <b>{field}</b>: <span className="text-muted-foreground line-through">{String(ch?.from ?? "—")}</span> → <span className="text-foreground">{String(ch?.to ?? "—")}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}