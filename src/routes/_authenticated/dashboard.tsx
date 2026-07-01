import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { useAuth } from "@/hooks/use-auth";
import { listLeads, listProfiles, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGES, STAGE_LABEL, SOURCES, type StageKey } from "@/lib/constants";
import { Users, TrendingUp, Target, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoreEgin Sales OS" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user } = useAuth();
  const isOwner = role === "owner";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    listLeads().then(setLeads).catch(() => {});
    listProfiles().then(setProfiles).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const active = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const won = leads.filter((l) => l.stage === "won");
    const pipeValue = active.reduce((s, l) => s + (l.deal_value ?? 0), 0);
    const closed = leads.filter((l) => l.stage === "won" || l.stage === "lost");
    const conv = closed.length ? (won.length / closed.length) * 100 : 0;
    const now = Date.now();
    const overdue = active.filter((l) => l.next_follow_up && new Date(l.next_follow_up).getTime() < now).length;
    return { active: active.length, pipeValue, conv, overdue, won };
  }, [leads]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    STAGES.forEach((s) => (map[s.key] = 0));
    leads.forEach((l) => (map[l.stage] = (map[l.stage] ?? 0) + 1));
    return map;
  }, [leads]);
  const maxStage = Math.max(1, ...Object.values(stageCounts));

  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    SOURCES.forEach((s) => (map[s.key] = 0));
    leads.forEach((l) => (map[l.source] = (map[l.source] ?? 0) + 1));
    return map;
  }, [leads]);
  const sourceTotal = Object.values(sourceCounts).reduce((a, b) => a + b, 0) || 1;

  const repRows = useMemo(() => {
    return profiles.map((p) => {
      const mine = leads.filter((l) => l.assigned_to === p.id);
      const won = mine.filter((l) => l.stage === "won").length;
      const closed = mine.filter((l) => l.stage === "won" || l.stage === "lost").length;
      return { id: p.id, name: p.name, leads: mine.length, won, rate: closed ? Math.round((won / closed) * 100) : 0 };
    }).sort((a, b) => b.won - a.won);
  }, [profiles, leads]);

  const recent = useMemo(() => leads.slice(0, 6), [leads]);
  const displayName = user?.email?.split("@")[0] ?? "there";

  return (
    <>
      <PageHeader
        eyebrow={isOwner ? "Command Center" : "Today"}
        title={isOwner ? `Welcome back, ${displayName}` : `Let's move some deals, ${displayName}`}
        description={isOwner ? "Live snapshot of the whole team." : "Focus on your pipeline and log every touch."}
      />
      <div className="p-6 md:p-8 space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active leads" value={stats.active} icon={<Users className="h-3.5 w-3.5" />} delay={0} />
          <StatCard label="Pipeline value" value={formatCurrency(stats.pipeValue)} icon={<TrendingUp className="h-3.5 w-3.5" />} delay={60} />
          <StatCard label="Conversion" value={stats.conv.toFixed(1) + "%"} accent icon={<Target className="h-3.5 w-3.5" />} delay={120} />
          <StatCard label="Overdue follow-ups" value={stats.overdue} icon={<Clock className="h-3.5 w-3.5" />} delay={180} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="surface p-5 lg:col-span-2 animate-reveal">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-4">Pipeline funnel</div>
            <div className="space-y-2.5">
              {STAGES.filter((s) => s.key !== "lost").map((s, i) => {
                const count = stageCounts[s.key] ?? 0;
                const pct = (count / maxStage) * 100;
                return (
                  <div key={s.key} className="grid grid-cols-[110px_1fr_50px] items-center gap-3">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="h-8 rounded-lg bg-muted/60 relative overflow-hidden">
                      <div className="h-full rounded-lg animate-reveal transition-all" style={{ width: `${pct}%`, background: s.key === "won" ? "var(--gradient-magenta)" : `oklch(0.92 0.05 340)`, animationDelay: `${i * 40}ms` }} />
                      <div className="absolute inset-0 flex items-center px-3 text-[11px] font-medium tabular text-foreground/80">{count} leads</div>
                    </div>
                    <div className="text-xs text-right tabular text-muted-foreground">{Math.round(pct)}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface p-5 animate-reveal">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-4">Lead sources</div>
            <div className="space-y-2.5">
              {SOURCES.map((s) => {
                const c = sourceCounts[s.key] ?? 0;
                const pct = (c / sourceTotal) * 100;
                return (
                  <div key={s.key}>
                    <div className="flex justify-between text-xs mb-1"><span className="capitalize">{s.label}</span><span className="tabular text-muted-foreground">{c}</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gradient-magenta)" }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="surface p-5 animate-reveal">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-4">Rep leaderboard</div>
            <div className="space-y-1">
              {repRows.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No team members yet.</div>}
              {repRows.map((r, i) => (
                <div key={r.id} className="grid grid-cols-[24px_1fr_auto_auto_auto] items-center gap-4 py-2 border-b border-hairline/60 last:border-0">
                  <div className="text-xs tabular text-muted-foreground">#{i + 1}</div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs tabular text-muted-foreground">{r.leads} leads</div>
                  <div className="text-xs tabular text-muted-foreground">{r.won} won</div>
                  <div className="text-xs tabular text-primary font-medium">{r.rate}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="surface p-5 animate-reveal">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-4">Recent leads</div>
          {recent.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No leads yet — head to the Leads page and add one.</div>}
          <div className="divide-y divide-hairline/60">
            {recent.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-2.5">
                <div><div className="text-sm font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.company ?? "—"}</div></div>
                <div className="text-xs text-muted-foreground capitalize">{STAGE_LABEL[l.stage as StageKey]}</div>
                <div className="text-xs tabular">{formatCurrency(l.deal_value)}</div>
                <div className="text-[10px] tabular text-muted-foreground">{formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}