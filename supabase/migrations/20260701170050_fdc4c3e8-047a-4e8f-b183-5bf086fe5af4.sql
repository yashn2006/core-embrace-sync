
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner', 'rep');
CREATE TYPE public.lead_stage AS ENUM ('new', 'contacted', 'interested', 'meeting_scheduled', 'proposal_sent', 'won', 'lost');
CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'cold_outreach', 'linkedin', 'whatsapp', 'other');
CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note');
CREATE TYPE public.channel_type AS ENUM ('team', 'direct');

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
