
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  actor_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view audit logs in their org"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  org_id = private.current_org_id()
  AND private.has_role(auth.uid(), 'owner')
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_org_time ON public.audit_logs (org_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.leads_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diff JSONB := '{}'::jsonb;
  fields TEXT[] := ARRAY['stage','assigned_to','deal_value','custom_status','progress','name','email','phone','company'];
  f TEXT;
  old_val JSONB;
  new_val JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, changes)
    VALUES (NEW.org_id, auth.uid(), 'lead', NEW.id, 'insert',
            jsonb_build_object('name', NEW.name, 'stage', NEW.stage, 'assigned_to', NEW.assigned_to));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    FOREACH f IN ARRAY fields LOOP
      old_val := to_jsonb(OLD) -> f;
      new_val := to_jsonb(NEW) -> f;
      IF old_val IS DISTINCT FROM new_val THEN
        diff := diff || jsonb_build_object(f, jsonb_build_object('from', old_val, 'to', new_val));
      END IF;
    END LOOP;
    IF diff <> '{}'::jsonb THEN
      INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, changes)
      VALUES (NEW.org_id, auth.uid(), 'lead', NEW.id, 'update', diff);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, changes)
    VALUES (OLD.org_id, auth.uid(), 'lead', OLD.id, 'delete',
            jsonb_build_object('name', OLD.name, 'stage', OLD.stage));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_audit ON public.leads;
CREATE TRIGGER trg_leads_audit
AFTER INSERT OR UPDATE OR DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_audit_trigger();
