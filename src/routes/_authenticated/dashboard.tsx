import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  TrendingUp,
  Target,
  Clock,
  ArrowUpRight,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle2,
  Circle,
  Sparkles,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoreEgin Sales OS" }] }),
  component: DashboardPage,
});

const STAGES = [
  { name: "New", count: 42, value: 0.22 },
  { name: "Contacted", count: 31, value: 0.35 },
  { name: "Interested", count: 24, value: 0.5 },
  { name: "Meeting", count: 14, value: 0.65 },
  { name: "Proposal", count: 9, value: 0.85 },
  { name: "Won", count: 5, value: 1 },
];

const SOURCES = [
  { label: "Website", pct: 34, color: "oklch(0.66 0.24 350)" },
  { label: "Referral", pct: 22, color: "oklch(0.64 0.24 305)" },
  { label: "LinkedIn", pct: 18, color: "oklch(0.68 0.15 220)" },
  { label: "Cold", pct: 14, color: "oklch(0.62 0.16 155)" },
  { label: "Other", pct: 12, color: "oklch(0.72 0.16 75)" },
];

const REPS = [
  { name: "Ali Khan", leads: 42, won: 7, rate: 34 },
  { name: "Sara Ahmed", leads: 38, won: 6, rate: 28 },
  { name: "Bilal Raza", leads: 31, won: 4, rate: 22 },
  { name: "Hina Malik", leads: 24, won: 3, rate: 18 },
];

const ACTIVITY = [
  { icon: CheckCircle2, tone: "success", who: "Ali", what: "closed", target: "Nexora Media", meta: "$4,800 · 2m ago" },
  { icon: Phone, tone: "muted", who: "Sara", what: "called", target: "Orbit Foods", meta: "outcome: interested · 12m ago" },
  { icon: Mail, tone: "muted", who: "Bilal", what: "emailed", target: "Vault Labs", meta: "proposal sent · 34m ago" },
  { icon: MessageCircle, tone: "muted", who: "Hina", what: "chatted", target: "Loop Studio", meta: "on WhatsApp · 1h ago" },
  { icon: Circle, tone: "warning", who: "Ali", what: "added lead", target: "Kite Retail", meta: "source: referral · 2h ago" },
];

function DashboardPage() {
  const { role, user } = useAuth();
  const name = user?.email?.split("@")[0] ?? "there";
  const isOwner = role === "owner";

  return (
    <>
      <PageHeader
        eyebrow={isOwner ? "Command Center" : "Today"}
        title={isOwner ? `Welcome back, ${name}` : `Let's move some deals, ${name}`}
        description={
          isOwner
            ? "Live snapshot of the whole team. Pipeline is warm — 3 deals close this week."
            : "You have 6 leads to work today. Stay focused and log every touch."
        }
        actions={
          <button className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white shadow-[var(--shadow-glow)] sheen-on-hover" style={{ background: "var(--gradient-magenta)" }}>
            <Zap className="h-3.5 w-3.5" />
            Quick add lead
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        }
      />
      <div className="p-6 md:p-8 space-y-6 max-w-[1400px]">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Active leads"
            value="128"
            delta={12}
            icon={<Users className="h-3.5 w-3.5" />}
            spark={[4, 6, 5, 8, 7, 10, 9, 12, 14]}
            delay={0}
          />
          <StatCard
            label="Pipeline value"
            value="$184,500"
            delta={8}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            spark={[12, 14, 13, 16, 18, 17, 21, 20, 24]}
            delay={60}
          />
          <StatCard
            label="Conversion"
            value="27.4%"
            accent
            delta={4}
            icon={<Target className="h-3.5 w-3.5" />}
            spark={[18, 20, 22, 21, 24, 23, 25, 26, 27]}
            delay={120}
          />
          <StatCard
            label="Overdue follow-ups"
            value="3"
            delta={-2}
            hint="down this week"
            icon={<Clock className="h-3.5 w-3.5" />}
            spark={[8, 7, 6, 6, 5, 4, 4, 3, 3]}
            delay={180}
          />
        </div>

        {/* Row 2: funnel + sources */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="surface p-5 lg:col-span-2 animate-reveal" style={{ animationDelay: "220ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Pipeline funnel</div>
                <div className="text-sm font-medium mt-0.5">Stage-by-stage flow · last 30 days</div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> live</div>
            </div>
            <div className="space-y-2.5">
              {STAGES.map((s, i) => (
                <div key={s.name} className="grid grid-cols-[100px_1fr_60px] items-center gap-3 group">
                  <div className="text-xs text-muted-foreground">{s.name}</div>
                  <div className="h-8 rounded-lg bg-muted/60 relative overflow-hidden">
                    <div
                      className="h-full rounded-lg animate-reveal transition-all group-hover:brightness-110"
                      style={{
                        width: `${s.value * 100}%`,
                        background: i === STAGES.length - 1 ? "var(--gradient-magenta)" : `oklch(0.92 0.05 340)`,
                        animationDelay: `${240 + i * 60}ms`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-[11px] font-medium tabular text-foreground/80">
                      {s.count} leads
                    </div>
                  </div>
                  <div className="text-xs text-right tabular text-muted-foreground">{Math.round(s.value * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface p-5 animate-reveal" style={{ animationDelay: "280ms" }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Lead sources</div>
            <div className="text-sm font-medium mt-0.5 mb-5">Where deals come from</div>
            <DonutChart data={SOURCES} />
            <div className="mt-5 space-y-1.5">
              {SOURCES.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-muted-foreground">{s.label}</span>
                  <span className="tabular font-medium">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: leaderboard + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {isOwner ? (
            <div className="surface p-5 lg:col-span-2 animate-reveal" style={{ animationDelay: "320ms" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Team performance</div>
                  <div className="text-sm font-medium mt-0.5">Reps ranked by conversion</div>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-hairline">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground bg-muted/40">
                      <th className="text-left font-medium px-4 py-2.5">Rep</th>
                      <th className="text-right font-medium px-4 py-2.5">Leads</th>
                      <th className="text-right font-medium px-4 py-2.5">Won</th>
                      <th className="text-right font-medium px-4 py-2.5">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REPS.map((r, i) => (
                      <tr key={r.name} className="border-t border-hairline hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: i === 0 ? "var(--gradient-magenta)" : "oklch(0.65 0.02 340)" }}>
                            {r.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="font-medium">{r.name}</span>
                          {i === 0 && <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Top</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular text-muted-foreground">{r.leads}</td>
                        <td className="px-4 py-3 text-right tabular font-medium">{r.won}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${r.rate * 2.5}%`, background: "var(--gradient-magenta)" }} />
                            </div>
                            <span className="tabular text-xs w-8 text-right">{r.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="surface p-5 lg:col-span-2 animate-reveal" style={{ animationDelay: "320ms" }}>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">My focus today</div>
              <div className="text-sm font-medium mt-0.5 mb-4">6 leads waiting on you</div>
              <div className="space-y-2">
                {["Nexora Media", "Orbit Foods", "Vault Labs", "Loop Studio"].map((n, i) => (
                  <div key={n} className="flex items-center gap-3 p-3 rounded-lg border border-hairline hover:border-primary/30 hover:bg-muted/30 transition-all">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {n[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n}</div>
                      <div className="text-xs text-muted-foreground">Follow up · due today</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {["New", "Contacted", "Interested", "Proposal"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="surface p-5 animate-reveal" style={{ animationDelay: "380ms" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Live activity</div>
                <div className="text-sm font-medium mt-0.5">What's happening now</div>
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-ring" />
            </div>
            <div className="space-y-3">
              {ACTIVITY.map((a, i) => {
                const Icon = a.icon;
                const toneClass =
                  a.tone === "success" ? "text-success bg-success/10" :
                  a.tone === "warning" ? "text-warning bg-warning/10" :
                  "text-muted-foreground bg-muted";
                return (
                  <div key={i} className="flex items-start gap-3 animate-reveal" style={{ animationDelay: `${400 + i * 60}ms` }}>
                    <div className={"h-7 w-7 rounded-lg flex items-center justify-center shrink-0 " + toneClass}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs">
                        <span className="font-medium">{a.who}</span>{" "}
                        <span className="text-muted-foreground">{a.what}</span>{" "}
                        <span className="font-medium">{a.target}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{a.meta}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DonutChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  const size = 160;
  const r = 60;
  const stroke = 18;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={stroke} />
        {data.map((s, i) => {
          const len = (s.pct / 100) * c;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 700ms var(--ease-out-quart)", animationDelay: `${i * 100}ms` }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold tabular text-gradient">128</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">total leads</div>
      </div>
    </div>
  );
}