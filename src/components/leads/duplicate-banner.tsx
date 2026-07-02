import { AlertTriangle } from "lucide-react";
import { findDuplicates, type Lead } from "@/lib/leads";

export function DuplicateBanner({ lead, all, onOpen }: { lead: Lead; all: Lead[]; onOpen: (l: Lead) => void }) {
  const dupes = findDuplicates(lead, all);
  if (dupes.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-3">
      <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          Possible duplicate{dupes.length > 1 ? "s" : ""} · {dupes.length}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {dupes.map((d) => (
            <button
              key={d.lead.id}
              onClick={() => onOpen(d.lead)}
              className="inline-flex items-center gap-1 text-[11px] rounded-full bg-white/70 dark:bg-background border border-amber-300/60 hover:border-amber-500 px-2 py-0.5 transition-colors"
            >
              <span className="font-medium">{d.lead.name}</span>
              <span className="text-muted-foreground">· {d.reason}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}