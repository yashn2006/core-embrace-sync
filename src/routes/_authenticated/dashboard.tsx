import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { useAuth } from "@/hooks/use-auth";
import { listLeads, listProfiles, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { STAGES, STAGE_LABEL, SOURCES, type StageKey } from "@/lib/constants";
import { Users, TrendingUp, Target, Clock, AlertTriangle, CalendarClock, DollarSign, Activity, Trophy, Flame, Zap, Rocket, Crown } from "lucide-react";
import { formatDistanceToNow, isPast, isToday, isTomorrow, startOfWeek, addWeeks, format, isAfter, differenceInDays, startOfMonth } from "date-fns";
import { Link as RouterLink } from "@tanstack/react-router";
import { toast } from "sonner";
import { LiveOpsBoard } from "@/components/dashboard/live-ops-board";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoreEgin Sales OS" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user, displayName } = useAuth();
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

  // ============ REP-ONLY SALES FOCUS ============
  const salesFocus = useMemo(() => {
    if (isOwner || !user) return null;
    const mine = leads.filter((l) => l.assigned_to === user.id);
    const active = mine.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const now = new Date();
    // Streak — unique days I updated any lead, back from today
    const days = new Set(mine.map((l) => format(new Date(l.updated_at), "yyyy-MM-dd")));
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = format(new Date(now.getTime() - i * 86400000), "yyyy-MM-dd");
      if (days.has(d)) streak++; else break;
    }
    // Momentum — % of active leads touched in last 7d
    const week = now.getTime() - 7 * 86400000;
    const touched = active.filter((l) => new Date(l.updated_at).getTime() >= week).length;
    const momentum = active.length ? Math.round((touched / active.length) * 100) : 0;
    // This month won
    const monthStart = startOfMonth(now);
    const monthWon = mine.filter((l) => l.stage === "won" && new Date(l.updated_at) >= monthStart);
    const monthWonValue = monthWon.reduce((s, l) => s + (l.deal_value ?? 0), 0);
    // Leaderboard position (by monthly wins across reps)
    const board = profiles.map((p) => {
      const wins = leads.filter((l) => l.assigned_to === p.id && l.stage === "won" && new Date(l.updated_at) >= monthStart);
      return { id: p.id, name: p.name, count: wins.length, value: wins.reduce((s, l) => s + (l.deal_value ?? 0), 0) };
    }).sort((a, b) => b.value - a.value || b.count - a.count);
    const rank = board.findIndex((b) => b.id === user.id) + 1;
    const leader = board[0];
    // Top 3 focus leads: score = overdue*3 + high progress + high value tie-breaker
    const scored = active.map((l) => {
      const overdueDays = l.next_follow_up ? Math.max(0, differenceInDays(now, new Date(l.next_follow_up))) : 0;
      const staleDays = Math.max(0, differenceInDays(now, new Date(l.updated_at)));
      const prog = (l as any).progress ?? 0;
      const val = l.deal_value ?? 0;
      const score = overdueDays * 12 + staleDays * 1.5 + prog * 0.6 + Math.min(val / 500, 30);
      return { lead: l, score, overdueDays, staleDays };
    }).sort((a, b) => b.score - a.score).slice(0, 3);
    return { streak, momentum, monthWon: monthWon.length, monthWonValue, rank, boardSize: board.length, leader, focus: scored };
  }, [leads, profiles, user, isOwner]);

  // displayName from auth context above

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
          {/* Rep performance list continues below */}
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

        {isOwner && <LiveOpsBoard />}

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

        {salesFocus && <SalesFocusBlock focus={salesFocus} />}

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

function ConversionTrend({ trend, maxTrendCount }: { trend: Array<{ start: Date; won: number; lost: number; rate: number; wonValue: number }>; maxTrendCount: number }) {
  const W = 560, H = 140, P = 24;
  const iw = W - P * 2, ih = H - P * 2;
  const pts = trend.map((b, i) => {
    const x = P + (trend.length === 1 ? iw / 2 : (i / (trend.length - 1)) * iw);
    const y = P + ih - (b.rate / 100) * ih;
    return { x, y, b, i };
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x.toFixed(1)},${(P + ih).toFixed(1)} L${pts[0].x.toFixed(1)},${(P + ih).toFixed(1)} Z`;
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = P + ih - (v / 100) * ih;
          return <line key={v} x1={P} x2={W - P} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.06" strokeDasharray="2 3" />;
        })}
        {pts.map((p) => {
          const total = p.b.won + p.b.lost;
          const bh = (total / maxTrendCount) * (ih * 0.35);
          return <rect key={`bar-${p.i}`} x={p.x - 8} y={P + ih - bh} width={16} height={bh} rx={3} fill="currentColor" opacity="0.08" />;
        })}
        <path d={area} fill="url(#trend-fill)" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p) => (
          <g key={`pt-${p.i}`}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="hsl(var(--primary))" />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontWeight="600">{p.b.rate}%</text>
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">{format(p.b.start, "MMM d")}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SalesFocusBlock({ focus }: { focus: NonNullable<ReturnType<typeof buildFocusStub>> }) {
  const { streak, momentum, monthWon, monthWonValue, rank, boardSize, leader, focus: leads } = focus;
  const isTop = rank === 1;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3 animate-reveal">
      <div className="surface p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ background: "var(--gradient-magenta)" }} />
        <div className="flex items-center gap-2 mb-4 relative">
          <Rocket className="h-3.5 w-3.5 text-primary" />
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Today's mission — top 3 to close</div>
        </div>
        {leads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Inbox zero. Add a lead or wait for the owner to assign one. 🎯</div>
        ) : (
          <div className="space-y-2 relative">
            {leads.map(({ lead, overdueDays, staleDays }, i) => (
              <RouterLink key={lead.id} to="/leads" search={{ q: lead.name, stage: "all", owner: "all" }}
                className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-muted/60 border border-hairline transition-all hover:shadow-sm hover:-translate-y-px group">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--gradient-magenta)" }}>{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{lead.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {lead.company ?? STAGE_LABEL[lead.stage as StageKey]}
                    {overdueDays > 0 && <span className="ml-1.5 text-destructive">· {overdueDays}d overdue</span>}
                    {overdueDays === 0 && staleDays > 3 && <span className="ml-1.5 text-amber-600">· cold {staleDays}d</span>}
                  </div>
                </div>
                {lead.deal_value != null && <div className="text-xs tabular font-semibold text-primary shrink-0">{formatCurrency(lead.deal_value)}</div>}
              </RouterLink>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="surface p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center gap-1.5"><Flame className={"h-3.5 w-3.5 " + (streak > 0 ? "text-orange-500" : "text-muted-foreground")} /><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Streak</div></div>
          <div>
            <div className="text-3xl font-semibold tabular">{streak}<span className="text-sm text-muted-foreground ml-1">day{streak === 1 ? "" : "s"}</span></div>
            <div className="text-[10px] text-muted-foreground">of activity</div>
          </div>
        </div>
        <div className="surface p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Momentum</div></div>
          <div>
            <div className="text-3xl font-semibold tabular">{momentum}<span className="text-sm text-muted-foreground">%</span></div>
            <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${momentum}%`, background: "var(--gradient-magenta)" }} /></div>
          </div>
        </div>
        <div className="surface p-4 col-span-2 flex items-center gap-3">
          <div className={"h-11 w-11 rounded-full flex items-center justify-center shrink-0 " + (isTop ? "text-white" : "bg-muted text-muted-foreground")} style={isTop ? { background: "var(--gradient-magenta)" } : undefined}>
            {isTop ? <Crown className="h-5 w-5" /> : <span className="text-sm font-bold tabular">#{rank || "—"}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">This month</div>
            <div className="text-sm font-medium">{monthWon} win{monthWon === 1 ? "" : "s"} · {formatCurrency(monthWonValue)}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {isTop ? "🏆 You're leading the team" : leader && leader.count > 0 ? `Leader: ${leader.name} · ${leader.count} wins` : "Be the first to score this month"}
            </div>
          </div>
          <div className="text-[10px] tabular text-muted-foreground shrink-0">{rank}/{boardSize}</div>
        </div>
      </div>
    </div>
  );
}

// helper type carrier — never called, only for typing SalesFocusBlock props
function buildFocusStub() {
  return null as null | {
    streak: number; momentum: number; monthWon: number; monthWonValue: number;
    rank: number; boardSize: number;
    leader: { id: string; name: string; count: number; value: number } | undefined;
    focus: Array<{ lead: Lead; score: number; overdueDays: number; staleDays: number }>;
  };
}