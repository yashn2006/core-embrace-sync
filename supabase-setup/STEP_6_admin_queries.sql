-- ============================================================
-- STEP 6 of 6 — Useful admin / debug queries
-- WHERE TO RUN: Supabase Dashboard → SQL Editor (run only the block you need)
-- These are OPTIONAL — the CRM app already does all of this from the UI.
-- Keep this file as a cheat sheet for when something looks off.
-- ============================================================


-- ============================================================
-- Q1 — Assign a batch of leads to a specific rep by email
-- (owner-only action, also available from the CRM UI)
-- ============================================================
UPDATE public.leads
SET owner_id = (SELECT id FROM auth.users WHERE email = 'rep@example.com')
WHERE id = ANY (ARRAY[
  'LEAD_UUID_1'::uuid,
  'LEAD_UUID_2'::uuid
]);


-- ============================================================
-- Q2 — Reassign ALL leads from one rep to another
-- (use when a rep leaves the team)
-- ============================================================
UPDATE public.leads
SET owner_id = (SELECT id FROM auth.users WHERE email = 'new_rep@example.com')
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'old_rep@example.com');


-- ============================================================
-- Q3 — Unassign leads (put back in the "unassigned" pool)
-- ============================================================
UPDATE public.leads
SET owner_id = NULL
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'rep@example.com');


-- ============================================================
-- Q4 — Rep performance snapshot (leads by stage, per rep)
-- ============================================================
SELECT
  p.name        AS rep,
  l.stage,
  COUNT(*)      AS leads,
  SUM(l.value)  AS pipeline_value
FROM public.leads l
JOIN public.profiles p ON p.id = l.owner_id
GROUP BY p.name, l.stage
ORDER BY p.name, l.stage;


-- ============================================================
-- Q5 — Conversion rate per rep (won ÷ total, last 30 days)
-- ============================================================
SELECT
  p.name AS rep,
  COUNT(*) FILTER (WHERE l.stage = 'won')  AS won,
  COUNT(*) FILTER (WHERE l.stage = 'lost') AS lost,
  COUNT(*)                                 AS total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE l.stage = 'won') / NULLIF(COUNT(*), 0),
    1
  ) AS win_rate_pct
FROM public.leads l
JOIN public.profiles p ON p.id = l.owner_id
WHERE l.created_at >= now() - INTERVAL '30 days'
GROUP BY p.name
ORDER BY win_rate_pct DESC NULLS LAST;


-- ============================================================
-- Q6 — Recent activity across all leads (last 50 events)
-- ============================================================
SELECT
  a.created_at,
  p.name  AS actor,
  a.type,
  l.name  AS lead,
  a.body
FROM public.activities a
JOIN public.profiles p ON p.id = a.actor_id
LEFT JOIN public.leads l ON l.id = a.lead_id
ORDER BY a.created_at DESC
LIMIT 50;


-- ============================================================
-- Q7 — Stale leads (no activity in 7+ days, not won/lost)
-- Useful for daily follow-up nudges.
-- ============================================================
SELECT
  l.id,
  l.name,
  l.stage,
  p.name AS owner,
  l.updated_at,
  now()::date - l.updated_at::date AS days_stale
FROM public.leads l
LEFT JOIN public.profiles p ON p.id = l.owner_id
WHERE l.stage NOT IN ('won', 'lost')
  AND l.updated_at < now() - INTERVAL '7 days'
ORDER BY l.updated_at ASC;


-- ============================================================
-- Q8 — Delete a single lead (owner-only in RLS; also available from UI)
-- ============================================================
-- DELETE FROM public.leads WHERE id = 'LEAD_UUID'::uuid;


-- ============================================================
-- Q9 — Verify RLS is ON for every public table (sanity check)
-- All rows should show rowsecurity = true.
-- ============================================================
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- ============================================================
-- Q10 — Count everything (quick dashboard from SQL)
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM public.profiles)   AS users,
  (SELECT COUNT(*) FROM public.leads)      AS leads,
  (SELECT COUNT(*) FROM public.activities) AS activities,
  (SELECT COUNT(*) FROM public.messages)   AS messages,
  (SELECT COUNT(*) FROM public.meetings)   AS meetings;
