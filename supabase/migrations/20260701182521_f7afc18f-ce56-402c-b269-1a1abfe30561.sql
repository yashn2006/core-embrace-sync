
-- 1) Widen meetings SELECT to include reps assigned to the linked lead
DROP POLICY IF EXISTS "view meetings host attendee or owner" ON public.meetings;

CREATE POLICY "view meetings host attendee owner or lead rep"
ON public.meetings FOR SELECT TO authenticated
USING (
  scheduled_by = auth.uid()
  OR private.has_role(auth.uid(), 'owner')
  OR EXISTS (SELECT 1 FROM public.meeting_attendees a WHERE a.meeting_id = id AND a.user_id = auth.uid())
  OR (lead_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  ))
);

-- 2) Also let attendees policy respect same rule
DROP POLICY IF EXISTS "view attendees if can view meeting" ON public.meeting_attendees;
CREATE POLICY "view attendees if can view meeting"
ON public.meeting_attendees FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id
      AND (
        m.scheduled_by = auth.uid()
        OR private.has_role(auth.uid(), 'owner')
        OR EXISTS (SELECT 1 FROM public.meeting_attendees a2 WHERE a2.meeting_id = m.id AND a2.user_id = auth.uid())
        OR (m.lead_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.leads l WHERE l.id = m.lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
        ))
      )
  )
);

-- 3) Push notification queue (delivered by background worker/cron)
CREATE TABLE IF NOT EXISTS public.push_notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  tag TEXT,
  dedupe_key TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS push_queue_pending_idx
  ON public.push_notifications_queue(scheduled_for)
  WHERE sent_at IS NULL;

GRANT SELECT ON public.push_notifications_queue TO authenticated;
GRANT ALL ON public.push_notifications_queue TO service_role;

ALTER TABLE public.push_notifications_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own queued notifications"
ON public.push_notifications_queue FOR SELECT TO authenticated
USING (user_id = auth.uid());
