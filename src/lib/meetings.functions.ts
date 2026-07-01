import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Create a Daily.co room via REST API. Returns { name, url }.
 * Room auto-expires 4 hours after scheduled end.
 */
async function createDailyRoom(opts: { name: string; expUnix: number }): Promise<{ name: string; url: string }> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error("DAILY_API_KEY not configured");

  const res = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      privacy: "public",
      properties: {
        exp: opts.expUnix,
        enable_chat: true,
        enable_screenshare: true,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily API error: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { name: string; url: string };
  return { name: data.name, url: data.url };
}

/**
 * Schedule a meeting: creates a Daily room, inserts meetings row + attendees.
 */
export const scheduleMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    title: string;
    description?: string;
    lead_id?: string | null;
    start_at: string; // ISO
    end_at: string;   // ISO
    attendee_ids: string[];
  }) => {
    if (!data.title?.trim()) throw new Error("Title required");
    if (!data.start_at || !data.end_at) throw new Error("Start/end required");
    if (new Date(data.end_at).getTime() <= new Date(data.start_at).getTime()) {
      throw new Error("End must be after start");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Daily room name: alphanumeric + dashes only, must be unique
    const roomName = `coreegin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const expUnix = Math.floor(new Date(data.end_at).getTime() / 1000) + 4 * 60 * 60;

    const room = await createDailyRoom({ name: roomName, expUnix });

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        title: data.title.trim(),
        description: data.description ?? null,
        lead_id: data.lead_id ?? null,
        scheduled_by: userId,
        start_at: data.start_at,
        end_at: data.end_at,
        daily_room_url: room.url,
        daily_room_name: room.name,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Add attendees (dedupe + always include host)
    const attendees = Array.from(new Set([userId, ...(data.attendee_ids ?? [])]));
    const rows = attendees.map((uid) => ({ meeting_id: meeting.id, user_id: uid }));
    const { error: attErr } = await supabase.from("meeting_attendees").insert(rows);
    if (attErr) throw new Error(attErr.message);

    return { meeting };
  });

/**
 * Cancel a meeting (soft: mark status='cancelled' and delete Daily room).
 */
export const cancelMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { meeting_id: string }) => {
    if (!data.meeting_id) throw new Error("meeting_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("daily_room_name")
      .eq("id", data.meeting_id)
      .single();
    if (error) throw new Error(error.message);

    // Best-effort delete Daily room
    if (meeting?.daily_room_name && process.env.DAILY_API_KEY) {
      try {
        await fetch(`https://api.daily.co/v1/rooms/${meeting.daily_room_name}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
        });
      } catch {}
    }

    const { error: upErr } = await supabase
      .from("meetings")
      .update({ status: "cancelled" })
      .eq("id", data.meeting_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });