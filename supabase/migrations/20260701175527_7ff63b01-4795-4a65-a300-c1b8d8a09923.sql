
-- Move SECURITY DEFINER helpers to private schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE ALL ON FUNCTION private.current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate public policies to use private.*
DROP POLICY IF EXISTS "activities: owner all" ON public.activities;
CREATE POLICY "activities: owner all" ON public.activities FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id())
WITH CHECK (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id());

DROP POLICY IF EXISTS "activities: rep insert for own leads" ON public.activities;
CREATE POLICY "activities: rep insert for own leads" ON public.activities FOR INSERT TO authenticated
WITH CHECK (org_id = private.current_org_id() AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())));

DROP POLICY IF EXISTS "activities: rep view for own leads" ON public.activities;
CREATE POLICY "activities: rep view for own leads" ON public.activities FOR SELECT TO authenticated
USING (org_id = private.current_org_id()
  AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())));

DROP POLICY IF EXISTS "imports: owner all" ON public.import_batches;
CREATE POLICY "imports: owner all" ON public.import_batches FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id())
WITH CHECK (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id());

DROP POLICY IF EXISTS "leads: owner all" ON public.leads;
CREATE POLICY "leads: owner all" ON public.leads FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id())
WITH CHECK (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id());

DROP POLICY IF EXISTS "leads: rep insert own" ON public.leads;
CREATE POLICY "leads: rep insert own" ON public.leads FOR INSERT TO authenticated
WITH CHECK (org_id = private.current_org_id() AND created_by = auth.uid()
  AND (assigned_to = auth.uid() OR assigned_to IS NULL));

DROP POLICY IF EXISTS "leads: rep select own" ON public.leads;
CREATE POLICY "leads: rep select own" ON public.leads FOR SELECT TO authenticated
USING (org_id = private.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid()));

-- Tighten leads UPDATE: rep must remain the assignee (no reassignment to others)
DROP POLICY IF EXISTS "leads: rep update own" ON public.leads;
CREATE POLICY "leads: rep update own" ON public.leads FOR UPDATE TO authenticated
USING (org_id = private.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid()))
WITH CHECK (org_id = private.current_org_id() AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "lost: owner all" ON public.lost_reasons;
CREATE POLICY "lost: owner all" ON public.lost_reasons FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id())
WITH CHECK (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id());

DROP POLICY IF EXISTS "lost: rep insert own" ON public.lost_reasons;
CREATE POLICY "lost: rep insert own" ON public.lost_reasons FOR INSERT TO authenticated
WITH CHECK (org_id = private.current_org_id() AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lost_reasons.lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())));

DROP POLICY IF EXISTS "lost: rep view own" ON public.lost_reasons;
CREATE POLICY "lost: rep view own" ON public.lost_reasons FOR SELECT TO authenticated
USING (org_id = private.current_org_id()
  AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lost_reasons.lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())));

DROP POLICY IF EXISTS "messages: insert own" ON public.messages;
CREATE POLICY "messages: insert own" ON public.messages FOR INSERT TO authenticated
WITH CHECK (org_id = private.current_org_id() AND sender_id = auth.uid()
  AND ((channel_type = 'team' AND recipient_id IS NULL) OR (channel_type = 'direct' AND recipient_id IS NOT NULL)));

DROP POLICY IF EXISTS "messages: team read same org" ON public.messages;
CREATE POLICY "messages: team read same org" ON public.messages FOR SELECT TO authenticated
USING (org_id = private.current_org_id()
  AND (channel_type = 'team' OR (channel_type = 'direct' AND (sender_id = auth.uid() OR recipient_id = auth.uid()))));

DROP POLICY IF EXISTS "orgs: view own" ON public.organizations;
CREATE POLICY "orgs: view own" ON public.organizations FOR SELECT TO authenticated
USING (id = private.current_org_id());

DROP POLICY IF EXISTS "profiles: owner update any in org" ON public.profiles;
CREATE POLICY "profiles: owner update any in org" ON public.profiles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'owner') AND org_id = private.current_org_id());

DROP POLICY IF EXISTS "profiles: view same org" ON public.profiles;
CREATE POLICY "profiles: view same org" ON public.profiles FOR SELECT TO authenticated
USING (org_id = private.current_org_id());

DROP POLICY IF EXISTS "roles: view same org" ON public.user_roles;
CREATE POLICY "roles: view same org" ON public.user_roles FOR SELECT TO authenticated
USING (org_id = private.current_org_id());

-- Recreate storage.objects chat_read_scoped policy to use private.has_role
DROP POLICY IF EXISTS chat_read_scoped ON storage.objects;
CREATE POLICY chat_read_scoped ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.image_url LIKE '%' || objects.name || '%' OR m.attachment_url LIKE '%' || objects.name || '%')
        AND (m.channel_type = 'team' OR m.sender_id = auth.uid() OR m.recipient_id = auth.uid() OR private.has_role(auth.uid(), 'owner'))
    )
  )
);

-- Scope avatars reads to same-org members (fixes overly permissive read policy)
DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.org_id = private.current_org_id()
    )
  )
);

-- Now drop old public helpers (no more dependents)
DROP FUNCTION IF EXISTS public.current_org_id();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Enforce created_by immutability on leads updates (defense in depth for reassignment gap)
CREATE OR REPLACE FUNCTION public.leads_prevent_created_by_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS leads_created_by_immutable ON public.leads;
CREATE TRIGGER leads_created_by_immutable BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_prevent_created_by_change();

-- Realtime broadcast/presence lockdown. App uses only postgres_changes (table CDC),
-- not Broadcast or Presence, so deny all direct client access to realtime.messages topics.
DROP POLICY IF EXISTS "realtime deny all client" ON realtime.messages;
CREATE POLICY "realtime deny all client" ON realtime.messages
AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
