import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { aiWeeklyDigest } from "@/lib/digest.functions";
import { Sparkles, Loader2, Copy, Check, Trophy, TrendingDown, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/digest")({
  head: () => ({ meta: [{ title: "Weekly Digest — CoreEgin Sales OS" }] }),
  component: DigestPage,
});

function DigestPage() {
  const { role } = useAuth();
  const run = useServerFn(aiWeeklyDigest);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof aiWeeklyDigest>> | null>(null);
  const [copied, setCopied] = useState(false);

  if (role !== "owner") return <div className="p-8 text-center text-sm text-muted-foreground">Owner only.</div>;

  async function generate() {
    setLoading(true); setResult(null);
    try { setResult(await run()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Weekly Digest" description="AI-summarized snapshot of the last 7 days — team performance, wins, and who needs a nudge." />

      <Card>
        <CardContent className="pt-6 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Generate a fresh AI briefing on last week's performance.</div>
          <Button onClick={generate} disabled={loading} className="text-white" style={{ background: "var(--gradient-magenta)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">{loading ? "Analyzing week…" : "Generate digest"}</span>
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<Users className="h-4 w-4" />} label="New leads" value={result.stats.totalNew} />
            <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="Won" value={`${result.stats.totalWon}`} sub={`$${result.stats.totalWonValue.toLocaleString()}`} />
            <Stat icon={<TrendingDown className="h-4 w-4 text-destructive" />} label="Lost" value={result.stats.totalLost} />
            <Stat icon={<Sparkles className="h-4 w-4 text-primary" />} label="Active reps" value={result.stats.reps.length} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">AI briefing</CardTitle>
              <Button variant="ghost" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                <span className="ml-2 text-xs">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground/90">{result.text}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Per-rep leaderboard</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.stats.reps.map((r, i) => (
                  <div key={r.name + i} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: "var(--gradient-magenta)" }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.wonCount} won · {r.lostCount} lost · {r.newLeads} new · {r.activities} activities</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${r.wonValue.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">won value</div>
                    </div>
                  </div>
                ))}
                {result.stats.reps.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No activity this week yet.</div>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card/60 backdrop-blur px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}