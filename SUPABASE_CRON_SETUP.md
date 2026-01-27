# Supabase Scheduled Functions Setup

This guide explains how to configure Supabase to automatically run Kivaw's content ingestion jobs.

## Overview

Kivaw uses three scheduled jobs:
- **hourly**: RSS ingestion (refreshes news feeds)
- **six_hour**: Watch content refresh (TMDB movies/TV)
- **daily**: Books refresh (Open Library + Google Books) + RSS cleanup

All jobs are orchestrated by the `cron_runner` Edge Function.

## Prerequisites

1. **Set CRON_SECRET environment variable** in Supabase Dashboard:
   - Go to Project Settings → Edge Functions → Secrets
   - Add secret: `CRON_SECRET` with a secure random value (e.g., `openssl rand -hex 32`)

2. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy cron_runner
   supabase functions deploy ingest_rss
   supabase functions deploy sync-external-content
   supabase functions deploy fetch-open-library
   supabase functions deploy fetch-google-books
   ```

3. **Run SQL Migrations**:
   ```bash
   # In Supabase SQL Editor, run:
   # - 20250127000000_create_system_health.sql
   # - 20250127000001_prune_stale_rss.sql
   # - Update explore_items_v2 view (already in 20250117025542_create_explore_items_v2_view.sql)
   ```

## Configure pg_cron Schedules

Connect to your Supabase database and run these SQL commands:

### 1. Hourly RSS Ingestion

```sql
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
```

### 2. Six-Hour Watch Content Refresh

```sql
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
```

### 3. Daily Books Refresh + RSS Prune

```sql
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
```

## Replace Placeholders

1. **YOUR_PROJECT_REF**: Your Supabase project reference (e.g., `pjuueamhdxqdrnxvavwd`)
2. **YOUR_CRON_SECRET_HERE**: The same value you set in Edge Function secrets

## Verify Schedules

Check active cron jobs:

```sql
SELECT * FROM cron.job;
```

Check job run history:

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

## Monitor System Health

View system health status:

```sql
SELECT 
  key,
  last_run_at,
  last_ok,
  last_error,
  meta
FROM system_health
WHERE key LIKE 'cron_runner:%'
ORDER BY last_run_at DESC;
```

## Manual Testing

Test jobs manually via curl:

```bash
# Hourly job
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  -d '{"job": "hourly"}'

# Six-hour job
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  -d '{"job": "six_hour"}'

# Daily job
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  -d '{"job": "daily"}'
```

## Troubleshooting

1. **Jobs not running**: Check `cron.job_run_details` for errors
2. **403 Forbidden**: Verify `CRON_SECRET` matches in both Edge Function secrets and pg_cron SQL
3. **Timeout errors**: Increase timeout in `cron_runner/index.ts` if needed
4. **No RSS items**: Check `system_health` for `cron_runner:hourly` status and errors

## Notes

- All jobs use timeouts (10-20s) to prevent hanging
- Partial failures are logged but don't stop other jobs
- RSS items older than 7 days are excluded from Explore view
- RSS items older than 14 days are marked undiscoverable (daily job)
- System health is tracked in `system_health` table for monitoring
