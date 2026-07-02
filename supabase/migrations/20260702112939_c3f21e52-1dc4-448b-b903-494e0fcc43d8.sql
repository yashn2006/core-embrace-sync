
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Owners can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = private.current_org_id()
  AND private.has_role(auth.uid(), 'owner')
);

REVOKE ALL ON FUNCTION public.leads_audit_trigger() FROM PUBLIC, anon, authenticated;
