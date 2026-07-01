import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

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

/** Insert an activity row (best-effort). */
async function logMeetingActivity(
  supabase: any,
  opts: { lead_id: string; outcome: string; note: string; userId: string },
) {
  try {
    await supabase.from("activities").insert({
      lead_id: opts.lead_id,
      org_id: ORG_ID,
      type: "meeting",
      outcome: opts.outcome,
      response_text: opts.note,
      created_by: opts.userId,
    });
  } catch (e) {
    console.error("logMeetingActivity", e);
  }
}

/** Enqueue push reminders for all attendees. */
async function enqueueMeetingPush(
  supabase: any,
  opts: { meeting_id: string; title: string; start_at: string; attendee_ids: string[] },
) {
  const startMs = new Date(opts.start_at).getTime();
  const reminderAt = new Date(startMs - 10 * 60_000).toISOString(); // 10min before
  const rows = opts.attendee_ids.map((uid) => ({
    user_id: uid,
    title: `Meeting soon: ${opts.title}`,
    body: `Starts in 10 minutes. Tap to join.`,
    url: `/meetings`,
    tag: `meeting-${opts.meeting_id}`,
    dedupe_key: `meeting-${opts.meeting_id}-remind`,
    scheduled_for: reminderAt,
  }));
  try { await supabase.from("push_notifications_queue").upsert(rows, { onConflict: "user_id,dedupe_key" }); } catch (e) { console.error("enqueue push", e); }
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

    // Activity timeline + push reminders
    if (data.lead_id) {
      const startNice = new Date(data.start_at).toLocaleString();
      await logMeetingActivity(supabase, {
        lead_id: data.lead_id,
        outcome: "scheduled",
        note: `Meeting "${data.title}" scheduled for ${startNice}`,
        userId,
      });
    }
    await enqueueMeetingPush(supabase, {
      meeting_id: meeting.id,
      title: data.title.trim(),
      start_at: data.start_at,
      attendee_ids: attendees,
    });

    return { meeting };
  });

/** Reschedule / edit a meeting (title, notes, times). Logs activity. */
export const updateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    meeting_id: string;
    title?: string;
    description?: string | null;
    start_at?: string;
    end_at?: string;
  }) => {
    if (!data.meeting_id) throw new Error("meeting_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: before, error: bErr } = await supabase
      .from("meetings")
      .select("id,title,start_at,end_at,lead_id,daily_room_name")
      .eq("id", data.meeting_id)
      .single();
    if (bErr) throw new Error(bErr.message);

    const patch: {
      title?: string; description?: string | null; start_at?: string; end_at?: string;
    } = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.description !== undefined) patch.description = data.description;
    if (data.start_at) patch.start_at = data.start_at;
    if (data.end_at) patch.end_at = data.end_at;

    const { error: uErr } = await supabase.from("meetings").update(patch).eq("id", data.meeting_id);
    if (uErr) throw new Error(uErr.message);

    // If time changed, extend Daily room expiration (4h after new end_at)
    const newEnd = data.end_at ?? before.end_at;
    if ((data.start_at || data.end_at) && before.daily_room_name && process.env.DAILY_API_KEY) {
      try {
        const expUnix = Math.floor(new Date(newEnd).getTime() / 1000) + 4 * 60 * 60;
        await fetch(`https://api.daily.co/v1/rooms/${before.daily_room_name}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties: { exp: expUnix } }),
        });
      } catch (e) { console.error("daily update", e); }
    }

    if (before.lead_id) {
      const rescheduled = data.start_at && data.start_at !== before.start_at;
      const note = rescheduled
        ? `Meeting "${before.title}" rescheduled to ${new Date(data.start_at!).toLocaleString()}`
        : `Meeting "${before.title}" updated`;
      await logMeetingActivity(supabase, {
        lead_id: before.lead_id,
        outcome: rescheduled ? "rescheduled" : "updated",
        note,
        userId,
      });
    }

    // Update push reminder time if start changed
    if (data.start_at) {
      const { data: atts } = await supabase.from("meeting_attendees").select("user_id").eq("meeting_id", data.meeting_id);
      await enqueueMeetingPush(supabase, {
        meeting_id: data.meeting_id,
        title: (data.title ?? before.title).trim(),
        start_at: data.start_at,
        attendee_ids: (atts ?? []).map((a: { user_id: string }) => a.user_id),
      });
    }
    return { ok: true };
  });

/**
 * Complete a meeting: record post-call notes + outcome, log to lead timeline,
 * optionally schedule a next-step follow-up.
 */
export const completeMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    meeting_id: string;
    outcome: "completed" | "won" | "lost" | "no_show" | "follow_up";
    notes: string;
    next_step_at?: string | null;
    next_step_note?: string | null;
  }) => {
    if (!data.meeting_id) throw new Error("meeting_id required");
    if (!data.notes?.trim()) throw new Error("Notes required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("id,title,lead_id")
      .eq("id", data.meeting_id)
      .single();
    if (error) throw new Error(error.message);

    const { error: upErr } = await supabase
      .from("meetings")
      .update({ status: "completed" })
      .eq("id", data.meeting_id);
    if (upErr) throw new Error(upErr.message);

    if (meeting.lead_id) {
      await logMeetingActivity(supabase, {
        lead_id: meeting.lead_id,
        outcome: data.outcome,
        note: `Meeting "${meeting.title}" — ${data.outcome.toUpperCase()}\n${data.notes.trim()}`,
        userId,
      });

      // Mirror lead stage on win/loss
      if (data.outcome === "won" || data.outcome === "lost") {
        try {
          await supabase.from("leads").update({ stage: data.outcome }).eq("id", meeting.lead_id);
        } catch (e) { console.error("stage sync", e); }
      }

      // Log next step as a separate follow-up activity
      if (data.next_step_at) {
        try {
          await supabase.from("activities").insert({
            lead_id: meeting.lead_id,
            org_id: ORG_ID,
            type: "follow_up",
            outcome: "scheduled",
            response_text: data.next_step_note?.trim() || `Next step scheduled after meeting`,
            follow_up_at: data.next_step_at,
            created_by: userId,
          });
        } catch (e) { console.error("next-step insert", e); }
      }
    }

    return { ok: true };
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
    const { supabase, userId } = context;
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("daily_room_name,title,lead_id")
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

    if (meeting?.lead_id) {
      await logMeetingActivity(supabase, {
        lead_id: meeting.lead_id,
        outcome: "cancelled",
        note: `Meeting "${meeting.title}" cancelled`,
        userId,
      });
    }

    // Drop any pending reminders
    try {
      await supabase.from("push_notifications_queue").delete().eq("tag", `meeting-${data.meeting_id}`).is("sent_at", null);
    } catch {}

    return { ok: true };
  });