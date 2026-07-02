
-- ============ MESSAGE TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl_read_org" ON public.message_templates FOR SELECT TO authenticated
  USING (org_id = private.current_org_id());
CREATE POLICY "tpl_insert_self" ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (org_id = private.current_org_id() AND created_by = auth.uid());
CREATE POLICY "tpl_update_own_or_owner" ON public.message_templates FOR UPDATE TO authenticated
  USING (org_id = private.current_org_id() AND (created_by = auth.uid() OR private.has_role(auth.uid(), 'owner')));
CREATE POLICY "tpl_delete_own_or_owner" ON public.message_templates FOR DELETE TO authenticated
  USING (org_id = private.current_org_id() AND (created_by = auth.uid() OR private.has_role(auth.uid(), 'owner')));

CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS message_templates_org_cat ON public.message_templates (org_id, category);

-- ============ SALES GOALS ============
CREATE TABLE IF NOT EXISTS public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  rep_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of month
  target_amount NUMERIC NOT NULL DEFAULT 0,
  target_leads INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, rep_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_goals TO authenticated;
GRANT ALL ON public.sales_goals TO service_role;

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Reps see their own; owners see all
CREATE POLICY "goals_read" ON public.sales_goals FOR SELECT TO authenticated
  USING (org_id = private.current_org_id() AND (rep_id = auth.uid() OR private.has_role(auth.uid(), 'owner')));
-- Only owners write
CREATE POLICY "goals_insert_owner" ON public.sales_goals FOR INSERT TO authenticated
  WITH CHECK (org_id = private.current_org_id() AND private.has_role(auth.uid(), 'owner'));
CREATE POLICY "goals_update_owner" ON public.sales_goals FOR UPDATE TO authenticated
  USING (org_id = private.current_org_id() AND private.has_role(auth.uid(), 'owner'));
CREATE POLICY "goals_delete_owner" ON public.sales_goals FOR DELETE TO authenticated
  USING (org_id = private.current_org_id() AND private.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
