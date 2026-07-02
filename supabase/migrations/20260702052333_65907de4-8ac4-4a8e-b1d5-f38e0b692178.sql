
-- Commissions system: 20% auto on Won, INR
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL,
  deal_value NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.20,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | paid | voided
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  voided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

CREATE INDEX idx_commissions_rep ON public.commissions(rep_id, status);
CREATE INDEX idx_commissions_org ON public.commissions(org_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Reps see their own; owner sees all in org
CREATE POLICY "rep sees own commissions"
ON public.commissions FOR SELECT TO authenticated
USING (rep_id = auth.uid() OR private.has_role(auth.uid(), 'owner'));

-- Only owner can approve / mark paid / void
CREATE POLICY "owner updates commissions"
ON public.commissions FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'owner'))
WITH CHECK (private.has_role(auth.uid(), 'owner'));

-- No manual inserts/deletes from client (trigger handles it)
CREATE POLICY "service inserts commissions"
ON public.commissions FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "owner deletes commissions"
ON public.commissions FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'owner'));

-- Updated_at trigger
CREATE TRIGGER commissions_updated_at
BEFORE UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create/void commission when lead stage changes
CREATE OR REPLACE FUNCTION public.leads_auto_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate NUMERIC := 0.20;
BEGIN
  -- Lead moved TO won: create/reactivate commission
  IF NEW.stage = 'won' AND (OLD.stage IS DISTINCT FROM 'won') THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.commissions (org_id, lead_id, rep_id, deal_value, commission_rate, commission_amount, status)
      VALUES (
        NEW.org_id,
        NEW.id,
        NEW.assigned_to,
        COALESCE(NEW.deal_value, 0),
        rate,
        COALESCE(NEW.deal_value, 0) * rate,
        'pending'
      )
      ON CONFLICT (lead_id) DO UPDATE
      SET status = CASE WHEN commissions.status = 'voided' THEN 'pending' ELSE commissions.status END,
          deal_value = EXCLUDED.deal_value,
          commission_amount = EXCLUDED.commission_amount,
          voided_at = NULL,
          updated_at = now();
    END IF;
  END IF;

  -- Lead moved AWAY from won: void commission (unless already paid)
  IF OLD.stage = 'won' AND NEW.stage IS DISTINCT FROM 'won' THEN
    UPDATE public.commissions
    SET status = 'voided', voided_at = now()
    WHERE lead_id = NEW.id AND status IN ('pending', 'approved');
  END IF;

  -- Deal value changed while won: sync commission amount (if not paid)
  IF NEW.stage = 'won' AND OLD.stage = 'won' AND NEW.deal_value IS DISTINCT FROM OLD.deal_value THEN
    UPDATE public.commissions
    SET deal_value = COALESCE(NEW.deal_value, 0),
        commission_amount = COALESCE(NEW.deal_value, 0) * commission_rate
    WHERE lead_id = NEW.id AND status IN ('pending', 'approved');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_commission_trigger
AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_auto_commission();

-- Backfill: any existing won leads with no commission yet
INSERT INTO public.commissions (org_id, lead_id, rep_id, deal_value, commission_rate, commission_amount, status)
SELECT l.org_id, l.id, l.assigned_to, COALESCE(l.deal_value, 0), 0.20, COALESCE(l.deal_value, 0) * 0.20, 'pending'
FROM public.leads l
WHERE l.stage = 'won' AND l.assigned_to IS NOT NULL
ON CONFLICT (lead_id) DO NOTHING;
