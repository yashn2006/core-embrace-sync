import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { useAuth } from "@/hooks/use-auth";
import { listLeads, listProfiles, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGES, STAGE_LABEL, SOURCES, type StageKey } from "@/lib/constants";
import { Users, TrendingUp, Target, Clock, AlertTriangle, CalendarClock, DollarSign, Activity, Trophy } from "lucide-react";
import { formatDistanceToNow, isPast, isToday, isTomorrow, startOfWeek, addWeeks, format, isAfter } from "date-fns";
import { toast } from "sonner";

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

  // Follow-up reminder toast — only mine, only overdue, once per session
  useEffect(() => {
    if (!user || leads.length === 0) return;
    const key = `coreegin:followup-toast:${user.id}:${new Date().toDateString()}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key)) return;
    const mineOverdue = leads.filter((l) => l.assigned_to === user.id && l.next_follow_up && isPast(new Date(l.next_follow_up)) && l.stage !== "won" && l.stage !== "lost");
    if (mineOverdue.length > 0) {
      toast.warning(`${mineOverdue.length} follow-up${mineOverdue.length > 1 ? "s" : ""} overdue`, { description: "Check the Follow-ups panel below.", duration: 6000 });
      sessionStorage.setItem(key, "1");
    }
  }, [leads, user]);

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

  const stageValue = useMemo(() => {
    const map: Record<string, number> = {};
    STAGES.forEach((s) => (map[s.key] = 0));
    leads.forEach((l) => (map[l.stage] = (map[l.stage] ?? 0) + (l.deal_value ?? 0)));
    return map;
  }, [leads]);
  const maxStageValue = Math.max(1, ...Object.values(stageValue));

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
      const lost = closed - won;
      const active = mine.length - closed;
      const pipeValue = mine.filter((l) => l.stage !== "won" && l.stage !== "lost").reduce((s, l) => s + (l.deal_value ?? 0), 0);
      const wonValue = mine.filter((l) => l.stage === "won").reduce((s, l) => s + (l.deal_value ?? 0), 0);
      return { id: p.id, name: p.name, leads: mine.length, won, lost, active, rate: closed ? Math.round((won / closed) * 100) : 0, pipeValue, wonValue };
    }).sort((a, b) => b.won - a.won);
  }, [profiles, leads]);

  // 8-week conversion trend (rolling)
  const trend = useMemo(() => {
    const weeks = 8;
    const now = new Date();
    const start = startOfWeek(addWeeks(now, -(weeks - 1)), { weekStartsOn: 1 });
    const buckets = Array.from({ length: weeks }, (_, i) => {
      const s = addWeeks(start, i);
      return { start: s, end: addWeeks(s, 1), won: 0, lost: 0, rate: 0, wonValue: 0 };
    });
    leads.forEach((l) => {
      if (l.stage !== "won" && l.stage !== "lost") return;
      const d = new Date(l.updated_at);
      const b = buckets.find((b) => !isAfter(d, b.end) && !isAfter(b.start, d));
      if (!b) return;
      if (l.stage === "won") { b.won += 1; b.wonValue += l.deal_value ?? 0; } else b.lost += 1;
    });
    buckets.forEach((b) => { const t = b.won + b.lost; b.rate = t ? Math.round((b.won / t) * 100) : 0; });
    return buckets;
  }, [leads]);
  const maxTrendCount = Math.max(1, ...trend.map((b) => b.won + b.lost));

  const recent = useMemo(() => leads.slice(0, 6), [leads]);

  const followUps = useMemo(() => {
    const scope = isOwner ? leads : leads.filter((l) => l.assigned_to === user?.id);
    const active = scope.filter((l) => l.next_follow_up && l.stage !== "won" && l.stage !== "lost");
    const overdue = active.filter((l) => isPast(new Date(l.next_follow_up!)));
    const upcoming = active.filter((l) => !isPast(new Date(l.next_follow_up!))).sort((a, b) => new Date(a.next_follow_up!).getTime() - new Date(b.next_follow_up!).getTime()).slice(0, 5);
    return { overdue: overdue.sort((a, b) => new Date(a.next_follow_up!).getTime() - new Date(b.next_follow_up!).getTime()), upcoming };
  }, [leads, user, isOwner]);

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
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Rep performance</div>
            </div>
            {repRows.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No team members yet.</div>}
            <div className="space-y-4">
              {repRows.map((r, i) => {
                const total = Math.max(1, r.leads);
                return (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="text-xs tabular text-muted-foreground w-6">#{i + 1}</div>
                      <div className="text-sm font-medium flex-1 truncate">{r.name}</div>
                      <div className="text-[10px] tabular text-muted-foreground">{r.leads} leads · {r.won} won</div>
                      <div className="text-xs tabular text-primary font-semibold w-12 text-right">{r.rate}%</div>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted/60">
                      <div className="transition-all animate-reveal" style={{ width: `${(r.won / total) * 100}%`, background: "var(--gradient-magenta)" }} title={`${r.won} won`} />
                      <div className="transition-all animate-reveal" style={{ width: `${(r.active / total) * 100}%`, background: "oklch(0.88 0.06 340)" }} title={`${r.active} active`} />
                      <div className="transition-all animate-reveal" style={{ width: `${(r.lost / total) * 100}%`, background: "oklch(0.85 0.02 340)" }} title={`${r.lost} lost`} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular pl-9">
                      <span>Pipeline {formatCurrency(r.pipeValue)}</span>
                      <span>Won {formatCurrency(r.wonValue)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-hairline/60 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--gradient-magenta)" }} /> Won</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[oklch(0.88_0.06_340)]" /> Active</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[oklch(0.85_0.02_340)]" /> Lost</span>
            </div>
          </div>
        )}

        {isOwner && (
          <div className="surface p-5 animate-reveal">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Conversion trend — last 8 weeks</div>
              <div className="ml-auto text-[11px] tabular text-muted-foreground">avg {Math.round(trend.reduce((s, b) => s + b.rate, 0) / trend.length)}%</div>
            </div>
            <ConversionTrend trend={trend} maxTrendCount={maxTrendCount} />
          </div>
        )}

        {isOwner && (
          <div className="surface p-5 animate-reveal">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Deal value by stage</div>
            </div>
            <div className="space-y-2.5">
              {STAGES.filter((s) => s.key !== "lost").map((s, i) => {
                const v = stageValue[s.key] ?? 0;
                const pct = (v / maxStageValue) * 100;
                return (
                  <div key={s.key} className="grid grid-cols-[110px_1fr_90px] items-center gap-3">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="h-7 rounded-lg bg-muted/60 relative overflow-hidden">
                      <div className="h-full rounded-lg animate-reveal transition-all" style={{ width: `${pct}%`, background: s.key === "won" ? "var(--gradient-magenta)" : `oklch(0.9 0.06 340)`, animationDelay: `${i * 40}ms` }} />
                    </div>
                    <div className="text-xs text-right tabular font-medium">{formatCurrency(v)}</div>
                  </div>
                );
              })}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="surface p-5 animate-reveal">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className={"h-3.5 w-3.5 " + (followUps.overdue.length ? "text-destructive" : "text-muted-foreground")} />
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Overdue follow-ups</div>
              </div>
              <div className={"text-[11px] tabular font-semibold " + (followUps.overdue.length ? "text-destructive" : "text-muted-foreground")}>{followUps.overdue.length}</div>
            </div>
            {followUps.overdue.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nothing overdue. 🎯</div>
            ) : (
              <div className="space-y-1.5">
                {followUps.overdue.slice(0, 6).map((l) => (
                  <Link key={l.id} to="/leads" search={{ q: l.name, stage: "all", owner: "all" }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0 animate-pulse" />
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{l.name}</div><div className="text-xs text-muted-foreground truncate">{l.company ?? STAGE_LABEL[l.stage as StageKey]}</div></div>
                    <div className="text-[10px] tabular text-destructive shrink-0">{formatDistanceToNow(new Date(l.next_follow_up!), { addSuffix: true })}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="surface p-5 animate-reveal">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5 text-primary" />
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Upcoming</div>
              </div>
              <div className="text-[11px] tabular font-semibold text-muted-foreground">{followUps.upcoming.length}</div>
            </div>
            {followUps.upcoming.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No follow-ups scheduled.</div>
            ) : (
              <div className="space-y-1.5">
                {followUps.upcoming.map((l) => {
                  const d = new Date(l.next_follow_up!);
                  const label = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : formatDistanceToNow(d, { addSuffix: true });
                  return (
                    <Link key={l.id} to="/leads" search={{ q: l.name, stage: "all", owner: "all" }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{l.name}</div><div className="text-xs text-muted-foreground truncate">{l.company ?? STAGE_LABEL[l.stage as StageKey]}</div></div>
                      <div className="text-[10px] tabular text-primary shrink-0">{label}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}