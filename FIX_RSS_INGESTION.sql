-- ============================================================
-- FIX RSS INGESTION - SETUP pg_cron SCHEDULES
-- ============================================================
-- Run this in Supabase SQL Editor AFTER running DIAGNOSE_RSS_INGESTION.sql
-- 
-- PREREQUISITES:
-- 1. Get your project URL: Supabase Dashboard → Settings → API → Project URL
-- 2. Get your CRON_SECRET: Run `supabase secrets list` or check Edge Function secrets
-- 3. Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET_HERE below
-- ============================================================

-- STEP 1: Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- STEP 2: Remove any existing kivaw schedules (to avoid duplicates)
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname LIKE 'kivaw%';

-- STEP 3: Create Hourly RSS Ingestion Schedule
-- Replace YOUR_PROJECT_REF with your actual project reference (e.g., 'pjuueamhdxqdrnxvavwd')
-- Replace YOUR_CRON_SECRET_HERE with your actual CRON_SECRET value
SELECT cron.schedule(
  'kivaw-hourly-rss',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_CRON_SECRET_HERE'
      ),
      body := jsonb_build_object('job', 'hourly')
    ) AS request_id;
  $$
);

-- STEP 4: Create Six-Hour Watch Content Refresh Schedule
SELECT cron.schedule(
  'kivaw-six-hour-tmdb',
  '0 */6 * * *',  -- Every 6 hours at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_CRON_SECRET_HERE'
      ),
      body := jsonb_build_object('job', 'six_hour')
    ) AS request_id;
  $$
);

-- STEP 5: Create Daily Books Refresh + RSS Prune Schedule
SELECT cron.schedule(
  'kivaw-daily-books',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_CRON_SECRET_HERE'
      ),
      body := jsonb_build_object('job', 'daily')
    ) AS request_id;
  $$
);

-- STEP 6: Verify schedules were created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ INACTIVE'
  END as status
FROM cron.job 
WHERE jobname LIKE 'kivaw%'
ORDER BY jobname;

-- STEP 7: Activate all schedules (if they're inactive)
UPDATE cron.job 
SET active = true 
WHERE jobname LIKE 'kivaw%';

-- STEP 8: Verify activation
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  '✅ All schedules active' as status
FROM cron.job 
WHERE jobname LIKE 'kivaw%'
ORDER BY jobname;

-- ============================================================
-- NEXT STEPS
-- ============================================================
-- 1. Wait 1 hour and check cron.job_run_details to see if jobs ran
-- 2. Check system_health_events to see if ingestion succeeded
-- 3. Check feed_items to see if new items were ingested
-- 4. Run DIAGNOSE_RSS_INGESTION.sql again to verify everything is working
-- ============================================================
