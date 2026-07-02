import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Trophy, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { listLeads, listProfiles, formatCurrency, type Lead, type Profile } from "@/lib/leads";
import { listGoals, upsertGoal, monthKey, computeGoalProgress, type SalesGoal } from "@/lib/goals";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — CoreEgin Sales OS" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { user, role } = useAuth();
  const isOwner = role === "owner";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [month] = useState<string>(monthKey());
  const [busy, setBusy] = useState<string>("");

  async function refresh() {
    try {
      const [l, p, g] = await Promise.all([listLeads(), listProfiles(), listGoals(month)]);
      setLeads(l); setProfiles(p); setGoals(g);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  const rows = useMemo(() => {
    const visible = isOwner ? profiles : profiles.filter((p) => p.id === user?.id);
    return visible.map((p) => {
      const g = goals.find((x) => x.rep_id === p.id) ?? null;
      const prog = computeGoalProgress(leads, p.id, g);
      return { profile: p, goal: g, prog };
    });
  }, [profiles, goals, leads, isOwner, user]);

  async function saveInline(repId: string, target_amount: number, target_leads: number) {
    setBusy(repId);
    try {
      await upsertGoal({ rep_id: repId, month, target_amount, target_leads }, user!.id);
      toast.success("Goal saved");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy("");
  }

  const monthLabel = new Date(month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Goals" description={`Monthly targets — ${monthLabel}. Won deals count toward the month they were closed.`} />
      <div className="p-6 md:p-8 space-y-4">
        {rows.length === 0 && <div className="surface p-8 text-center text-sm text-muted-foreground">No team members yet.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map(({ profile, goal, prog }) => (
            <GoalCard
              key={profile.id}
              profile={profile}
              goal={goal}
              wonAmount={prog.wonAmount}
              newLeads={prog.newLeads}
              amountPct={prog.amountPct}
              leadsPct={prog.leadsPct}
              pacePct={prog.pacePct}
              canEdit={isOwner}
              busy={busy === profile.id}
              onSave={(a, n) => saveInline(profile.id, a, n)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function GoalCard({ profile, goal, wonAmount, newLeads, amountPct, leadsPct, pacePct, canEdit, busy, onSave }: {
  profile: Profile;
  goal: SalesGoal | null;
  wonAmount: number;
  newLeads: number;
  amountPct: number;
  leadsPct: number;
  pacePct: number;
  canEdit: boolean;
  busy: boolean;
  onSave: (target_amount: number, target_leads: number) => void;
}) {
  const [amount, setAmount] = useState<string>(goal?.target_amount ? String(goal.target_amount) : "");
  const [leads, setLeadsN] = useState<string>(goal?.target_leads ? String(goal.target_leads) : "");
  useEffect(() => {
    setAmount(goal?.target_amount ? String(goal.target_amount) : "");
    setLeadsN(goal?.target_leads ? String(goal.target_leads) : "");
  }, [goal?.id]);

  const onPace = amountPct >= pacePct;

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm" style={{ background: "var(--gradient-magenta)" }}>
            {(profile.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm">{profile.name}</div>
            <div className="text-[11px] text-muted-foreground capitalize">{profile.role ?? "rep"}</div>
          </div>
        </div>
        <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + (onPace ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-600")}>
          {onPace ? "On pace" : "Behind pace"}
        </span>
      </div>

      <div className="space-y-3">
        <ProgressRow icon={Trophy} label="Won this month" value={formatCurrency(wonAmount)} target={goal?.target_amount ? formatCurrency(goal.target_amount) : "—"} pct={amountPct} pacePct={pacePct} />
        <ProgressRow icon={Users} label="New leads" value={String(newLeads)} target={goal?.target_leads ? String(goal.target_leads) : "—"} pct={leadsPct} pacePct={pacePct} />
      </div>

      {canEdit && (
        <div className="border-t border-hairline pt-3 grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-[10px] uppercase tracking-wider">Target $</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider">Target leads</Label>
            <Input type="number" min={0} value={leads} onChange={(e) => setLeadsN(e.target.value)} className="h-8" />
          </div>
          <Button size="sm" disabled={busy} onClick={() => onSave(Number(amount) || 0, Number(leads) || 0)}>
            <Target className="h-3.5 w-3.5 mr-1" />{busy ? "…" : "Set"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ProgressRow({ icon: Icon, label, value, target, pct, pacePct }: { icon: any; label: string; value: string; target: string; pct: number; pacePct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <div className="tabular"><span className="font-semibold">{value}</span> <span className="text-muted-foreground">/ {target}</span></div>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: "var(--gradient-magenta)" }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/40" style={{ left: `${pacePct}%` }} title="Today's pace" />
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
        <TrendingUp className="h-2.5 w-2.5" />Today's pace {Math.round(pacePct)}% · progress {Math.round(pct)}%
      </div>
    </div>
  );
}