import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";

const STAGES = ["New", "Contacted", "Interested", "Meeting", "Proposal", "Won"] as const;

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — CoreEgin Sales OS" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <>
      <PageHeader title="Pipeline" description="Drag to move. Watch it move you." />
      <div className="p-6 md:p-8 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => (
            <div key={stage} className="w-64 shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{stage}</div>
                <div className="text-xs text-muted-foreground tabular">0</div>
              </div>
              <div className="surface min-h-[420px] p-2 space-y-2">
                <div className="text-xs text-muted-foreground text-center py-8">No leads yet</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}