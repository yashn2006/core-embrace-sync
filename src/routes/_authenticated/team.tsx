import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — CoreEgin Sales OS" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && role !== "owner") navigate({ to: "/dashboard", replace: true });
  }, [loading, role, navigate]);

  return (
    <>
      <PageHeader title="Team" description="Invite reps, assign roles, manage access." />
      <div className="p-6 md:p-8">
        <div className="surface p-10 text-center text-sm text-muted-foreground">
          Team management (invites, roles, activity) ships in iteration 3.
        </div>
      </div>
    </>
  );
}