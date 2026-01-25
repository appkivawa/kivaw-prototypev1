# Ingestion Observability Setup

## Summary

Ingestion now runs continuously using **pg_cron** (replacing Vercel cron) with full observability via `ingestion_runs` table. This provides visibility into ingestion job execution and powers "Last updated" labels in StudioFeed and StudioExplore.

## Changes Made

### 1. Cron System Migration

**Before:** Vercel cron (`vercel.json`) → `/api/cron` → `cron_runner` Edge Function  
**After:** pg_cron → `trigger_ingestion()` SQL function → `cron_runner` Edge Function

**Disabled:**
- ✅ Vercel cron in `vercel.json` (commented out)

**Enabled:**
- ✅ pg_cron schedule (every 30 minutes) in `20250122000001_schedule_ingestion_pg_cron.sql`

### 2. Observability Table

**New table:** `public.ingestion_runs`
- Tracks: `job_name`, `status`, `started_at`, `finished_at`, `details`, `error_message`
- Jobs logged: `cron_runner`, `rss_ingest`, `sync_external_content`
- Indexed for fast "last successful run" queries

**Migration:** `20250122000000_create_ingestion_runs.sql`

### 3. Logging Updates

**Updated:** `supabase/functions/cron_runner/index.ts`
- Logs orchestrator run start/end to `ingestion_runs`
- Logs each sub-job (`rss_ingest`, `sync_external_content`) separately
- Tracks status, timestamps, details, and errors

### 4. Helper Functions

**SQL functions:**
- `get_last_successful_ingestion(job_name)` - Get last successful run for a job
- `get_last_successful_ingestion_all()` - Get last successful run for all jobs

### 5. UI Updates

**Updated:** `StudioFeed.tsx` and `StudioExplore.tsx`
- "Last updated" now reads from `ingestion_runs` (via `get_last_successful_ingestion`)
- Fallback to "Last loaded" if query fails

---

## Deployment Steps

### 1. Run Migrations

```bash
supabase db push
```

This will:
- Create `ingestion_runs` table
- Create helper functions (`get_last_successful_ingestion`, etc.)
- Schedule pg_cron job (every 30 minutes)

### 2. Configure Service Role Key (Required)

The pg_cron job needs the service role key to call `cron_runner`. Set it as a Postgres setting:

**Option A: Via Supabase Dashboard**
1. Go to Settings > Database > Connection Pooling
2. Add custom setting: `app.settings.supabase_service_role_key = 'your-service-role-key'`

**Option B: Via SQL Editor**
```sql
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'your-service-role-key';
```

**Option C: Via Environment Variable (if supported)**
Set in Supabase project settings (database config).

**⚠️ IMPORTANT:** Never commit the service role key to git. It's a secret!

### 3. (Optional) Configure CRON_SECRET

If you want additional security, set `CRON_SECRET` similarly:

```sql
ALTER DATABASE postgres SET app.settings.cron_secret = 'your-cron-secret';
```

### 4. Deploy Updated Edge Function

```bash
supabase functions deploy cron_runner
```

### 5. Verify Cron Job

```sql
-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'ingestion-runner';

-- View recent job executions
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ingestion-runner')
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Verification Queries

### Check Ingestion Runs

```sql
-- View all ingestion runs
SELECT 
  job_name,
  status,
  started_at,
  finished_at,
  error_message,
  details
FROM public.ingestion_runs
ORDER BY started_at DESC
LIMIT 20;

-- Get last successful run for each job
SELECT * FROM public.get_last_successful_ingestion_all();

-- Get last successful cron_runner run
SELECT * FROM public.get_last_successful_ingestion('cron_runner');

-- Check run success rate (last 24h)
SELECT 
  job_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as success_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 1) as success_rate_percent
FROM public.ingestion_runs
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY job_name;
```

### Check pg_cron Schedule

```sql
-- View scheduled jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  jobid,
  command
FROM cron.job
WHERE jobname LIKE '%ingestion%';

-- View recent executions
SELECT 
  j.jobname,
  jr.start_time,
  jr.end_time,
  jr.status,
  jr.return_message
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE j.jobname = 'ingestion-runner'
ORDER BY jr.start_time DESC
LIMIT 10;
```

### Test Ingestion Run Manually

```sql
-- Trigger ingestion manually (for testing)
SELECT public.trigger_ingestion();
```

---

## Troubleshooting

### Cron Job Not Running

1. **Check if job is scheduled:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'ingestion-runner';
   ```

2. **Check if service role key is set:**
   ```sql
   SHOW app.settings.supabase_service_role_key;
   ```
   If NULL, set it (see Deployment Steps #2).

3. **Check cron logs:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ingestion-runner')
   ORDER BY start_time DESC 
   LIMIT 5;
   ```

4. **Check Edge Function logs:**
   - Supabase Dashboard > Edge Functions > cron_runner > Logs

### "Last updated" Not Showing

1. **Check if ingestion_runs has data:**
   ```sql
   SELECT * FROM public.ingestion_runs 
   WHERE job_name = 'cron_runner' AND status = 'success'
   ORDER BY finished_at DESC 
   LIMIT 1;
   ```

2. **Check RPC function:**
   ```sql
   SELECT * FROM public.get_last_successful_ingestion('cron_runner');
   ```

3. **Check RLS policies:**
   - Ensure `Authenticated users can read ingestion_runs` policy exists
   - Check user is authenticated (anon users can also read)

### Service Role Key Security

⚠️ **Never commit the service role key to git!**

- Store in Supabase dashboard settings (preferred)
- Or use environment variables (if supported)
- Or set via SQL (but don't commit the SQL file with the key)

---

## Rollback Steps

If issues occur:

1. **Re-enable Vercel cron:**
   ```json
   // vercel.json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/" }],
     "crons": [{ "path": "/api/cron", "schedule": "*/30 * * * *" }]
   }
   ```

2. **Disable pg_cron job:**
   ```sql
   SELECT cron.unschedule('ingestion-runner');
   ```

3. **UI will fallback:** StudioFeed/StudioExplore will show "Last loaded" instead of "Last updated" if query fails

---

## Next Steps

1. Monitor `ingestion_runs` table for job health
2. Set up alerts if job fails (via Supabase or external monitoring)
3. Consider adding dashboard to visualize ingestion metrics
4. Review cron schedule (currently 30 minutes; adjust if needed)


