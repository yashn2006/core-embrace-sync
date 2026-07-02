import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Global "leader-key" shortcuts, Gmail-style.
 * Press `g` then one of: d (dash), i (inbox), l (leads), p (pipeline),
 * m (meetings), c (chat), e (earnings). Press `?` for the hint toast.
 * Ignored while typing in inputs/textarea/contenteditable.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let pendingG = 0;
    const go = (to: string) => navigate({ to } as never);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // "g" leader
      if (e.key === "g" || e.key === "G") { pendingG = Date.now(); return; }
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        switch (e.key.toLowerCase()) {
          case "d": e.preventDefault(); return go("/dashboard");
          case "i": e.preventDefault(); return go("/inbox");
          case "l": e.preventDefault(); return go("/leads");
          case "p": e.preventDefault(); return go("/pipeline");
          case "m": e.preventDefault(); return go("/meetings");
          case "c": e.preventDefault(); return go("/chat");
          case "e": e.preventDefault(); return go("/earnings");
        }
      }
      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("coreegin:open-command"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
