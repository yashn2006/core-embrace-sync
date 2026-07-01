
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  title TEXT NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  scheduled_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  daily_room_url TEXT,
  daily_room_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX meetings_start_at_idx ON public.meetings(start_at DESC);
CREATE INDEX meetings_scheduled_by_idx ON public.meetings(scheduled_by);
CREATE INDEX meeting_attendees_user_idx ON public.meeting_attendees(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_attendees TO authenticated;
GRANT ALL ON public.meeting_attendees TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

-- meetings policies
CREATE POLICY "view meetings host attendee or owner"
ON public.meetings FOR SELECT TO authenticated
USING (
  scheduled_by = auth.uid()
  OR private.has_role(auth.uid(), 'owner')
  OR EXISTS (SELECT 1 FROM public.meeting_attendees a WHERE a.meeting_id = id AND a.user_id = auth.uid())
);

CREATE POLICY "insert meetings self"
ON public.meetings FOR INSERT TO authenticated
WITH CHECK (scheduled_by = auth.uid());

CREATE POLICY "update meetings host or owner"
ON public.meetings FOR UPDATE TO authenticated
USING (scheduled_by = auth.uid() OR private.has_role(auth.uid(), 'owner'))
WITH CHECK (scheduled_by = auth.uid() OR private.has_role(auth.uid(), 'owner'));

CREATE POLICY "delete meetings host or owner"
ON public.meetings FOR DELETE TO authenticated
USING (scheduled_by = auth.uid() OR private.has_role(auth.uid(), 'owner'));

-- attendees policies
CREATE POLICY "view attendees if can view meeting"
ON public.meeting_attendees FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id
      AND (m.scheduled_by = auth.uid()
           OR private.has_role(auth.uid(), 'owner')
           OR EXISTS (SELECT 1 FROM public.meeting_attendees a2 WHERE a2.meeting_id = m.id AND a2.user_id = auth.uid()))
  )
);

CREATE POLICY "insert attendees by host or owner"
ON public.meeting_attendees FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.scheduled_by = auth.uid() OR private.has_role(auth.uid(), 'owner')))
);

CREATE POLICY "delete attendees by host or owner"
ON public.meeting_attendees FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.scheduled_by = auth.uid() OR private.has_role(auth.uid(), 'owner')))
);

CREATE TRIGGER meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
