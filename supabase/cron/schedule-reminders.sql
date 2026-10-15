-- ============================================================================
--  Run once per project AFTER deploying the send-reminders function.
--  Replace <project-ref> and <CRON_SECRET> (the same value you set with
--  `supabase secrets set CRON_SECRET=...`). Not a migration because it holds
--  project-specific values.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-reminders', 'mizan_reminders_url');
select vault.create_secret('<CRON_SECRET>', 'mizan_reminders_secret');

-- Every minute. The function looks back 10 minutes and dedupes, so missed runs are caught up.
select cron.schedule(
  'mizan-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'mizan_reminders_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mizan_reminders_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- To stop:  select cron.unschedule('mizan-send-reminders');
