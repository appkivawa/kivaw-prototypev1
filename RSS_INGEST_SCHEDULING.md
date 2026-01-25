# RSS Ingest Scheduling

This document describes how to set up scheduled RSS ingestion in Supabase.

## Overview

RSS ingestion can be scheduled to run automatically using Supabase's `pg_cron` extension. This ensures your feed stays up-to-date without manual intervention.

## Setup

### Option 1: Using SQL Migration (Recommended)

1. **Run the migration:**
   ```bash
   supabase migration up
   ```
   
   Or in Supabase dashboard:
   - Go to **SQL Editor**
   - Copy contents of `supabase/migrations/20250120000006_schedule_rss_ingest.sql`
   - Paste and run

2. **Verify the job is scheduled:**
   ```sql
   SELECT * FROM cron.job;
   ```

3. **Check job execution:**
   ```sql
   SELECT * FROM cron.job_run_details 
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

### Option 2: Manual Setup

If the migration doesn't work (pg_cron might not be available in all Supabase plans), you can:

1. **Use Supabase Edge Functions with external cron:**
   - Use a service like cron-job.org, EasyCron, or GitHub Actions
   - Call your Edge Function URL: `https://YOUR_PROJECT.supabase.co/functions/v1/ingest_rss`
   - Schedule it to run every 60 minutes

2. **Use GitHub Actions:**
   Create `.github/workflows/rss-ingest.yml`:
   ```yaml
   name: RSS Ingest
   on:
     schedule:
       - cron: '0 * * * *' # Every hour
     workflow_dispatch: # Manual trigger

   jobs:
     ingest:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger RSS Ingest
           run: |
             curl -X POST \
               -H "Content-Type: application/json" \
               -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
               -d '{"maxFeeds": 50, "perFeedLimit": 100}' \
               ${{ secrets.SUPABASE_URL }}/functions/v1/ingest_rss
   ```

## Manual Trigger (Admin Only)

For manual triggers, use the admin-only page:

1. **Go to:** `/dev/rss-ingest` (dev) or production admin dashboard
2. **Click:** "🚀 Trigger RSS Ingest"
3. **View:** Results and statistics

In production, this page is only visible to administrators.

## Schedule Options

### Every Hour (Recommended)
```sql
SELECT cron.schedule(
  'rss-ingest-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT public.trigger_rss_ingest();$$
);
```

### Every 30 Minutes
```sql
SELECT cron.schedule(
  'rss-ingest-30min',
  '*/30 * * * *', -- Every 30 minutes
  $$SELECT public.trigger_rss_ingest();$$
);
```

### Every 60 Minutes (Alternative)
```sql
-- Use hourly instead (pg_cron doesn't support */60)
SELECT cron.schedule(
  'rss-ingest-hourly',
  '0 * * * *',
  $$SELECT public.trigger_rss_ingest();$$
);
```

## Monitoring

### View Scheduled Jobs
```sql
SELECT * FROM cron.job;
```

### View Job Execution History
```sql
SELECT 
  jobid,
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname = 'rss-ingest-hourly'
ORDER BY start_time DESC
LIMIT 20;
```

### Check Job Status
```sql
SELECT 
  j.jobname,
  j.schedule,
  j.active,
  jr.status,
  jr.return_message,
  jr.start_time
FROM cron.job j
LEFT JOIN cron.job_run_details jr ON j.jobid = jr.jobid
WHERE j.jobname LIKE 'rss-ingest%'
ORDER BY jr.start_time DESC
LIMIT 1;
```

## Troubleshooting

### pg_cron Not Available

If `pg_cron` is not available in your Supabase plan:

1. **Check if extension is available:**
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';
   ```

2. **If not available:**
   - Use external cron service (Option 2 above)
   - Or contact Supabase support to enable pg_cron

### Job Not Running

1. **Check if job is active:**
   ```sql
   SELECT jobname, active, schedule FROM cron.job WHERE jobname = 'rss-ingest-hourly';
   ```

2. **Check for errors:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobname = 'rss-ingest-hourly' 
   AND status = 'failed'
   ORDER BY start_time DESC;
   ```

3. **Verify Edge Function is accessible:**
   - Test manually via `/dev/rss-ingest` page
   - Check Edge Function logs in Supabase dashboard

### Edge Function Returns 403

If the scheduled job gets 403 errors:

1. **Check Edge Function auth settings:**
   - Go to **Edge Functions** → **ingest_rss** → **Settings**
   - Ensure `verify_jwt` is set correctly
   - For internal cron jobs, you may need to bypass JWT or use service role key

2. **Update the function to use service role key:**
   ```sql
   -- In trigger_rss_ingest function, use service role key for internal calls
   ```

## Production Checklist

- [ ] Migration applied successfully
- [ ] Job scheduled and active
- [ ] Verified job runs successfully at least once
- [ ] Monitored execution history for errors
- [ ] Set up alerts for failed jobs (optional)
- [ ] Admin manual trigger tested and working
- [ ] Edge Function logs reviewed

## Notes

- **pg_cron** is available in Supabase Pro plans and above
- Free tier may not support pg_cron - use external cron instead
- Internal function calls use `http://kong:8000` for Supabase Cloud
- For local development, use `http://localhost:54321`




