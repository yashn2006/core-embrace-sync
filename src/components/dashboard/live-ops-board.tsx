import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listProfiles, formatCurrency, type Profile } from "@/lib/leads";
import { Radio, PartyPopper, Users2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type WinEvent = {
  id: string;
  leadId: string;
  leadName: string;
  repId: string | null;
  repName: string;
  value: number;
  at: number;
};

export function LiveOpsBoard() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [wins, setWins] = useState<WinEvent[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => {});
  }, []);

  // Presence — every authenticated tab joins "coreegin:presence"; owner sees who's online.
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("coreegin:presence", { config: { presence: { key: user.id } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Realtime win ticker — listens to leads transitioning to won
  useEffect(() => {
    const ch = supabase
      .channel("coreegin:live-wins")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads", filter: "stage=eq.won" },
        (payload) => {
          const n = payload.new as { id: string; name: string; assigned_to: string | null; deal_value: number | null; stage: string };
          const o = payload.old as { stage?: string } | null;
          if (o?.stage === "won") return; // already won
          const evt: WinEvent = {
            id: `${n.id}-${Date.now()}`,
            leadId: n.id,
            leadName: n.name,
            repId: n.assigned_to,
            repName: profiles.find((p) => p.id === n.assigned_to)?.name ?? "Someone",
            value: n.deal_value ?? 0,
            at: Date.now(),
          };
          setWins((prev) => [evt, ...prev].slice(0, 8));
          setFlash(evt.id);
          setTimeout(() => setFlash((f) => (f === evt.id ? null : f)), 2400);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profiles]);

  const reps = useMemo(() => {
    return profiles.map((p) => ({ ...p, online: onlineIds.has(p.id) })).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }, [profiles, onlineIds]);
  const onlineCount = reps.filter((r) => r.online).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-3 animate-reveal">
      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users2 className="h-3.5 w-3.5 text-primary" />
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Live team</div>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] tabular text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            {onlineCount} online
          </div>
        </div>
        {reps.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No teammates yet.</div>
        ) : (
          <div className="space-y-1.5">
            {reps.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                <div className="relative h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: "var(--gradient-magenta)" }}>
                  {(r.name ?? "?").slice(0, 1).toUpperCase()}
                  <span className={"absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background " + (r.online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">{r.online ? "Active now" : "Offline"}</div>
                </div>
                <Link to="/view-as/$repId" params={{ repId: r.id }} className="text-[10px] uppercase tracking-wider text-primary opacity-0 group-hover:opacity-100 hover:underline">View as</Link>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="surface p-5 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Live win ticker</div>
          <div className="ml-auto text-[11px] tabular text-muted-foreground">{wins.length ? `${wins.length} today` : "waiting…"}</div>
        </div>
        {wins.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No wins yet in this session. When any rep marks a lead <b className="text-primary">Won</b>, it lands here in real time. 🎯
          </div>
        ) : (
          <div className="space-y-1.5">
            {wins.map((w) => (
              <div key={w.id} className={"flex items-center gap-3 p-2.5 rounded-lg border transition-all " + (flash === w.id ? "border-primary/60 bg-primary/5 shadow-[0_0_0_3px_rgba(236,72,153,0.12)]" : "border-hairline")}>
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "var(--gradient-magenta)" }}>
                  <PartyPopper className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    <span className="text-primary">{w.repName}</span> closed <span className="font-semibold">{w.leadName}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(w.at, { addSuffix: true })}</div>
                </div>
                {w.value > 0 && <div className="text-sm tabular font-semibold text-primary shrink-0">{formatCurrency(w.value)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}