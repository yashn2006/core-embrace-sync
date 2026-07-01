
-- 1) Add progress column
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS progress smallint NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- 2) Fix infinite recursion between meetings and meeting_attendees policies
-- Create SECURITY DEFINER helpers in private schema
CREATE OR REPLACE FUNCTION private.can_view_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = _meeting_id
      AND (
        m.scheduled_by = _user_id
        OR private.has_role(_user_id, 'owner'::app_role)
        OR EXISTS (SELECT 1 FROM public.meeting_attendees a WHERE a.meeting_id = m.id AND a.user_id = _user_id)
        OR (m.lead_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.leads l WHERE l.id = m.lead_id AND (l.assigned_to = _user_id OR l.created_by = _user_id)
        ))
      )
  )
$$;

REVOKE ALL ON FUNCTION private.can_view_meeting(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_view_meeting(uuid, uuid) TO authenticated, service_role;

-- Rewrite meetings SELECT policy without cross-referencing meeting_attendees via subquery that RLS re-checks
DROP POLICY IF EXISTS "view meetings host attendee owner or lead rep" ON public.meetings;
CREATE POLICY "view meetings host attendee owner or lead rep"
ON public.meetings
FOR SELECT
TO authenticated
USING (private.can_view_meeting(id, auth.uid()));

-- Rewrite meeting_attendees SELECT policy to avoid self-reference recursion
DROP POLICY IF EXISTS "view attendees if can view meeting" ON public.meeting_attendees;
CREATE POLICY "view attendees if can view meeting"
ON public.meeting_attendees
FOR SELECT
TO authenticated
USING (private.can_view_meeting(meeting_id, auth.uid()));
