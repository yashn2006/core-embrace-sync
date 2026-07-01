import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full skeleton" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}