-- Schedule RSS ingest to run every 60 minutes
-- This uses pg_cron extension (available in Supabase)

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule RSS ingest job
-- Runs every 60 minutes (cron: '0 * * * *' means "at minute 0 of every hour")
-- The job calls the ingest_rss Edge Function via http extension

-- First, ensure http extension is enabled for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function to trigger RSS ingest via Edge Function
-- This uses the Supabase project's internal function URL
CREATE OR REPLACE FUNCTION public.trigger_rss_ingest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text;
  anon_key text;
  response http_response;
BEGIN
  -- Get Supabase project URL and anon key from settings
  -- In Supabase, these are available via current_setting() or env vars
  -- For Edge Functions, we use the internal function URL
  project_url := current_setting('app.settings.supabase_url', true);
  
  -- If setting doesn't exist, try to get from environment
  IF project_url IS NULL THEN
    -- In Supabase Cloud, Edge Functions are accessible via internal URL
    -- Format: http://kong:8000/functions/v1/ingest_rss
    -- For local: http://localhost:54321/functions/v1/ingest_rss
    -- For production, use the Edge Function's internal URL
    project_url := 'http://kong:8000';
  END IF;

  -- Make HTTP request to Edge Function
  SELECT * INTO response
  FROM http_post(
    url := project_url || '/functions/v1/ingest_rss',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    ),
    body := jsonb_build_object(
      'maxFeeds', 50,
      'perFeedLimit', 100
    )
  );

  -- Log the response (optional, can check cron logs)
  IF response.status != 200 THEN
    RAISE WARNING 'RSS ingest returned status %: %', response.status, response.content;
  END IF;
END;
$$;

-- Schedule the job to run every 60 minutes
-- Cron format: minute hour day month weekday
-- '*/60 * * * *' means every 60 minutes
-- Actually, pg_cron uses standard cron syntax where */60 is not valid for minutes
-- Use '0 * * * *' for every hour at minute 0, or */30 for every 30 minutes
SELECT cron.schedule(
  'rss-ingest-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.trigger_rss_ingest();
  $$
);

-- Alternative: Run every 30 minutes
-- Uncomment and comment out the above if you want 30-minute intervals
-- SELECT cron.schedule(
--   'rss-ingest-30min',
--   '*/30 * * * *', -- Every 30 minutes
--   $$
--   SELECT public.trigger_rss_ingest();
--   $$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('rss-ingest-hourly');

-- To update the schedule:
-- SELECT cron.unschedule('rss-ingest-hourly');
-- SELECT cron.schedule('rss-ingest-hourly', '*/30 * * * *', $$SELECT public.trigger_rss_ingest();$$);



