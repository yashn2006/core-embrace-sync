import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { listProfiles, type Profile } from "@/lib/leads";
import { aiRepCoach } from "@/lib/coach.functions";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Rep Coach — CoreEgin Sales OS" }] }),
  component: CoachPage,
});

function CoachPage() {
  const { role } = useAuth();
  const runCoach = useServerFn(aiRepCoach);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [repId, setRepId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof aiRepCoach>> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { listProfiles().then(setProfiles); }, []);
  const reps = useMemo(() => profiles.filter((p) => p.id !== "" ), [profiles]);

  if (role !== "owner") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Owner only.</div>;
  }

  async function run() {
    if (!repId) { toast.error("Pick a rep first"); return; }
    setLoading(true);
    setResult(null);
    try {
      const r = await runCoach({ data: { repId } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Coach failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result?.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Rep Coach"
        description="Pick a rep and get a coaching briefing based on their pipeline, activity, and win rate."
      />

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 min-w-0">
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger><SelectValue placeholder="Choose a sales rep" /></SelectTrigger>
              <SelectContent>
                {reps.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={loading || !repId} className="text-white" style={{ background: "var(--gradient-magenta)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">{loading ? "Analyzing…" : "Generate coaching"}</span>
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Open" value={result.stats.open} />
            <Stat label="Won" value={result.stats.won} />
            <Stat label="Win rate" value={`${result.stats.winRate}%`} />
            <Stat label="Pipeline" value={`$${result.stats.pipelineValue.toLocaleString()}`} />
            <Stat label="Won value" value={`$${result.stats.wonValue.toLocaleString()}`} />
            <Stat label="Overdue" value={result.stats.overdue} tone={result.stats.overdue > 0 ? "warn" : undefined} />
            <Stat label="Stale >5d" value={result.stats.stale} tone={result.stats.stale > 3 ? "warn" : undefined} />
            <Stat label="Activities" value={result.stats.activities} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Coaching briefing · {result.rep.name ?? result.rep.email}</CardTitle>
              <Button variant="ghost" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                <span className="ml-2 text-xs">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground/90">{result.text}</pre>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !loading && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/60" />
          Pick a rep above to generate an AI-powered coaching briefing.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-hairline bg-card/60 backdrop-blur px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={"text-lg font-semibold mt-0.5 " + (tone === "warn" ? "text-warning" : "")}>{value}</div>
    </div>
  );
}