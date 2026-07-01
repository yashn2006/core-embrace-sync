import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Enforces:
 *  - HARD session cap: signs out after `hardMs` since sign-in (default 60min)
 *  - IDLE timeout:     signs out after `idleMs` with no user activity (default 10min)
 */
export function useSessionTimeout(
  opts: { hardMs?: number; idleMs?: number; warnMs?: number } = {},
) {
  const hardMs = opts.hardMs ?? 60 * 60_000;
  const idleMs = opts.idleMs ?? 10 * 60_000;
  const warnMs = opts.warnMs ?? 60_000;

  const lastActiveRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session || cancelled) return;
      const key = "coreegin.session_started_at";
      const stored = localStorage.getItem(key);
      const startedAt = stored ? parseInt(stored, 10) : Date.now();
      if (!stored) localStorage.setItem(key, String(startedAt));
      sessionStartRef.current = startedAt;
    });

    const bump = () => {
      lastActiveRef.current = Date.now();
      warnedRef.current = false;
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const timer = window.setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const now = Date.now();
      const idleFor = now - lastActiveRef.current;
      const sessionFor = sessionStartRef.current ? now - sessionStartRef.current : 0;

      if (idleFor > idleMs - warnMs && !warnedRef.current && idleFor < idleMs) {
        warnedRef.current = true;
        toast.warning("You'll be signed out for inactivity in 1 minute.");
      }
      if (idleFor >= idleMs || sessionFor >= hardMs) {
        localStorage.removeItem("coreegin.session_started_at");
        await supabase.auth.signOut();
        toast.info(sessionFor >= hardMs ? "Session expired — please sign in again." : "Signed out for inactivity.");
        window.location.href = "/auth";
      }
    }, 15_000);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem("coreegin.session_started_at");
        sessionStartRef.current = null;
      }
      if (event === "SIGNED_IN") {
        const started = Date.now();
        localStorage.setItem("coreegin.session_started_at", String(started));
        sessionStartRef.current = started;
        lastActiveRef.current = started;
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
      sub.subscription.unsubscribe();
    };
  }, [hardMs, idleMs, warnMs]);
}