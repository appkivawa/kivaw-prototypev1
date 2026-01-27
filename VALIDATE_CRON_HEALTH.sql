-- ============================================================
-- VALIDATION QUERIES FOR CRON HEALTH MONITORING
-- ============================================================
-- Run these queries in Supabase SQL Editor to verify health monitoring is working
-- ============================================================

-- 1. Check if system_health_events table exists
SELECT 
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'system_health_events'
  ) as table_exists;

-- 2. Check if system_health_latest view exists
SELECT 
  EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'system_health_latest'
  ) as view_exists;

-- 3. Check if log_health_event function exists
SELECT 
  EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'log_health_event'
  ) as function_exists;

-- 4. Get latest status for all jobs
SELECT 
  job_name,
  ran_at,
  status,
  duration_ms,
  CASE 
    WHEN ran_at > NOW() - INTERVAL '2 hours' THEN '✅ Recent'
    WHEN ran_at > NOW() - INTERVAL '6 hours' THEN '⚠️ Stale'
    ELSE '❌ Too Old'
  END as freshness,
  error_message
FROM system_health_latest
ORDER BY 
  CASE status WHEN 'fail' THEN 0 ELSE 1 END,
  ran_at DESC;

-- 5. Count events per job (last 7 days)
SELECT 
  job_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'ok') as success_count,
  COUNT(*) FILTER (WHERE status = 'fail') as fail_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'ok') / COUNT(*), 1) as success_rate_pct,
  ROUND(AVG(duration_ms), 0) as avg_duration_ms,
  MAX(ran_at) as last_run
FROM system_health_events
WHERE ran_at > NOW() - INTERVAL '7 days'
GROUP BY job_name
ORDER BY job_name;

-- 6. Find failed jobs in last 24 hours
SELECT 
  job_name,
  ran_at,
  duration_ms,
  error_message,
  metadata
FROM system_health_events
WHERE status = 'fail'
  AND ran_at > NOW() - INTERVAL '24 hours'
ORDER BY ran_at DESC;

-- 7. Check jobs that haven't run recently (potential scheduler issues)
SELECT 
  job_name,
  MAX(ran_at) as last_run,
  NOW() - MAX(ran_at) as time_since_last_run,
  CASE 
    WHEN MAX(ran_at) > NOW() - INTERVAL '2 hours' THEN '✅ OK'
    WHEN MAX(ran_at) > NOW() - INTERVAL '6 hours' THEN '⚠️ WARNING'
    ELSE '❌ CRITICAL'
  END as status
FROM system_health_events
GROUP BY job_name
HAVING MAX(ran_at) < NOW() - INTERVAL '1 hour'
ORDER BY last_run;

-- 8. Get recent events for a specific job (e.g., ingest_rss)
SELECT 
  ran_at,
  status,
  duration_ms,
  error_message,
  metadata->>'ingested' as ingested_count,
  metadata->>'feeds' as feeds_count
FROM system_health_events
WHERE job_name = 'ingest_rss'
ORDER BY ran_at DESC
LIMIT 10;

-- 9. Check for jobs with consistently high duration (performance issues)
SELECT 
  job_name,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms
FROM system_health_events
WHERE ran_at > NOW() - INTERVAL '7 days'
  AND duration_ms IS NOT NULL
GROUP BY job_name
HAVING AVG(duration_ms) > 10000  -- Jobs taking > 10s on average
ORDER BY avg_duration_ms DESC;

-- 10. Verify RLS policies are correct
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'system_health_events'
ORDER BY policyname;

-- 11. Test log_health_event function (should return UUID)
SELECT public.log_health_event(
  'test_job',
  'ok',
  123,
  NULL,
  '{"test": true}'::jsonb
) as event_id;

-- 12. Verify test event was created
SELECT * FROM system_health_events 
WHERE job_name = 'test_job' 
ORDER BY ran_at DESC 
LIMIT 1;

-- 13. Clean up test event (optional)
-- DELETE FROM system_health_events WHERE job_name = 'test_job';
