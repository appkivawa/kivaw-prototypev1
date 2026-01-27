# How to Verify Cron Jobs Are Working

## Quick Checks

### 1. Check System Health Status

Run this SQL in Supabase SQL Editor:

```sql
-- View all cron job health status
SELECT 
  key,
  last_run_at,
  last_ok,
  last_error,
  meta->>'status' as status,
  meta
FROM system_health
WHERE key LIKE 'cron_runner:%'
ORDER BY last_run_at DESC;
```

**Expected output:**
- `cron_runner:hourly` - should show recent `last_run_at` (within last hour)
- `cron_runner:six_hour` - should show recent `last_run_at` (within last 6 hours)
- `cron_runner:daily` - should show recent `last_run_at` (within last 24 hours)
- `last_ok` should be `true` if jobs succeeded

### 2. Check pg_cron Job Runs

```sql
-- View recent cron job executions
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname LIKE 'kivaw-%';
```

```sql
-- View execution history
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE 'kivaw-%'
)
ORDER BY start_time DESC
LIMIT 20;
```

**Expected:**
- `status` should be `succeeded` for successful runs
- `return_message` should not contain errors
- Recent `start_time` values

### 3. Check RSS Ingestion Results

```sql
-- Check recent RSS items (should be within last 7 days)
SELECT 
  COUNT(*) as total_rss_items,
  COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '7 days') as fresh_items,
  COUNT(*) FILTER (WHERE published_at < NOW() - INTERVAL '7 days') as stale_items,
  MAX(published_at) as newest_published,
  MIN(published_at) as oldest_published
FROM feed_items
WHERE content_kind IN ('rss', 'atom', 'article', 'news')
  AND is_discoverable = true;
```

**Expected:**
- `fresh_items` should be > 0
- `newest_published` should be within last 7 days (ideally today)
- `stale_items` should be 0 (they're excluded from view)

### 4. Check External Content Cache

```sql
-- Check TMDB/watch content freshness
SELECT 
  provider,
  COUNT(*) as count,
  MAX(fetched_at) as last_fetched,
  MIN(fetched_at) as oldest_fetched
FROM external_content_cache
WHERE provider = 'tmdb'
GROUP BY provider;
```

```sql
-- Check book content freshness
SELECT 
  provider,
  COUNT(*) as count,
  MAX(fetched_at) as last_fetched
FROM external_content_cache
WHERE provider IN ('open_library', 'google_books')
GROUP BY provider;
```

**Expected:**
- `last_fetched` should be recent (within last 6 hours for TMDB, within last 24 hours for books)

## Manual Testing

### Test Hourly Job (RSS)

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"job": "hourly"}'
```

**Expected response:**
```json
{
  "ok": true,
  "job": "hourly",
  "results": {
    "rss": {
      "ok": true,
      "status": 200,
      "data": {
        "ok": true,
        "feeds": 25,
        "ingested": 150,
        "results": [...]
      }
    }
  },
  "ranAt": "2026-01-27T12:00:00.000Z"
}
```

### Test Six-Hour Job (TMDB)

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"job": "six_hour"}'
```

**Expected response:**
```json
{
  "ok": true,
  "job": "six_hour",
  "results": {
    "tmdb": {
      "ok": true,
      "status": 200,
      "data": {
        "inserted": 10,
        "updated": 5,
        ...
      }
    }
  }
}
```

### Test Daily Job (Books + Prune)

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"job": "daily"}'
```

**Expected response:**
```json
{
  "ok": true,
  "job": "daily",
  "results": {
    "openLibrary": { "ok": true, ... },
    "googleBooks": { "ok": true, ... },
    "prune": { "pruned": 50 }
  }
}
```

## Check Explore Feed

### Verify RSS Items Are Recent

```sql
-- Check what RSS items appear in Explore view
SELECT 
  kind,
  provider,
  title,
  created_at,
  summary
FROM explore_items_v2
WHERE kind IN ('rss', 'atom', 'article', 'news')
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:**
- All items should have `created_at` within last 7 days
- Items should have recent `published_at` dates
- No items older than 7 days

### Verify Books Are Modern

```sql
-- Check Open Library books in Explore
SELECT 
  kind,
  provider,
  title,
  raw->>'first_publish_year' as publish_year,
  created_at
FROM explore_items_v2
WHERE provider = 'open_library'
  AND kind = 'read'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:**
- `publish_year` should be >= 2000 (preferably >= 2020)
- No books from before 1950

## Troubleshooting

### If Jobs Aren't Running

1. **Check pg_cron extension is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check cron jobs are active:**
   ```sql
   SELECT jobname, active FROM cron.job WHERE jobname LIKE 'kivaw-%';
   ```
   - `active` should be `true`

3. **Check for errors in cron runs:**
   ```sql
   SELECT 
     jobname,
     status,
     return_message,
     start_time
   FROM cron.job_run_details
   WHERE status = 'failed'
   ORDER BY start_time DESC
   LIMIT 10;
   ```

### If Jobs Return Errors

1. **Check system_health for error messages:**
   ```sql
   SELECT 
     key,
     last_error,
     last_run_at
   FROM system_health
   WHERE last_ok = false
   ORDER BY last_run_at DESC;
   ```

2. **Test Edge Functions directly:**
   ```bash
   # Test ingest_rss
   curl -X GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_rss
   
   # Should return: {"ok":true,"fn":"ingest_rss","version":"..."}
   ```

3. **Check Edge Function logs in Supabase Dashboard:**
   - Go to Edge Functions → Logs
   - Look for errors in `cron_runner`, `ingest_rss`, etc.

### If RSS Items Are Stale

1. **Check RSS ingestion is working:**
   ```sql
   -- Find most recent RSS ingestion
   SELECT 
     MAX(ingested_at) as last_ingested,
     COUNT(*) as total_items
   FROM feed_items
   WHERE content_kind IN ('rss', 'atom', 'article', 'news');
   ```

2. **Check if items are being marked undiscoverable:**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE is_discoverable = true) as discoverable,
     COUNT(*) FILTER (WHERE is_discoverable = false) as undiscoverable
   FROM feed_items
   WHERE content_kind IN ('rss', 'atom', 'article', 'news');
   ```

3. **Manually trigger RSS ingestion:**
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_rss \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: YOUR_CRON_SECRET" \
     -d '{"maxFeeds": 5, "perFeedLimit": 50}'
   ```

## Success Indicators

✅ **System is working if:**
- `system_health` shows recent `last_run_at` for all jobs
- `last_ok` is `true` for recent runs
- RSS items in Explore are all within last 7 days
- Books have modern publish years (2000+)
- `cron.job_run_details` shows `status = 'succeeded'`
- Manual test calls return `"ok": true`

❌ **System needs attention if:**
- `last_run_at` is more than expected interval ago
- `last_ok` is `false` with error messages
- RSS items older than 7 days appear in Explore
- `cron.job_run_details` shows `status = 'failed'`
- Manual test calls return errors

## Quick Health Check Script

Run this SQL to get a quick overview:

```sql
SELECT 
  'System Health' as check_type,
  key as name,
  last_run_at,
  CASE 
    WHEN last_ok THEN '✅ OK'
    ELSE '❌ ERROR: ' || COALESCE(last_error, 'Unknown')
  END as status
FROM system_health
WHERE key LIKE 'cron_runner:%'

UNION ALL

SELECT 
  'Cron Job' as check_type,
  jobname as name,
  (SELECT MAX(start_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run_at,
  CASE 
    WHEN (SELECT status FROM cron.job_run_details WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1) = 'succeeded' 
    THEN '✅ OK'
    ELSE '❌ FAILED'
  END as status
FROM cron.job j
WHERE jobname LIKE 'kivaw-%'

ORDER BY last_run_at DESC;
```
