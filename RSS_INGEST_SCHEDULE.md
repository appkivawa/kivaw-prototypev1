# RSS Ingest Schedule

## Current Status

The RSS ingest function (`ingest_rss`) is **not currently scheduled** in the codebase. It needs to be configured in the Supabase dashboard.

## How to Schedule RSS Ingest

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Cron Jobs** (or **Database** → **Extensions** → **pg_cron**)
3. If `pg_cron` extension is not enabled, enable it first
4. Create a new cron job with:
   - **Name:** `ingest-rss-feed`
   - **Schedule:** `0 * * * *` (every hour at minute 0)
   - **Command:** 
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_rss',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
       body := '{}'::jsonb
     );
     ```
   - Replace `YOUR_PROJECT_REF` with your Supabase project reference
   - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key (found in Settings → API)

### Option 2: SQL Migration (if pg_cron is enabled)

Create a migration file `supabase/migrations/20250120000005_schedule_rss_ingest.sql`:

```sql
-- Schedule RSS ingest to run every 60 minutes
-- Requires pg_cron extension to be enabled

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule RSS ingest job (runs every hour at minute 0)
SELECT cron.schedule(
  'ingest-rss-feed',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ingest_rss',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Note: The above uses app settings. Alternatively, you can hardcode:
-- url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_rss',
-- headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
```

### Option 3: External Cron Service

Use an external service like:
- **Vercel Cron Jobs** (if deployed on Vercel)
- **GitHub Actions** (scheduled workflows)
- **Cloud Scheduler** (Google Cloud)
- **AWS EventBridge** (AWS)

Example Vercel `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/ingest-rss",
    "schedule": "0 * * * *"
  }]
}
```

## Recommended Frequency

- **Every 60 minutes** (`0 * * * *`) - Good balance between freshness and API rate limits
- **Every 30 minutes** (`*/30 * * * *`) - More frequent, but may hit rate limits
- **Every 15 minutes** (`*/15 * * * *`) - Very frequent, only if you have high rate limits

## Verification

After setting up the schedule:

1. Check cron job is running:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'ingest-rss-feed';
   ```

2. Check recent ingest activity:
   ```sql
   SELECT COUNT(*), MAX(ingested_at) 
   FROM feed_items 
   WHERE ingested_at > NOW() - INTERVAL '2 hours';
   ```

3. Monitor function logs in Supabase dashboard:
   - Go to **Edge Functions** → **ingest_rss** → **Logs**

## Current Implementation

The `ingest_rss` function:
- Fetches up to 100 items per RSS feed
- Uses `upsert` to prevent duplicates
- Stores `ingested_at` timestamp
- Handles RSS 2.0 and Atom feeds

