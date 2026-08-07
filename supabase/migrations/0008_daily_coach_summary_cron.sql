-- ============================================================
-- Schedules supabase/functions/send-daily-coach-summaries to run
-- once a day via pg_cron + pg_net.
--
-- MANUAL STEPS FIRST (run once, by hand, in the Supabase SQL editor —
-- NOT part of this migration, since migration files are committed to
-- git and these two values are secrets):
--
--   select vault.create_secret(
--     'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-daily-coach-summaries',
--     'daily_summary_url'
--   );
--   select vault.create_secret(
--     'YOUR_CRON_SECRET',  -- must match `supabase secrets set CRON_SECRET=...`
--     'daily_summary_cron_secret'
--   );
--
-- Then run this migration (`supabase db push`, or paste it into the
-- SQL editor same as any other migration in this folder).
--
-- Timezone note: pg_cron schedules run in fixed UTC and don't shift
-- with a target timezone's daylight saving. 11:00 UTC lands at 9pm
-- AEST or 10pm AEDT — inside the checklist's "~10-11pm" window most
-- of the year, an hour early during non-DST months. Adjust the cron
-- expression below (or re-run cron.alter_job) if that drift matters;
-- see REPORT_TIMEZONE in the function itself for the date-boundary
-- side of the same tradeoff.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-coach-summaries',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_summary_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_summary_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To change the time later:
--   select cron.alter_job((select jobid from cron.job where jobname = 'daily-coach-summaries'), schedule := '30 11 * * *');
-- To stop it entirely:
--   select cron.unschedule('daily-coach-summaries');
