-- Schedule ingestion to run continuously using pg_cron
-- This replaces the Vercel cron job with pg_cron for better observability
-- Runs every 30 minutes (same as Vercel cron)

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Unschedule the old RSS-only job if it exists
SELECT cron.unschedule('rss-ingest-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'rss-ingest-hourly'
);

-- Create function to trigger cron_runner Edge Function
-- This uses the service role key (stored as a setting or passed via env)
CREATE OR REPLACE FUNCTION public.trigger_ingestion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text;
  service_key text;
  response http_response;
  cron_secret text;
BEGIN
  -- Get Supabase project URL (internal URL for Edge Functions)
  -- In Supabase Cloud, Edge Functions are accessible via kong gateway
  project_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'http://kong:8000' -- Internal Supabase URL for Edge Functions
  );

  -- Get service role key from settings (set via Supabase dashboard or env)
  -- NOTE: Service role key should NOT be committed to repo
  -- Set it as a Postgres setting or use env var (preferred: use Supabase dashboard settings)
  service_key := current_setting('app.settings.supabase_service_role_key', true);
  
  -- If setting doesn't exist, we can't proceed (fail gracefully)
  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'Supabase service role key not configured. Set app.settings.supabase_service_role_key';
    RETURN;
  END IF;

  -- Get CRON_SECRET if configured (optional, for additional security)
  cron_secret := current_setting('app.settings.cron_secret', true);

  -- Make HTTP request to cron_runner Edge Function
  -- Use service role key for authentication (bypasses x-cron-secret requirement)
  SELECT * INTO response
  FROM http_post(
    url := project_url || '/functions/v1/cron_runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ) || CASE 
      WHEN cron_secret IS NOT NULL AND cron_secret != '' THEN
        jsonb_build_object('x-cron-secret', cron_secret)
      ELSE
        '{}'::jsonb
    END,
    body := '{}'::jsonb
  );

  -- Log the response (check cron logs for issues)
  IF response.status != 200 THEN
    RAISE WARNING 'Ingestion cron_runner returned status %: %', response.status, response.content;
  END IF;
END;
$$;

-- Schedule the job to run every 30 minutes (same as Vercel cron)
-- Cron format: minute hour day month weekday
-- '*/30 * * * *' means every 30 minutes
SELECT cron.schedule(
  'ingestion-runner',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT public.trigger_ingestion();
  $$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To unschedule the job:
-- SELECT cron.unschedule('ingestion-runner');

-- To update the schedule (e.g., change to hourly):
-- SELECT cron.unschedule('ingestion-runner');
-- SELECT cron.schedule('ingestion-runner', '0 * * * *', $$SELECT public.trigger_ingestion();$$);

-- Notes:
-- 1. Service role key must be set as a Postgres setting:
--    ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'your-service-role-key';
--    OR use Supabase Dashboard > Settings > Database > Connection Pooling (set custom settings)
--
-- 2. CRON_SECRET (optional) can be set similarly:
--    ALTER DATABASE postgres SET app.settings.cron_secret = 'your-cron-secret';
--
-- 3. NEVER commit service role key to git - use Supabase dashboard or environment variables

