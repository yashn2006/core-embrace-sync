import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CoreEgin Sales OS" },
      { name: "description", content: "Sign in to CoreEgin Sales OS." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient magenta glow — subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 50% -10%, color-mix(in oklab, var(--magenta) 14%, transparent), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">C</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">CoreEgin</div>
            <div className="text-xs text-muted-foreground -mt-0.5">Sales OS</div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in with your CoreEgin account.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@coreegin.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 text-xs text-muted-foreground">
          Accounts are invite-only. Contact your admin if you need access.
        </p>
      </div>
    </div>
  );
}