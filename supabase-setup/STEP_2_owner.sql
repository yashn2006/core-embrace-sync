-- ============================================================
-- STEP 2 of 3 — Make YOUR account the OWNER (super admin)
-- WHERE TO RUN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- BEFORE running this, do these clicks first:
--   1. Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
--   2. Email: parkarsaad2021@gmail.com
--   3. Password: Saad@parkar2021
--   4. Turn ON "Auto Confirm User"
--   5. Click "Create user"
--
-- THEN run this SQL below.
-- ============================================================

-- Make sure the default org exists
INSERT INTO public.organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'CoreEgin')
ON CONFLICT (id) DO NOTHING;

-- Grant owner role to your account
INSERT INTO public.user_roles (user_id, org_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001', 'owner'
FROM auth.users
WHERE email = 'parkarsaad2021@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Make sure profile has your name
UPDATE public.profiles
SET name = 'Saad Parkar (Founder)'
WHERE email = 'parkarsaad2021@gmail.com';
