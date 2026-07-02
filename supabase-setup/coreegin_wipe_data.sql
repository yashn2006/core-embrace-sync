-- CoreEgin: wipe all app data + keep only the OWNER login.
-- Safe to run in Supabase SQL editor. Schema, RLS, and org rows stay intact.
BEGIN;

-- 1) Erase transactional data
TRUNCATE TABLE
  public.push_notifications_queue,
  public.push_subscriptions,
  public.meeting_attendees,
  public.meetings,
  public.chat_reads,
  public.messages,
  public.activities,
  public.lost_reasons,
  public.import_batches,
  public.leads
RESTART IDENTITY CASCADE;

-- 2) Delete every auth user that is NOT an owner.
--    Profiles + user_roles cascade automatically.
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.user_roles WHERE role = 'owner'
);

COMMIT;
