-- =====================================================================
-- CoreEgin — Commissions module (20% auto on Won)
-- Run AFTER STEP_1_schema.sql. Idempotent.
-- =====================================================================

-- 1) Enum for commission status ---------------------------------------
DO $$ BEGIN
  CREATE TYPE public.commission_status AS ENUM ('pending','approved','paid','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id           UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  rep_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deal_value        NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_rate   NUMERIC(5,4)  NOT NULL DEFAULT 0.20,   -- 20%
  commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status            public.commission_status NOT NULL DEFAULT 'pending',
  notes             TEXT,
  approved_at       TIMESTAMPTZ,
  approved_by       UUID REFERENCES public.profiles(id),
  paid_at           TIMESTAMPTZ,
  paid_by           UUID REFERENCES public.profiles(id),
  voided_at         TIMESTAMPTZ,
  voided_by         UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commissions_rep_idx    ON public.commissions(rep_id);
CREATE INDEX IF NOT EXISTS commissions_status_idx ON public.commissions(status);
CREATE INDEX IF NOT EXISTS commissions_org_idx    ON public.commissions(org_id);

-- 3) GRANTS (required — RLS alone is not enough) ----------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;

-- 4) updated_at trigger -----------------------------------------------
DROP TRIGGER IF EXISTS commissions_set_updated_at ON public.commissions;
CREATE TRIGGER commissions_set_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) RLS ---------------------------------------------------------------
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep sees own commissions" ON public.commissions;
CREATE POLICY "rep sees own commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    rep_id = auth.uid()
    OR private.has_role(auth.uid(), 'owner')
  );

DROP POLICY IF EXISTS "owner inserts commissions" ON public.commissions;
CREATE POLICY "owner inserts commissions"
  ON public.commissions FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "owner updates commissions" ON public.commissions;
CREATE POLICY "owner updates commissions"
  ON public.commissions FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'))
  WITH CHECK (private.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "owner deletes commissions" ON public.commissions;
CREATE POLICY "owner deletes commissions"
  ON public.commissions FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'));

-- 6) Auto-commission trigger on leads ---------------------------------
-- When stage flips to 'won'  → insert (or reactivate) pending commission at 20%
-- When stage leaves 'won'    → void pending/approved (paid rows are frozen)
-- When deal_value changes while won → sync commission_amount
CREATE OR REPLACE FUNCTION public.leads_auto_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate NUMERIC := 0.20;   -- <<<<<< 20% commission rate
BEGIN
  -- Moved TO won
  IF NEW.stage = 'won' AND (OLD.stage IS DISTINCT FROM 'won') THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.commissions
        (org_id, lead_id, rep_id, deal_value, commission_rate, commission_amount, status)
      VALUES
        (NEW.org_id, NEW.id, NEW.assigned_to,
         COALESCE(NEW.deal_value, 0), rate,
         COALESCE(NEW.deal_value, 0) * rate, 'pending')
      ON CONFLICT (lead_id) DO UPDATE
        SET status = CASE WHEN commissions.status = 'voided'
                          THEN 'pending' ELSE commissions.status END,
            deal_value = EXCLUDED.deal_value,
            commission_amount = EXCLUDED.commission_amount,
            voided_at = NULL,
            updated_at = now();
    END IF;
  END IF;

  -- Moved AWAY from won → void (unless paid)
  IF OLD.stage = 'won' AND NEW.stage IS DISTINCT FROM 'won' THEN
    UPDATE public.commissions
       SET status = 'voided', voided_at = now()
     WHERE lead_id = NEW.id AND status IN ('pending','approved');
  END IF;

  -- Deal value changed while still won → sync amount
  IF NEW.stage = 'won' AND OLD.stage = 'won'
     AND NEW.deal_value IS DISTINCT FROM OLD.deal_value THEN
    UPDATE public.commissions
       SET deal_value = COALESCE(NEW.deal_value, 0),
           commission_amount = COALESCE(NEW.deal_value, 0) * commission_rate
     WHERE lead_id = NEW.id AND status IN ('pending','approved');
  END IF;

  RETURN NEW;
END;
$$;

-- Lock down: no direct execution from clients
REVOKE ALL ON FUNCTION public.leads_auto_commission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS leads_commission_trigger ON public.leads;
CREATE TRIGGER leads_commission_trigger
  AFTER UPDATE OF stage, deal_value ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_auto_commission();

-- =====================================================================
-- END-TO-END TEST (safe to run — cleans up after itself)
-- Replace <REP_UUID> and <OWNER_UUID> with real profile ids.
-- =====================================================================
-- DO $$
-- DECLARE lead_row public.leads; c public.commissions;
-- BEGIN
--   INSERT INTO public.leads (org_id,name,company,stage,deal_value,assigned_to,created_by,source)
--   VALUES ('00000000-0000-0000-0000-000000000001','__TEST__','Co','new',50000,
--           '<REP_UUID>','<OWNER_UUID>','other') RETURNING * INTO lead_row;
--
--   UPDATE public.leads SET stage='won', won_at=now() WHERE id = lead_row.id;
--   SELECT * INTO c FROM public.commissions WHERE lead_id = lead_row.id;
--   ASSERT c.commission_amount = 10000, 'expected 20% of 50000 = 10000';
--
--   UPDATE public.leads SET deal_value=75000 WHERE id = lead_row.id;
--   SELECT * INTO c FROM public.commissions WHERE lead_id = lead_row.id;
--   ASSERT c.commission_amount = 15000, 'expected sync to 15000';
--
--   UPDATE public.leads SET stage='contacted' WHERE id = lead_row.id;
--   SELECT * INTO c FROM public.commissions WHERE lead_id = lead_row.id;
--   ASSERT c.status = 'voided', 'expected void on stage-away';
--
--   DELETE FROM public.commissions WHERE lead_id = lead_row.id;
--   DELETE FROM public.leads WHERE id = lead_row.id;
-- END $$;