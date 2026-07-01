create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any prior schedule
do $$
declare jid int;
begin
  select jobid into jid from cron.job where jobname = 'send-push-every-minute';
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
  'send-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://otoejkcuzqmwgfxwvrrz.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);