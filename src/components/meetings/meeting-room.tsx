import { useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { X, Loader2 } from "lucide-react";

interface Props {
  meeting: { id: string; title: string; daily_room_url: string | null };
  userName: string;
  onLeave: () => void;
}

export function MeetingRoom({ meeting, userName, onLeave }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meeting.daily_room_url || !wrapRef.current) return;
    let cancelled = false;

    const call = DailyIframe.createFrame(wrapRef.current, {
      showLeaveButton: true,
      showFullscreenButton: true,
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "0",
      },
    });
    callRef.current = call;

    call
      .join({ url: meeting.daily_room_url, userName })
      .then(() => { if (!cancelled) setLoading(false); })
      .catch((e) => { if (!cancelled) { setError(e?.message ?? "Failed to join"); setLoading(false); } });

    call.on("left-meeting", () => onLeave());

    return () => {
      cancelled = true;
      try { call.leave(); } catch {}
      try { call.destroy(); } catch {}
      callRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-150">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 backdrop-blur border-b border-white/10 text-white">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-white/60">Meeting</div>
          <div className="text-sm font-medium truncate">{meeting.title}</div>
        </div>
        <button onClick={onLeave} className="p-2 rounded-md hover:bg-white/10" aria-label="Leave">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin" />
            <div className="text-sm">Joining video room…</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-10">
            <div className="text-sm text-red-300">{error}</div>
            <button onClick={onLeave} className="text-xs underline">Close</button>
          </div>
        )}
        <div ref={wrapRef} className="absolute inset-0" />
      </div>
    </div>
  );
}