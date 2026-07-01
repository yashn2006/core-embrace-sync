import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { useAuth } from "@/hooks/use-auth";
import { Users, TrendingUp, Target, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoreEgin Sales OS" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user } = useAuth();
  const name = user?.email?.split("@")[0] ?? "there";
  const isOwner = role === "owner";

  return (
    <>
      <PageHeader
        title={isOwner ? "Founder dashboard" : "My workspace"}
        description={`Good to see you, ${name}. Here's what's moving.`}
      />
      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active leads" value="—" hint="Waiting on data" icon={<Users className="h-4 w-4" />} />
          <StatCard label="Pipeline value" value="$0" icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Conversion" value="—" accent icon={<Target className="h-4 w-4" />} />
          <StatCard label="Overdue follow-ups" value="0" icon={<Clock className="h-4 w-4" />} />
        </div>
        <div className="surface p-8 text-sm text-muted-foreground">
          <div className="text-foreground text-base font-medium mb-2">Iteration 1 shipped</div>
          <p>
            Foundation is live: dark design system, secure schema with row-level security, authentication,
            and app shell. Next up — lead management, Kanban pipeline, activity timeline, follow-ups,
            Won/Lost handling, and CSV import.
          </p>
        </div>
      </div>
    </>
  );
}