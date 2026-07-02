-- ============================================================
-- STEP 5 of 6 — Role management: how to add / promote / demote users
-- WHERE TO RUN: Supabase Dashboard → SQL Editor (run only the block you need)
--
-- HOW USERS ARE CREATED:
--   1. Owner goes to Supabase Dashboard → Authentication → Users → "Add user"
--      → enter email + password → click Create.
--   2. The trigger `on_auth_user_created` (from STEP 1) auto-creates their
--      profile + gives them role = 'rep' in the default org.
--   3. If you want them to be an OWNER instead, run block A below.
--   4. That's it — they can log in and the app assigns leads / chat by RLS.
-- ============================================================


-- ============================================================
-- BLOCK A — Promote a user to OWNER (full admin powers)
-- Replace the email with the person you want to promote.
-- ============================================================
INSERT INTO public.user_roles (user_id, org_id, role)
SELECT
  u.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'owner'::app_role
FROM auth.users u
WHERE u.email = 'REPLACE_WITH_EMAIL@example.com'
ON CONFLICT (user_id, role) DO NOTHING;


-- ============================================================
-- BLOCK B — Demote an owner back to rep (removes owner powers)
-- ============================================================
DELETE FROM public.user_roles
WHERE role = 'owner'
  AND user_id = (
    SELECT id FROM auth.users
    WHERE email = 'REPLACE_WITH_EMAIL@example.com'
  );


-- ============================================================
-- BLOCK C — Deactivate a user (soft disable — keeps their data / history)
-- They can no longer show up in "assign to rep" dropdowns.
-- ============================================================
UPDATE public.profiles
SET is_active = false
WHERE email = 'REPLACE_WITH_EMAIL@example.com';

-- Re-activate:
-- UPDATE public.profiles SET is_active = true WHERE email = '...';


-- ============================================================
-- BLOCK D — Hard delete a user (removes login + profile + role + all their data)
-- ⚠️ DANGEROUS: cascades to their leads, activities, messages.
-- Only run if you truly want them gone. Prefer BLOCK C.
-- ============================================================
-- DELETE FROM auth.users WHERE email = 'REPLACE_WITH_EMAIL@example.com';


-- ============================================================
-- BLOCK E — List all users and their roles (sanity check)
-- ============================================================
SELECT
  p.email,
  p.name,
  p.is_active,
  COALESCE(string_agg(ur.role::text, ', '), 'no role') AS roles,
  p.created_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
GROUP BY p.email, p.name, p.is_active, p.created_at
ORDER BY p.created_at DESC;
