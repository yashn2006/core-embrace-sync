import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Copy, Loader2, MessageSquare, ListChecks, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { aiLeadAssist } from "@/lib/ai.functions";
import { toast } from "sonner";

type Kind = "draft_reply" | "summarize" | "next_step";

const OPTIONS: { kind: Kind; label: string; icon: any; hint: string }[] = [
  { kind: "draft_reply", label: "Draft next message", icon: MessageSquare, hint: "Ready-to-send follow-up" },
  { kind: "next_step", label: "Suggest next step", icon: ListChecks, hint: "Best move + when" },
  { kind: "summarize", label: "Summarize lead", icon: Wand2, hint: "State + blockers" },
];

export function AiAssistPanel({ leadId }: { leadId: string }) {
  const run = useServerFn(aiLeadAssist);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [result, setResult] = useState<string>("");
  const [active, setActive] = useState<Kind | null>(null);

  async function ask(kind: Kind) {
    setBusy(kind); setActive(kind);
    try {
      const res = await run({ data: { leadId, kind } });
      setResult(res.text ?? "");
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally { setBusy(null); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result); toast.success("Copied"); } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        AI works on this lead's history + notes. Nothing is sent externally.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => ask(o.kind)}
            disabled={busy !== null}
            className={"text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-60 " + (active === o.kind ? "border-primary/60 bg-primary/5" : "border-hairline")}
          >
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {busy === o.kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <o.icon className="h-3.5 w-3.5 text-primary" />}
              {o.label}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{o.hint}</div>
          </button>
        ))}
      </div>
      {result && (
        <div className="rounded-lg border border-hairline bg-muted/30 p-3 space-y-2 animate-fade-in">
          <Textarea value={result} onChange={(e) => setResult(e.target.value)} rows={8} className="bg-background text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setResult("")}>Clear</Button>
            <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
          </div>
        </div>
      )}
    </div>
  );
}