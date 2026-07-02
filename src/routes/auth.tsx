import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Sparkles, ShieldCheck, Zap } from "lucide-react";
import ceLogo from "@/assets/ce-logo.png.asset.json";

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
  const { session, loading, user, displayName } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // NOTE: intentionally do NOT auto-navigate on existing session.
  // Browser autofill / cached sessions would otherwise "sign in" without an explicit click.
  // Instead, if a session exists, we show a "Continue" screen the user must click.

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) { toast.error("Enter your email and password"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        toast.error("Wrong email or password. Check caps-lock and try again.");
      } else if (msg.includes("email not confirmed")) {
        toast.error("Email not confirmed. Ask the founder to re-create your account.");
      } else if (msg.includes("redirect") || msg.includes("url")) {
        toast.error("Auth redirect misconfigured. In Cloud → Auth → URL config, set Site URL to https://coreegin.com and add https://coreegin.com/* to Redirect URLs.");
      } else if (msg.includes("network") || msg.includes("fetch")) {
        toast.error("Can't reach the backend. Check internet, or Cloudflare → Pages → Env vars for VITE_SUPABASE_URL.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  const alreadySignedIn = !loading && !!session;

  return (
    <div className="min-h-screen flex bg-background text-foreground relative overflow-hidden">
      {/* Cinematic backdrop — GPU-only transforms, no JS particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-25 [mask-image:radial-gradient(900px_circle_at_30%_40%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-40 animate-float" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--magenta) 40%, transparent), transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 animate-float" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--purple) 40%, transparent), transparent 70%)", animationDelay: "1.5s" }} />

      {/* LEFT — logo showcase (desktop only) */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12">
        <div className="relative animate-reveal" style={{ animationDuration: "700ms" }}>
          <div aria-hidden className="absolute inset-0 blur-3xl opacity-60" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--magenta) 50%, transparent), transparent 60%)" }} />
          <img src={ceLogo.url} alt="CoreEgin" className="relative w-[440px] max-w-full animate-float select-none" draggable={false} />
          <div className="relative mt-8 text-center">
            <div className="text-3xl font-semibold tracking-tight">CoreEgin <span className="text-gradient">Sales OS</span></div>
            <div className="mt-2 text-sm text-muted-foreground">The internal command center for a serious sales team.</div>
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Real-time</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> RLS-secure</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Built to scale</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 relative">
        <div className="w-full max-w-sm animate-reveal" style={{ animationDelay: "120ms" }}>
          <div className="lg:hidden mb-8 flex flex-col items-center">
            <img src={ceLogo.url} alt="CoreEgin" className="h-28 w-auto animate-float" draggable={false} />
            <div className="mt-3 text-lg font-semibold tracking-tight">CoreEgin <span className="text-gradient">Sales OS</span></div>
          </div>

          {alreadySignedIn ? (
            <div className="surface-raised p-6 rounded-2xl text-center space-y-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Session detected</div>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back,<br /><span className="text-gradient">{displayName}</span></h1>
              <p className="text-sm text-muted-foreground">You're already signed in. Continue when ready.</p>
              <Button
                className="w-full sheen-on-hover text-white shadow-[var(--shadow-glow)]"
                style={{ background: "var(--gradient-magenta)" }}
                onClick={() => navigate({ to: "/dashboard", replace: true })}
              >
                Continue to workspace <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
              <button
                onClick={async () => { await supabase.auth.signOut(); location.reload(); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out instead
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Sign in</div>
                <h1 className="text-[30px] font-semibold tracking-tight leading-tight">
                  Welcome <span className="text-gradient">back</span>
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Enter your credentials to open your workspace.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-3.5 surface-raised p-6 rounded-2xl" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@coreegin.com"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full sheen-on-hover text-white shadow-[var(--shadow-glow)] h-10"
                  style={{ background: "var(--gradient-magenta)" }}
                  disabled={submitting}
                >
                  {submitting ? "Signing in…" : (<>Sign in <ArrowRight className="h-4 w-4 ml-1.5" /></>)}
                </Button>
              </form>

              <p className="mt-6 text-xs text-muted-foreground text-center">
                Accounts are invite-only. Contact your admin if you need access.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}