-- Ensure required extensions exist for cron + http calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedule with the same name so this is idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('coreegin-daily-digest');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Daily at 08:00 UTC → invoke the daily-digest edge function
SELECT cron.schedule(
  'coreegin-daily-digest',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url := 'https://otoejkcuzqmwgfxwvrrz.supabase.co/functions/v1/daily-digest',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);