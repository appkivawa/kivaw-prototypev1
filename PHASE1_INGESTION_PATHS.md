# Phase 1: Ingestion Paths Analysis

## A) Identified Ingestion Paths

### 1. **Vercel Cron** (Preferred - Single Source of Truth)
- **File**: `api/cron.ts`
- **Route**: `/api/cron` (Vercel serverless function)
- **Schedule**: Configured in Vercel Dashboard → Cron Jobs
- **Action**: Calls `cron_runner` Edge Function with `x-cron-secret`
- **Status**: ✅ Should be the ONLY active scheduler

### 2. **pg_cron** (Multiple Jobs - TO BE DISABLED)
- **Migration 1**: `20250120000006_schedule_rss_ingest.sql`
  - Job name: `rss-ingest-hourly`
  - Schedule: `'0 * * * *'` (every hour)
  - Function: `trigger_rss_ingest()` → calls `ingest_rss` Edge Function directly
  - **Status**: ❌ Should be disabled (bypassed by cron_runner)

- **Migration 2**: `20250122000001_schedule_ingestion_pg_cron.sql`
  - Job name: `ingestion-runner`
  - Schedule: `'*/30 * * * *'` (every 30 minutes)
  - Function: `trigger_ingestion()` → calls `cron_runner` Edge Function
  - **Status**: ❌ Should be disabled (conflicts with Vercel Cron)

### 3. **Edge Function Scheduled Triggers**
- **Config**: `supabase/config.toml`
- **Status**: ✅ None found (good - no conflicts)

## B) Consolidation Plan

**Decision**: Use **Vercel Cron** as single source of truth
- More reliable (Vercel handles scheduling)
- Better observability (Vercel logs)
- No database dependency (pg_cron requires DB access)

**Actions**:
1. Disable both pg_cron jobs
2. Configure Vercel Cron to call `cron_runner` with proper schedule
3. Remove/comment out pg_cron migrations (or add disable script)

## C) RSS Freshness & Deduplication

**Current Implementation** (`ingest_rss/index.ts`):
- ✅ Filters items older than 7 days (`MAX_AGE_DAYS = 7`)
- ✅ Deduplicates by `(source, external_id)` unique constraint
- ✅ Uses `upsert` with `onConflict: "source,external_id"`
- ✅ Stores `published_at` correctly

**Issues to Verify**:
- Ensure `source` column matches `feed_items.source` constraint
- Verify `external_id` is unique per feed

## D) Health Logging

**Current**: Uses `system_health_events` table via `logHealthEvent`
- ✅ Already implemented in `ingest_rss`
- ✅ Logs: `job_name`, `ran_at`, `status`, `duration_ms`, `error_message`, `metadata`

**Need**: Create `ingestion_runs` table OR use existing `system_health_events`
- Decision: Use `system_health_events` (already exists)
- Add specific `job_name` format: `ingest_rss`, `cron_runner:hourly`, etc.

## E) Admin Panel

**Current**: `src/admin/components/RSSIngestTrigger.tsx` exists
- Need to enhance with:
  - "Run ingest now" button
  - "Last run status" display (from `system_health_events`)
  - Real-time status updates
