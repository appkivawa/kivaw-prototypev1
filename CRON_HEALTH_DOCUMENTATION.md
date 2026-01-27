# Cron & Ingest Health Monitoring

## Overview

The Kivaw app uses **pg_cron** (PostgreSQL extension) to schedule periodic jobs that call the `cron_runner` Edge Function. All scheduled jobs and ingest functions now log health events to `system_health_events` table for monitoring.

## Scheduler: pg_cron

**Scheduler Type**: `pg_cron` (PostgreSQL extension)

**Configuration**: See `SUPABASE_CRON_SETUP.md` for setup instructions.

**Jobs**:
- `hourly`: RSS ingestion (every hour)
- `six_hour`: Watch content refresh (every 6 hours)
- `daily`: Books refresh + RSS cleanup (daily at 2 AM UTC)

## Database Schema

### `system_health_events` Table

Stores detailed event history for all cron jobs and ingest functions:

```sql
CREATE TABLE public.system_health_events (
  id UUID PRIMARY KEY,
  job_name TEXT NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'fail')),
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL
);
```

### `system_health_latest` View

Shows the latest status per job for quick queries:

```sql
CREATE VIEW public.system_health_latest AS
SELECT DISTINCT ON (job_name)
  id, job_name, ran_at, status, duration_ms, error_message, metadata, created_at
FROM public.system_health_events
ORDER BY job_name, ran_at DESC;
```

### Helper Function: `log_health_event`

Convenience RPC function for edge functions:

```sql
SELECT public.log_health_event(
  p_job_name := 'ingest_rss',
  p_status := 'ok',
  p_duration_ms := 1234,
  p_error_message := NULL,
  p_metadata := '{"ingested": 42}'::jsonb
);
```

## Jobs That Log Health Events

All of these functions now log to `system_health_events`:

1. **`cron_runner`** - Orchestrates all scheduled jobs
   - Job names: `cron_runner:hourly`, `cron_runner:six_hour`, `cron_runner:daily`
   
2. **`ingest_rss`** - RSS feed ingestion
   - Job name: `ingest_rss`
   - Metadata: `{ feeds, ingested, results }`

3. **`sync-external-content`** - TMDB movies/TV sync
   - Job name: `sync-external-content`
   - Metadata: `{ inserted, updated, errorsCount }`

4. **`fetch-open-library`** - Open Library books
   - Job name: `fetch-open-library`
   - Metadata: `{ items }`

5. **`fetch-google-books`** - Google Books
   - Job name: `fetch-google-books`
   - Metadata: `{ returned, totalItems }`

6. **`fetch-tmdb`** - TMDB movies/TV (standalone)
   - Job name: `fetch-tmdb`
   - Metadata: `{ items }`

## Admin Health Tab

The Admin > Health tab now displays:

1. **Supabase Connection** - Database connectivity check
2. **Error Count** - App errors from `app_errors` table
3. **Cron Jobs & Ingest Health** - Real-time status from `system_health_latest`:
   - Job name
   - Last run time (relative + absolute)
   - Status (OK/FAILED)
   - Duration (ms)
   - Error message (if failed)
   - Metadata (expandable)

## Validation Queries

### Check Latest Status for All Jobs

```sql
SELECT 
  job_name,
  ran_at,
  status,
  duration_ms,
  error_message,
  metadata
FROM system_health_latest
ORDER BY job_name;
```

### Check Failed Jobs in Last 24 Hours

```sql
SELECT 
  job_name,
  ran_at,
  error_message,
  duration_ms
FROM system_health_events
WHERE status = 'fail'
  AND ran_at > NOW() - INTERVAL '24 hours'
ORDER BY ran_at DESC;
```

### Check Job Run Frequency

```sql
SELECT 
  job_name,
  COUNT(*) as run_count,
  MIN(ran_at) as first_run,
  MAX(ran_at) as last_run,
  AVG(duration_ms) as avg_duration_ms,
  COUNT(*) FILTER (WHERE status = 'ok') as success_count,
  COUNT(*) FILTER (WHERE status = 'fail') as fail_count
FROM system_health_events
WHERE ran_at > NOW() - INTERVAL '7 days'
GROUP BY job_name
ORDER BY job_name;
```

### Check Jobs That Haven't Run Recently

```sql
SELECT 
  job_name,
  MAX(ran_at) as last_run,
  NOW() - MAX(ran_at) as time_since_last_run
FROM system_health_events
GROUP BY job_name
HAVING MAX(ran_at) < NOW() - INTERVAL '2 hours'
ORDER BY last_run;
```

### Get Recent Events for a Specific Job

```sql
SELECT 
  ran_at,
  status,
  duration_ms,
  error_message,
  metadata
FROM system_health_events
WHERE job_name = 'ingest_rss'
ORDER BY ran_at DESC
LIMIT 10;
```

## "How to Tell if Ingestion is Broken in 10 Seconds" Checklist

### Quick Check (Admin UI)

1. Go to **Admin > Health**
2. Scroll to **"Cron Jobs & Ingest Health"** section
3. Check for:
   - ✅ All jobs show "✓ OK" status
   - ✅ Last run times are recent (< 2 hours for hourly, < 8 hours for six_hour, < 24 hours for daily)
   - ❌ No red "✗ FAILED" indicators
   - ❌ No error messages displayed

### SQL Quick Check

```sql
-- Run this in Supabase SQL Editor
SELECT 
  job_name,
  ran_at,
  status,
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
```

**Expected Output**:
- All jobs should show "✅ Recent" freshness
- All jobs should have `status = 'ok'`
- No `error_message` values

### Common Issues & Fixes

#### Issue: Job hasn't run in > 2 hours
**Check**:
```sql
SELECT * FROM cron.job WHERE jobname LIKE 'kivaw%';
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'kivaw%')
ORDER BY start_time DESC LIMIT 5;
```

**Fix**: Verify pg_cron schedules are active and `CRON_SECRET` matches.

#### Issue: Job shows "FAILED" status
**Check**:
```sql
SELECT error_message, metadata 
FROM system_health_latest 
WHERE job_name = 'ingest_rss' AND status = 'fail';
```

**Fix**: Check error message for specific issue (API key missing, network error, etc.)

#### Issue: Job runs but no data ingested
**Check**:
```sql
SELECT metadata->>'ingested' as ingested_count
FROM system_health_events
WHERE job_name = 'ingest_rss'
ORDER BY ran_at DESC
LIMIT 1;
```

**Fix**: Check RSS feed sources are active, API keys are valid, network connectivity.

## Deployment Checklist

1. ✅ Run migration: `20250128000000_create_system_health_events.sql`
2. ✅ Deploy updated edge functions:
   ```bash
   supabase functions deploy cron_runner
   supabase functions deploy ingest_rss
   supabase functions deploy sync-external-content
   supabase functions deploy fetch-open-library
   supabase functions deploy fetch-google-books
   supabase functions deploy fetch-tmdb
   ```
3. ✅ Verify `system_health_latest` view exists:
   ```sql
   SELECT * FROM system_health_latest LIMIT 1;
   ```
4. ✅ Test a job manually and verify event is logged:
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ingest_rss \
     -H "Authorization: Bearer YOUR_SERVICE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"maxFeeds": 1, "perFeedLimit": 5}'
   ```
   Then check:
   ```sql
   SELECT * FROM system_health_events WHERE job_name = 'ingest_rss' ORDER BY ran_at DESC LIMIT 1;
   ```
5. ✅ Verify Admin Health tab displays cron jobs

## Files Changed

### New Files
- `supabase/migrations/20250128000000_create_system_health_events.sql`
- `supabase/functions/_shared/logHealthEvent.ts`
- `CRON_HEALTH_DOCUMENTATION.md` (this file)

### Updated Files
- `supabase/functions/cron_runner/index.ts` - Added health event logging
- `supabase/functions/ingest_rss/index.ts` - Added health event logging
- `supabase/functions/sync-external-content/index.ts` - Added health event logging
- `supabase/functions/fetch-open-library/index.ts` - Added health event logging
- `supabase/functions/fetch-google-books/index.ts` - Added health event logging
- `supabase/functions/fetch-tmdb/index.ts` - Added health event logging
- `src/admin/tabs/Health.tsx` - Added cron jobs health display

## Notes

- Health events are logged even if the function fails (for visibility)
- Duration is measured from function start to completion/error
- Metadata includes job-specific details (counts, results, etc.)
- Events are retained indefinitely (no automatic cleanup - add retention policy if needed)
- RLS policies allow service role to write, authenticated users to read
