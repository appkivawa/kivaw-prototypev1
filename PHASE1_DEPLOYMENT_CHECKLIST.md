# Phase 1 Deployment Checklist

## Pre-Deployment: Pre-Flight Check (2 minutes)

### 1. Manual Trigger Test

Run in Supabase SQL Editor:
```sql
-- Check current state
SELECT 
  COUNT(*) as total_items,
  MAX(created_at) as latest_created,
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_items
FROM feed_items;
```

Then trigger ingestion manually:
- **Option A**: Admin panel → Operations → RSS Ingest → "Run Ingest Now"
- **Option B**: curl command (see PHASE1_PREFLIGHT_CHECK.md)

### 2. Verify Rows Written

```sql
-- Check if new items were added
SELECT 
  COUNT(*) as total_items,
  MAX(created_at) as latest_created,
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as just_added
FROM feed_items;
```

**Expected**: `just_added` > 0 if ingestion worked.

---

## Deployment Steps

### Step 1: Run SQL Migrations

In Supabase SQL Editor, run in order:

1. **Disable pg_cron jobs**:
   ```sql
   -- Run: supabase/migrations/20250128000002_disable_pg_cron_jobs.sql
   ```

2. **Create ingestion_runs table**:
   ```sql
   -- Run: supabase/migrations/20250128000003_create_ingestion_runs.sql
   ```

### Step 2: Deploy Edge Function

```bash
supabase functions deploy ingest_rss
```

### Step 3: Configure Vercel Cron

In Vercel Dashboard → Project Settings → Cron Jobs:

- **Path**: `/api/cron`
- **Schedule**: `0 * * * *` (every hour) or `*/30 * * * *` (every 30 minutes)
- **Timezone**: UTC

Ensure environment variables are set:
- `CRON_SECRET` (must match Edge Function secret)
- `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`
- `PROJECT_REF` or `SUPABASE_URL`

### Step 4: Verify

1. **Check Admin Panel**:
   - Go to Admin → Operations (or wherever RSSIngestTrigger is displayed)
   - Should show "Last run status" section
   - Click "Run Ingest Now" → should trigger and update status

2. **Check Database**:
   ```sql
   -- View latest ingestion runs
   SELECT * FROM ingestion_runs_latest 
   WHERE job_name = 'ingest_rss'
   ORDER BY started_at DESC 
   LIMIT 5;
   ```

3. **Wait for Cron Run**:
   - After cron schedule time, check `ingestion_runs_latest` again
   - Should see new entry with `job_name = 'ingest_rss'`

---

## Rollback (if needed)

If something breaks:

1. **Re-enable pg_cron** (if needed):
   ```sql
   -- Re-run original migrations:
   -- supabase/migrations/20250120000006_schedule_rss_ingest.sql
   -- supabase/migrations/20250122000001_schedule_ingestion_pg_cron.sql
   ```

2. **Disable Vercel Cron**:
   - Vercel Dashboard → Cron Jobs → Delete/Disable

3. **Revert Edge Function**:
   ```bash
   git checkout HEAD~1 supabase/functions/ingest_rss/index.ts
   supabase functions deploy ingest_rss
   ```

---

## Success Criteria

✅ Manual trigger writes rows to `feed_items`  
✅ `ingestion_runs` table has entries after runs  
✅ Admin panel shows "Last run status"  
✅ Vercel Cron triggers automatically (check after schedule time)  
✅ No double-ingestion (check `ingestion_runs` for duplicate timestamps)
