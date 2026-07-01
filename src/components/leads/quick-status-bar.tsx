import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUICK_STATUSES, applyQuickStatus } from "@/lib/quick-status";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Zap } from "lucide-react";

const TONE_CLS: Record<string, string> = {
  neutral: "border-hairline hover:border-primary/40 hover:bg-primary/5",
  positive: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
  warm: "border-secondary/30 bg-secondary/5 text-secondary-foreground hover:bg-secondary/10",
  negative: "border-destructive/20 text-destructive hover:bg-destructive/5",
};

export function QuickStatusBar({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(s: (typeof QUICK_STATUSES)[number]) {
    if (!user) return;
    setBusy(s.key);
    try {
      await applyQuickStatus({ leadId, userId: user.id, status: s, note: note.trim() || null });
      setNote("");
      toast.success(`Marked "${s.label}"`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="surface p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        <Zap className="h-3 w-3 text-primary" /> Quick update
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Short note for the owner (optional)…"
        className="h-9"
      />
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STATUSES.map((s) => (
          <Button
            key={s.key}
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => pick(s)}
            className={"h-7 text-xs rounded-full transition-all " + TONE_CLS[s.tone]}
          >
            {busy === s.key ? "…" : s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}