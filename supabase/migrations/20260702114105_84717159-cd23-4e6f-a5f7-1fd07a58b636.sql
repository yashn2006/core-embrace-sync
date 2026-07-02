
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS leads_tags_gin ON public.leads USING GIN (tags);
CREATE INDEX IF NOT EXISTS leads_email_lower ON public.leads (org_id, lower(email));
CREATE INDEX IF NOT EXISTS leads_phone_idx ON public.leads (org_id, phone);
