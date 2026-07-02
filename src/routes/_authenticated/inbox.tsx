import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLeads, listProfiles, type Lead, type Profile, formatCurrency } from "@/lib/leads";
import { STAGE_LABEL } from "@/lib/constants";
import { scoreLead, HEAT_STYLE } from "@/lib/lead-scoring";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock, Flame, Snowflake, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — CoreEgin Sales OS" }] }),
  component: InboxPage,
});

type Bucket = "overdue" | "today" | "stale" | "hot";

function InboxPage() {
  const { user, role } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<Bucket>("overdue");

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([listLeads(), listProfiles()]);
      setLeads(l);
      setProfiles(p);
    })();
  }, []);

  const mine = useMemo(() => {
    if (role === "owner") return leads;
    return leads.filter((l) => l.assigned_to === user?.id);
  }, [leads, role, user?.id]);

  const now = Date.now();
  const buckets = useMemo(() => {
    const overdue: Lead[] = [];
    const today: Lead[] = [];
    const stale: Lead[] = [];
    const hot: Lead[] = [];
    for (const l of mine) {
      if (l.stage === "won" || l.stage === "lost") continue;
      const nfu = l.next_follow_up ? new Date(l.next_follow_up).getTime() : null;
      if (nfu && nfu < now) overdue.push(l);
      else if (nfu && nfu - now < 86400000) today.push(l);
      const upd = l.updated_at ? new Date(l.updated_at).getTime() : 0;
      if (upd && now - upd > 7 * 86400000) stale.push(l);
      if (scoreLead(l).heat === "hot") hot.push(l);
    }
    return { overdue, today, stale, hot };
  }, [mine, now]);

  const tabMeta: Record<Bucket, { label: string; icon: typeof Clock; tone: string; hint: string }> = {
    overdue: { label: "Overdue", icon: AlertTriangle, tone: "text-destructive", hint: "Follow-up date has passed" },
    today: { label: "Due today", icon: Clock, tone: "text-amber-600", hint: "Follow up before end of day" },
    stale: { label: "Stale (7d+)", icon: Snowflake, tone: "text-muted-foreground", hint: "No activity in the last week" },
    hot: { label: "Hot leads", icon: Flame, tone: "text-primary", hint: "High-score, worth calling now" },
  };

  const active = buckets[tab];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Smart follow-up inbox"
        subtitle={role === "owner" ? "All reps — the deals that need action right now." : "Your action queue. Clear it every day."}
        icon={<Sparkles className="h-4 w-4 text-primary" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(Object.keys(tabMeta) as Bucket[]).map((k) => {
          const M = tabMeta[k];
          const Icon = M.icon;
          const count = buckets[k].length;
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "rounded-xl border p-3 text-left transition-all " +
                (active
                  ? "border-primary/40 bg-primary/5 shadow-[var(--shadow-glow)]"
                  : "border-hairline hover:border-primary/30 hover:bg-muted/40")
              }
            >
              <div className={"flex items-center gap-2 text-xs uppercase tracking-wider " + M.tone}>
                <Icon className="h-3.5 w-3.5" />
                {M.label}
              </div>
              <div className="text-2xl font-semibold mt-1 tabular">{count}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{M.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-hairline bg-card divide-y divide-hairline">
        {active.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary/60" />
            Nothing here. You're on top of it.
          </div>
        )}
        {active.map((l) => {
          const s = scoreLead(l);
          const heat = HEAT_STYLE[s.heat];
          const owner = profiles.find((p) => p.id === l.assigned_to);
          return (
            <Link
              key={l.id}
              to="/leads"
              search={{ q: l.name }}
              className="flex items-center gap-3 p-3 md:p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{l.name}</span>
                  <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium " + heat.className}>
                    {heat.emoji} {heat.label} · {s.score}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {l.company ?? "—"} · {STAGE_LABEL[l.stage as keyof typeof STAGE_LABEL] ?? l.stage}
                  {owner && ` · ${owner.name}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium tabular">{formatCurrency(Number(l.deal_value ?? 0))}</div>
                <div className="text-[10px] text-muted-foreground">
                  {l.next_follow_up ? `due ${formatDistanceToNow(new Date(l.next_follow_up), { addSuffix: true })}` : `updated ${formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}`}
                </div>
              </div>
              <Button size="sm" variant="outline" className="hidden md:inline-flex">Open</Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}