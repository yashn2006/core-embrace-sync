CREATE TABLE public.ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable','openai','gemini')),
  api_key TEXT,
  model TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view ai_settings"
  ON public.ai_settings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Owners can insert ai_settings"
  ON public.ai_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Owners can update ai_settings"
  ON public.ai_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Owners can delete ai_settings"
  ON public.ai_settings FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE TRIGGER trg_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();