-- ============================================================
-- DIAGNOSE RSS INGESTION ISSUES
-- ============================================================
-- Run this in Supabase SQL Editor to check why RSS feeds aren't updating
-- ============================================================

-- 1. CHECK pg_cron EXTENSION
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✅ pg_cron extension is enabled'
    ELSE '❌ pg_cron extension is NOT enabled - run: CREATE EXTENSION IF NOT EXISTS pg_cron;'
  END as pg_cron_status;

-- 2. CHECK pg_cron SCHEDULES
SELECT 
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Found ' || COUNT(*) || ' kivaw cron jobs'
    ELSE '❌ Only found ' || COUNT(*) || ' kivaw cron jobs (expected 3)'
  END as schedule_status,
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ INACTIVE - needs to be activated'
  END as active_status
FROM cron.job 
WHERE jobname LIKE 'kivaw%'
ORDER BY jobname;

-- 3. CHECK RECENT JOB RUNS
SELECT 
  jobname,
  start_time,
  end_time,
  status,
  CASE 
    WHEN status = 'succeeded' THEN '✅'
    WHEN status = 'failed' THEN '❌'
    ELSE '⚠️'
  END as status_icon,
  return_message,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details 
WHERE jobname LIKE 'kivaw%'
ORDER BY start_time DESC 
LIMIT 10;

-- 4. CHECK SYSTEM HEALTH EVENTS
SELECT 
  job_name,
  ran_at,
  status,
  CASE 
    WHEN status = 'ok' THEN '✅'
    WHEN status = 'fail' THEN '❌'
    ELSE '⚠️'
  END as status_icon,
  duration_ms,
  error_message,
  metadata
FROM system_health_events
WHERE job_name IN ('ingest_rss', 'cron_runner:hourly', 'cron_runner:six_hour', 'cron_runner:daily')
ORDER BY ran_at DESC
LIMIT 10;

-- 5. CHECK RSS FRESHNESS
SELECT 
  MAX(published_at) as latest_published,
  MIN(published_at) as oldest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_count_7d,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '1 day') as fresh_count_1d,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '1 hour') as fresh_count_1h,
  COUNT(*) as total_count,
  CASE 
    WHEN MAX(published_at) > NOW() - INTERVAL '24 hours' THEN '✅ RSS is fresh (latest within 24h)'
    WHEN MAX(published_at) > NOW() - INTERVAL '7 days' THEN '⚠️ RSS is stale (latest > 24h but < 7d)'
    ELSE '❌ RSS is VERY stale (latest > 7 days old)'
  END as freshness_status
FROM feed_items;

-- 6. CHECK RSS SOURCES
SELECT 
  category,
  COUNT(*) as total_sources,
  COUNT(*) FILTER (WHERE active = true) as active_sources,
  COUNT(*) FILTER (WHERE active = false) as inactive_sources,
  CASE 
    WHEN COUNT(*) FILTER (WHERE active = true) > 0 THEN '✅'
    ELSE '❌'
  END as has_active
FROM rss_sources
GROUP BY category
ORDER BY category;

-- 7. CHECK RECENT FEED ITEMS BY PROVIDER
SELECT 
  provider,
  COUNT(*) as total_items,
  MAX(published_at) as latest_published,
  MIN(published_at) as oldest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_count
FROM feed_items
WHERE published_at > NOW() - INTERVAL '30 days'
GROUP BY provider
ORDER BY latest_published DESC
LIMIT 20;

-- 8. CHECK SYSTEM HEALTH TABLE (if exists)
SELECT 
  key,
  last_run_at,
  last_ok,
  last_error,
  meta,
  CASE 
    WHEN last_ok THEN '✅'
    ELSE '❌'
  END as status_icon
FROM system_health
WHERE key LIKE 'cron_runner:%' OR key LIKE 'ingest_rss%'
ORDER BY last_run_at DESC
LIMIT 10;

-- ============================================================
-- SUMMARY
-- ============================================================
-- After running all queries above, check:
-- 1. Is pg_cron enabled? (Query 1)
-- 2. Are schedules created and active? (Query 2)
-- 3. Are jobs running? (Query 3)
-- 4. Are jobs succeeding? (Query 4)
-- 5. Is RSS fresh? (Query 5)
-- 6. Are RSS sources active? (Query 6)
-- 7. Which providers have recent items? (Query 7)
-- 8. What does system health show? (Query 8)
-- ============================================================
