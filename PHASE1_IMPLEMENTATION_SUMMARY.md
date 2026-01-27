# Phase 1 Implementation Summary

## ✅ Completed Tasks

### A) Ingestion Paths Identified

**Found 3 potential schedulers:**
1. **Vercel Cron** (`api/cron.ts`) - ✅ Preferred (single source of truth)
2. **pg_cron** - ❌ Two conflicting jobs:
   - `rss-ingest-hourly` (every hour, calls `ingest_rss` directly)
   - `ingestion-runner` (every 30 min, calls `cron_runner`)
3. **Edge Function Scheduled Triggers** - ✅ None found (good)

### B) Consolidation to Single Scheduler

**Decision**: Use **Vercel Cron** as single source of truth
- Created migration: `20250128000002_disable_pg_cron_jobs.sql`
- Disables both pg_cron jobs to prevent double-ingestion
- Vercel Cron should be configured in Vercel Dashboard → Cron Jobs

**Action Required**: 
- Run migration in Supabase SQL Editor
- Configure Vercel Cron to call `/api/cron` endpoint (see `vercel.json` or Vercel Dashboard)

### C) RSS Freshness & Deduplication

**Verified in `ingest_rss/index.ts`:**
- ✅ Filters items older than 7 days (`MAX_AGE_DAYS = 7`)
- ✅ Deduplicates by `(source, external_id)` unique constraint
- ✅ Uses `upsert` with `onConflict: "source,external_id"`
- ✅ Stores `published_at` correctly (ISO format)
- ✅ Uses `source: "rss"` (matches table CHECK constraint)

**No changes needed** - implementation is correct.

### D) Health Logging

**Created:**
1. `ingestion_runs` table (`20250128000003_create_ingestion_runs.sql`)
   - Stores detailed run history: started_at, finished_at, status, metrics
   - Includes: feeds_processed, items_fetched, items_upserted, items_skipped
   - View: `ingestion_runs_latest` for latest run per job

2. `logIngestionRun` helper function (`supabase/functions/_shared/logIngestionRun.ts`)
   - Logs to `ingestion_runs` table
   - Used by `ingest_rss` Edge Function

3. Updated `ingest_rss/index.ts`:
   - Logs "running" status at start
   - Logs "ok" or "fail" status at end with full metrics
   - Also logs to `system_health_events` for backward compatibility

### E) Admin Panel Enhancement

**Updated `RSSIngestTrigger.tsx`:**
- ✅ "Run ingest now" button (already existed, enhanced)
- ✅ "Last run status" display:
  - Shows status (✅ Success / ❌ Failed / ⏳ Running)
  - Shows time ago (e.g., "Finished 2 hours ago")
  - Shows metrics (feeds, fetched, upserted, skipped)
  - Shows error message if failed
  - Auto-refreshes after manual trigger

## 📋 Pre-Flight Check Instructions

### Step 1: Manual Trigger Test

```sql
-- Check current state
SELECT 
  COUNT(*) as total_items,
  MAX(created_at) as latest_created,
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_items
FROM feed_items;
```

Then trigger via Admin panel or curl:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ingest_rss \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"maxFeeds": 5, "perFeedLimit": 10}'
```

### Step 2: Verify Rows Written

```sql
-- Check if new items were added
SELECT 
  COUNT(*) as total_items,
  MAX(created_at) as latest_created,
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as just_added
FROM feed_items;
```

Expected: `just_added` > 0 if ingestion worked.

### Step 3: Check Ingestion Runs Log

```sql
-- View latest ingestion runs
SELECT * FROM ingestion_runs_latest 
WHERE job_name = 'ingest_rss'
ORDER BY started_at DESC 
LIMIT 5;
```

## 🚀 Deployment Steps

1. **Run SQL Migrations** (in Supabase SQL Editor):
   - `20250128000002_disable_pg_cron_jobs.sql` (disable pg_cron)
   - `20250128000003_create_ingestion_runs.sql` (create logging table)

2. **Deploy Edge Function**:
   ```bash
   supabase functions deploy ingest_rss
   ```

3. **Configure Vercel Cron** (in Vercel Dashboard):
   - Add cron job: `/api/cron`
   - Schedule: `0 * * * *` (every hour) or `*/30 * * * *` (every 30 min)
   - Ensure `CRON_SECRET` env var is set in Vercel

4. **Verify**:
   - Check Admin panel → Operations → RSS Ingest
   - Should show "Last run status" after first cron run
   - Manual trigger should work and update status

## 📝 Notes

- `ingest_rss` now logs to both `ingestion_runs` (detailed) and `system_health_events` (backward compatibility)
- Admin panel auto-refreshes last run status after manual trigger (2s delay)
- pg_cron jobs are disabled but can be re-enabled if needed (run original migrations)
- Vercel Cron is the single source of truth for scheduling
