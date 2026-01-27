# PHASE 1: RSS INGESTION & FRESHNESS FIX

**Priority**: 🔴 **CRITICAL**  
**Status**: IN PROGRESS  
**Date**: 2025-01-28

---

## PROBLEM STATEMENT

**Symptom**: Latest RSS articles stop around Jan 15, today is Jan 28 (13 days stale)

**Impact**: 
- Explore page shows no recent news
- Users see outdated content
- Core value proposition broken

---

## ROOT CAUSE ANALYSIS

### Hypothesis 1: pg_cron Schedules Not Configured (MOST LIKELY)

**Check**:
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'kivaw%';
```

**Expected**: Should show 3 jobs:
- `kivaw-hourly-rss` (schedule: `0 * * * *`)
- `kivaw-six-hour-tmdb` (schedule: `0 */6 * * *`)
- `kivaw-daily-books` (schedule: `0 2 * * *`)

**If Missing**: pg_cron schedules were never created.

**Fix**: Run SQL from `SUPABASE_CRON_SETUP.md` to create schedules.

---

### Hypothesis 2: CRON_SECRET Mismatch

**Check**:
```bash
supabase secrets list
# Should show: CRON_SECRET: [set]
```

**Then check pg_cron SQL**:
```sql
SELECT jobname, command 
FROM cron.job 
WHERE jobname LIKE 'kivaw%';
-- Look for 'x-cron-secret' value in command
```

**If Mismatch**: Secret in Supabase doesn't match secret in pg_cron SQL.

**Fix**: 
1. Get secret: `supabase secrets list | grep CRON_SECRET`
2. Update pg_cron SQL to use same secret
3. Or regenerate secret and update both places

---

### Hypothesis 3: ingest_rss Function Failing Silently

**Check**:
```sql
SELECT 
  job_name,
  ran_at,
  status,
  error_message,
  duration_ms,
  metadata
FROM system_health_events
WHERE job_name IN ('ingest_rss', 'cron_runner:hourly')
ORDER BY ran_at DESC
LIMIT 10;
```

**Expected**: Recent events with `status = 'ok'`

**If Failing**: Check `error_message` column for details.

**Fix**: Debug error, fix function, redeploy.

---

### Hypothesis 4: RSS Sources Inactive

**Check**:
```sql
SELECT 
  url, 
  active, 
  category,
  weight
FROM rss_sources 
WHERE active = true 
ORDER BY weight DESC;
```

**Expected**: Multiple active sources across categories (tech, culture, finance, music)

**If Empty/Too Few**: Sources need to be activated or seeded.

**Fix**: 
1. Activate sources: `UPDATE rss_sources SET active = true WHERE ...`
2. Or re-run seed: `20250120000004_seed_rss_sources.sql`

---

### Hypothesis 5: Freshness Filter Too Strict

**Current**: `MAX_AGE_DAYS = 7` in `ingest_rss/index.ts`

**Check**:
```sql
SELECT 
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_count,
  COUNT(*) as total_count
FROM feed_items;
```

**If `latest_published` is > 7 days ago**: Items are being ingested but filtered out.

**Fix**: Adjust `MAX_AGE_DAYS` if needed (but 7 days should be fine for news).

---

## VERIFICATION QUERIES

Run these in **Supabase SQL Editor** to diagnose:

### 1. Check RSS Freshness
```sql
SELECT 
  MAX(published_at) as latest_published,
  MIN(published_at) as oldest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_count,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '1 day') as today_count,
  COUNT(*) as total_count
FROM feed_items;
-- Expected: latest_published should be within last 24 hours
```

### 2. Check pg_cron Schedules
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname LIKE 'kivaw%';
-- Expected: 3 jobs, all active = true
```

### 3. Check Cron Job Runs
```sql
SELECT 
  jobid,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE jobname LIKE 'kivaw%'
ORDER BY start_time DESC 
LIMIT 20;
-- Expected: Recent runs with status = 'succeeded'
```

### 4. Check System Health Events
```sql
SELECT 
  job_name,
  ran_at,
  status,
  error_message,
  duration_ms,
  metadata
FROM system_health_events
WHERE job_name IN ('ingest_rss', 'cron_runner:hourly', 'cron_runner:six_hour', 'cron_runner:daily')
ORDER BY ran_at DESC
LIMIT 20;
-- Expected: Recent runs with status = 'ok'
```

### 5. Check RSS Sources
```sql
SELECT 
  category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count,
  COUNT(*) FILTER (WHERE active = false) as inactive_count
FROM rss_sources
GROUP BY category
ORDER BY category;
-- Expected: Multiple categories with active sources
```

### 6. Check Recent Feed Items
```sql
SELECT 
  provider,
  COUNT(*) as count,
  MAX(published_at) as latest,
  MIN(published_at) as oldest
FROM feed_items
WHERE published_at > NOW() - INTERVAL '7 days'
GROUP BY provider
ORDER BY latest DESC;
-- Expected: Recent items from multiple providers
```

---

## FIX PLAN

### Step 1: Verify pg_cron Extension Enabled

```sql
-- Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- Expected: Should return 1 row

-- If missing, enable it (requires superuser):
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Create/Verify pg_cron Schedules

**File**: `supabase/migrations/20250128000001_setup_pg_cron_schedules.sql` (NEW)

```sql
-- ============================================================
-- SETUP pg_cron SCHEDULES FOR KIVAW
-- ============================================================
-- Run this in Supabase SQL Editor
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET_HERE
-- ============================================================

-- Get project URL and CRON_SECRET (you'll need to set these)
-- Project URL: Get from Supabase Dashboard → Settings → API → Project URL
-- CRON_SECRET: Get from `supabase secrets list`

-- 1. Hourly RSS Ingestion
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

-- 2. Six-Hour Watch Content Refresh
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

-- 3. Daily Books Refresh + RSS Prune
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

-- Verify schedules were created
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'kivaw%';
```

### Step 3: Verify CRON_SECRET is Set

```bash
# Check if secret exists
supabase secrets list

# If missing, set it:
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)

# Verify
supabase secrets list | grep CRON_SECRET
```

### Step 4: Test Manual Ingestion

```bash
# Test cron_runner manually
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"job": "hourly"}'

# Expected: {"ok": true, "job": "hourly", "results": {...}}
```

### Step 5: Verify RSS Sources Are Active

```sql
-- Check active sources
SELECT COUNT(*) FROM rss_sources WHERE active = true;
-- Expected: Should be > 50

-- If too few, activate more:
UPDATE rss_sources 
SET active = true 
WHERE category IN ('tech', 'culture', 'finance', 'music')
LIMIT 50;
```

### Step 6: Monitor First Run

After setting up schedules, wait 1 hour and check:

```sql
-- Check if hourly job ran
SELECT * FROM cron.job_run_details 
WHERE jobname = 'kivaw-hourly-rss'
ORDER BY start_time DESC 
LIMIT 5;

-- Check system health
SELECT * FROM system_health_events
WHERE job_name = 'ingest_rss'
ORDER BY ran_at DESC
LIMIT 5;

-- Check for new items
SELECT COUNT(*) FROM feed_items 
WHERE ingested_at > NOW() - INTERVAL '2 hours';
```

---

## EXPECTED OUTCOMES

After fixes:

1. **pg_cron schedules exist**: 3 active jobs
2. **Jobs run successfully**: `cron.job_run_details` shows recent successful runs
3. **System health logged**: `system_health_events` shows `status = 'ok'`
4. **New items ingested**: `feed_items` table has items with `published_at` within last 24 hours
5. **Explore page shows fresh content**: Items appear in Explore within 1-2 hours of publish

---

## ROLLBACK PLAN

If something breaks:

1. **Disable cron jobs**:
   ```sql
   UPDATE cron.job SET active = false WHERE jobname LIKE 'kivaw%';
   ```

2. **Manual ingestion** (temporary):
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ingest_rss \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: YOUR_CRON_SECRET" \
     -d '{"maxFeeds": 25, "perFeedLimit": 75}'
   ```

---

**Status**: Ready to implement fixes
