
-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('owner', 'rep'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lead_stage AS ENUM ('new', 'contacted', 'interested', 'meeting_scheduled', 'proposal_sent', 'won', 'lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'cold_outreach', 'linkedin', 'whatsapp', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.channel_type AS ENUM ('team', 'direct'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Seed default org
INSERT INTO public.organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'CoreEgin');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ has_role (SECURITY DEFINER — avoids RLS recursion) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============ AUTO-PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_org UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles (id, org_id, name, email)
  VALUES (
    NEW.id,
    default_org,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- default new users to 'rep'; owner role granted manually
  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, default_org, 'rep')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PROFILES POLICIES ============
CREATE POLICY "profiles: view same org" ON public.profiles FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: owner update any in org" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id());

-- ============ USER_ROLES POLICIES ============
CREATE POLICY "roles: view same org" ON public.user_roles FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
-- Only service_role writes roles (owners use admin-side actions through server functions)

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  description TEXT,
  source lead_source NOT NULL DEFAULT 'other',
  stage lead_stage NOT NULL DEFAULT 'new',
  deal_value NUMERIC(14,2),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  import_batch_id UUID,
  next_follow_up TIMESTAMPTZ,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  handoff_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_org ON public.leads(org_id);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_follow_up ON public.leads(next_follow_up);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "leads: owner all" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id())
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id());

CREATE POLICY "leads: rep select own" ON public.leads FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid()));

CREATE POLICY "leads: rep insert own" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND created_by = auth.uid() AND (assigned_to = auth.uid() OR assigned_to IS NULL));

CREATE POLICY "leads: rep update own" ON public.leads FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid()))
  WITH CHECK (org_id = public.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid()));

-- ============ ACTIVITIES ============
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  outcome TEXT,
  response_text TEXT,
  next_action TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_lead ON public.activities(lead_id);
CREATE INDEX idx_activities_org ON public.activities(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities: owner all" ON public.activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id())
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id());

CREATE POLICY "activities: rep view for own leads" ON public.activities FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  ));

CREATE POLICY "activities: rep insert for own leads" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  ));

-- ============ LOST_REASONS ============
CREATE TABLE public.lost_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lost_reasons TO authenticated;
GRANT ALL ON public.lost_reasons TO service_role;
ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lost: owner all" ON public.lost_reasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id())
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id());
CREATE POLICY "lost: rep view own" ON public.lost_reasons FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  ));
CREATE POLICY "lost: rep insert own" ON public.lost_reasons FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  ));

-- ============ IMPORT_BATCHES ============
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imports: owner all" ON public.import_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id())
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND org_id = public.current_org_id());

-- ============ MESSAGES (chat) ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_type channel_type NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_org ON public.messages(org_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX idx_messages_direct ON public.messages(sender_id, recipient_id) WHERE channel_type = 'direct';
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages: team read same org" ON public.messages FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id() AND (
      channel_type = 'team'
      OR (channel_type = 'direct' AND (sender_id = auth.uid() OR recipient_id = auth.uid()))
    )
  );

CREATE POLICY "messages: insert own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND sender_id = auth.uid()
    AND (
      (channel_type = 'team' AND recipient_id IS NULL)
      OR (channel_type = 'direct' AND recipient_id IS NOT NULL)
    )
  );

CREATE POLICY "messages: recipient mark read" ON public.messages FOR UPDATE TO authenticated
  USING (channel_type = 'direct' AND recipient_id = auth.uid())
  WITH CHECK (channel_type = 'direct' AND recipient_id = auth.uid());

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;

-- Org read policy
CREATE POLICY "orgs: view own" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

DROP POLICY IF EXISTS "chat_read_auth" ON storage.objects;
CREATE POLICY "chat_read_auth" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_upload_own" ON storage.objects;
CREATE POLICY "chat_upload_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "chat_delete_own" ON storage.objects;
CREATE POLICY "chat_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DO $seed$
DECLARE
  owner_id UUID;
  batch_id UUID;
  new_lead_id UUID;
BEGIN
  SELECT id INTO owner_id FROM public.profiles WHERE email = 'parkarsaad2021@gmail.com' LIMIT 1;
  IF owner_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.leads LIMIT 1) THEN RETURN; END IF;

  INSERT INTO public.import_batches (org_id, uploaded_by, assigned_to, filename, row_count)
  VALUES ('00000000-0000-0000-0000-000000000001', owner_id, owner_id, 'seed_demo.csv', 12)
  RETURNING id INTO batch_id;

  INSERT INTO public.leads (org_id, name, email, phone, company, description, source, stage, deal_value, assigned_to, created_by, import_batch_id, next_follow_up)
  VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rohan Mehta', 'rohan@pixelcafe.in', '+91 98200 11122', 'Pixel Gaming Cafe', 'Wants a full website + booking system for their new outlet.', 'website', 'new', 2500, owner_id, owner_id, batch_id, now() + interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'Aisha Khan', 'aisha@lumibrew.co', '+971 50 111 2233', 'LumiBrew Coffee', 'Rebrand + Shopify migration for 3 stores in Dubai.', 'referral', 'contacted', 8500, owner_id, owner_id, batch_id, now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'Marco Rossi', 'marco@velostudio.it', '+39 340 998 7712', 'Velo Studio', 'Landing page for their new cycling gear line.', 'linkedin', 'interested', 3200, owner_id, owner_id, batch_id, now() + interval '3 days'),
  ('00000000-0000-0000-0000-000000000001', 'Nadia Rahman', 'nadia@bloomivf.com', '+880 1711 223344', 'Bloom IVF', 'Patient portal + booking flow.', 'cold_outreach', 'meeting_scheduled', 12500, owner_id, owner_id, batch_id, now() + interval '5 days'),
  ('00000000-0000-0000-0000-000000000001', 'Kabir Anand', 'kabir@sprintcrm.io', '+91 99870 44556', 'Sprint CRM', 'CRM integration + custom dashboards.', 'website', 'proposal_sent', 15000, owner_id, owner_id, batch_id, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'Lena Vogel', 'lena@nordkraft.de', '+49 151 22334455', 'Nordkraft GmbH', 'Full brand + design system.', 'referral', 'proposal_sent', 22000, owner_id, owner_id, batch_id, now() + interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'Diego Alvarez', 'diego@surfschool.mx', NULL, 'Baja Surf School', 'Booking widget + Instagram integration.', 'whatsapp', 'contacted', 1800, owner_id, owner_id, batch_id, now() + interval '4 days'),
  ('00000000-0000-0000-0000-000000000001', 'Fatima Noor', 'fatima@atelierno.com', '+92 300 1234567', 'Atelier No.', 'E-commerce for handmade jewelry.', 'linkedin', 'new', 4500, owner_id, owner_id, batch_id, now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'Yuki Tanaka', 'yuki@matcharoom.jp', '+81 90 1234 5678', 'Matcha Room', 'Small ordering site + loyalty.', 'website', 'won', 6800, owner_id, owner_id, batch_id, NULL),
  ('00000000-0000-0000-0000-000000000001', 'Samuel Okafor', 'samuel@velaralogistics.com', '+234 803 445 6677', 'Velara Logistics', 'Route tracking dashboard.', 'cold_outreach', 'interested', 9200, owner_id, owner_id, batch_id, now() + interval '6 days'),
  ('00000000-0000-0000-0000-000000000001', 'Priya Sharma', 'priya@luxeorganics.in', '+91 98111 22333', 'Luxe Organics', 'Skincare DTC storefront.', 'referral', 'lost', 3000, owner_id, owner_id, batch_id, NULL),
  ('00000000-0000-0000-0000-000000000001', 'Chen Wei', 'chen@fluxfin.hk', '+852 6123 4567', 'FluxFin', 'Investor portal MVP.', 'linkedin', 'meeting_scheduled', 18000, owner_id, owner_id, batch_id, now() + interval '3 days');

  FOR new_lead_id IN SELECT id FROM public.leads WHERE org_id = '00000000-0000-0000-0000-000000000001' ORDER BY created_at LIMIT 4 LOOP
    INSERT INTO public.activities (lead_id, org_id, type, outcome, response_text, created_by)
    VALUES (new_lead_id, '00000000-0000-0000-0000-000000000001', 'call', 'Interested', 'They liked the initial pitch — sending deck tomorrow.', owner_id);
  END LOOP;

  INSERT INTO public.lost_reasons (lead_id, org_id, reason, note, created_by)
  SELECT id, org_id, 'Price', 'Went with a cheaper freelancer.', owner_id FROM public.leads WHERE stage='lost' LIMIT 1;
END $seed$;

DROP POLICY IF EXISTS "chat_read_auth" ON storage.objects;

CREATE POLICY "chat_read_scoped" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.image_url LIKE '%' || storage.objects.name || '%'
        AND (
          m.channel_type = 'team'
          OR m.sender_id = auth.uid()
          OR m.recipient_id = auth.uid()
          OR public.has_role(auth.uid(), 'owner')
        )
    )
  )
);

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_user_write" ON storage.objects;
CREATE POLICY "avatars_user_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
CREATE POLICY "avatars_user_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Extend messages: link to lead, quick-tag, generic file attachments
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quick_tag TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON public.messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_type, created_at DESC);

-- Per-channel read receipts so unread badges clear only for the channel opened
CREATE TABLE IF NOT EXISTS public.chat_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_reads TO authenticated;
GRANT ALL ON public.chat_reads TO service_role;

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own read receipts"
  ON public.chat_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_status text;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subs read" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own subs write" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

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
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any prior schedule
do $$
declare jid int;
begin
  select jobid into jid from cron.job where jobname = 'send-push-every-minute';
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
  'send-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://otoejkcuzqmwgfxwvrrz.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendees;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_attendees TO authenticated;
GRANT ALL ON public.meeting_attendees TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

GRANT ALL ON public.push_notifications_queue TO service_role;
