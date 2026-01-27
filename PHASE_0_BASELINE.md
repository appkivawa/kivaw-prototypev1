# PHASE 0: BASELINE & REPRODUCTION REPORT

**Date**: 2025-01-28  
**Status**: IN PROGRESS

---

## 1. REPO STRUCTURE MAP

### Routes (from `src/App.tsx`)

**Public Routes**:
- `/login` → `Login`
- `/auth/callback` → `AuthCallback`
- `/studio` → `StudioHome` (homepage)
- `/studio/explore` → `StudioExplore`
- `/studio/feed` → `StudioFeed` (requires auth)
- `/creators` → `Creators`
- `/creators/apply` → `CreatorsApply`
- `/creators/dashboard` → `CreatorsDashboard` (requires creator role)

**App Shell Routes** (with navigation):
- `/` → Redirects to `/studio`
- `/explore` → `ExplorePage` (legacy?)
- `/feed` → `FeedPage` (legacy?)
- `/timeline` → `Timeline` (main timeline page)
- `/timeline/explore` → `Timeline` (with explore tab)
- `/timeline/feed` → `Timeline` (with feed tab)
- `/collection` → `Collection` (requires auth)
- `/preferences` → `Preferences` (requires auth)
- `/saved` → `Saved` (requires auth)
- `/profile` → `Profile`
- `/for-you` → `ForYou`
- `/recs` → `RecommendationsPage`
- `/waves` → `Waves` (requires auth)
- `/match` → `MatchPage`
- `/item/:id` → `ItemDetail`
- `/quiz/state` → `QuizState`
- `/quiz/focus` → `QuizFocus`
- `/quiz/result` → `QuizResult`
- `/guide` → `FAQPage`
- `/team` → `Team` (requires auth)

**Admin Routes** (nested under `/admin`):
- `/admin` → `Overview`
- `/admin/users` → `Users`
- `/admin/content` → `Content`
- `/admin/analytics` → `Analytics`
- `/admin/operations` → `Operations`
- `/admin/settings` → `Settings`
- `/admin/support` → `Support`
- `/admin/health` → `Health`
- `/admin/security` → `Security`
- `/admin/finance` → `Finance`
- `/admin/experiments` → `Experiments`
- `/admin/creator-requests` → `CreatorRequests`
- `/admin/integrations` → `Integrations`
- `/admin/recommendations-preview` → `RecommendationsPreview`
- `/admin/publish-to-explore` → `PublishToExplore`

**Dev-Only Routes**:
- `/admin-debug` → `AdminDebug` (DEV only)
- `/dev/rss-ingest` → `DevRSSIngest` (DEV only)

### Pages Inventory

**Core Pages**:
- `StudioHome.tsx` - Homepage
- `StudioExplore.tsx` - Explore content
- `StudioFeed.tsx` - User feed
- `Timeline.tsx` - Main timeline (hosts Explore/Feed tabs)
- `Collection.tsx` - User collection (echoes, saved items)
- `ItemDetail.tsx` - Item detail view

**Legacy/Unused Pages** (may be dead UI):
- `ExplorePage.tsx` - Legacy explore?
- `FeedPage.tsx` - Legacy feed?
- `ExploreFeedLegacy.tsx` - Legacy component
- `Home.tsx` - Unused?
- `HomePage.tsx` - Unused?
- `Timeline.old.tsx` - Old version
- `TimelineNew.tsx` - New version?

**Feature Pages**:
- `ForYou.tsx` - Personalized recommendations
- `RecommendationsPage.tsx` - Recommendations
- `MatchPage.tsx` - Matching/quiz
- `Preferences.tsx` - User preferences
- `Saved.tsx` - Saved items
- `Profile.tsx` - User profile
- `Waves.tsx` - Waves feature

**Quiz Pages**:
- `quiz/QuizState.tsx`
- `quiz/QuizFocus.tsx`
- `quiz/QuizResult.tsx`

**Admin Pages**:
- `AdminDebug.tsx` - Debug page
- `admin/tabs/*` - All admin tabs

**Creator Pages**:
- `Creator.tsx`
- `Creators.tsx`
- `CreatorsApply.tsx`
- `CreatorsDashboard.tsx`

**Other**:
- `Login.tsx`
- `FAQ.tsx`
- `Team.tsx`
- `DevRSSIngest.tsx` - Dev RSS ingestion tool

---

## 2. INGESTION PIPELINES

### RSS Ingestion

**Edge Function**: `supabase/functions/ingest_rss/index.ts`

**Scheduling Mechanism**: 
- Uses `pg_cron` (PostgreSQL extension)
- Scheduled via `cron_runner` Edge Function
- Job name: `hourly` (runs every hour)
- See `SUPABASE_CRON_SETUP.md` for setup

**Current Status**: 
- ⚠️ **CRITICAL**: Latest articles stop around Jan 15 (per user report)
- Today is Jan 28
- **ROOT CAUSE TO INVESTIGATE**: 
  1. pg_cron schedules not configured?
  2. cron_runner not being called?
  3. ingest_rss failing silently?
  4. RSS sources not active?

**Data Flow**:
1. `pg_cron` → calls `cron_runner` with `{"job": "hourly"}`
2. `cron_runner` → calls `ingest_rss` with `{maxFeeds: 25, perFeedLimit: 75}`
3. `ingest_rss` → reads from `rss_sources` table (active feeds)
4. `ingest_rss` → fetches RSS feeds, parses, filters (7-day freshness)
5. `ingest_rss` → upserts to `feed_items` table
6. `ingest_rss` → logs to `system_health_events`

**RSS Sources**:
- Table: `rss_sources` (created in `20250120000003_create_rss_sources.sql`)
- Seeded in: `20250120000004_seed_rss_sources.sql`
- Fields: `url`, `active`, `weight`, `category` (genre mapping)

**Freshness Filter**:
- `MAX_AGE_DAYS = 7` (defined in `ingest_rss/index.ts`)
- Only ingests items with `published_at` within last 7 days
- Items older than 7 days are excluded from Explore view

### Google Books Ingestion

**Edge Function**: `supabase/functions/fetch-google-books/index.ts`

**Scheduling Mechanism**:
- Called by `cron_runner` with job `daily`
- Also called by `sync-external-content` (six_hour job)

**Current Status**:
- ⚠️ **ISSUE**: Content is "stale and low-value" (per user)
- ⚠️ **ISSUE**: "Not random or ancient results" - needs recent/trending logic

**Data Flow**:
1. `cron_runner` (daily) → calls `fetch-google-books`
2. `fetch-google-books` → queries Google Books API
3. Results → stored in `external_content_cache` table

**Issues to Fix**:
- Need better query construction (recent/trending)
- Need subject/topic rotation
- Need sorting by relevance/newest
- Need to store `fetched_at` and ranking metadata

### TMDB Ingestion

**Edge Function**: `supabase/functions/fetch-tmdb/index.ts`  
**Also**: `supabase/functions/sync-external-content/index.ts` (includes TMDB)

**Scheduling Mechanism**:
- `cron_runner` job `six_hour` → calls `sync-external-content`
- `sync-external-content` → fetches TMDB trending + popular

**Current Status**:
- ✅ Should be working if cron is configured
- ⚠️ Need to verify trending endpoints are used

---

## 3. CRON/SCHEDULING MECHANISM

**Scheduler**: `pg_cron` (PostgreSQL extension)

**Orchestrator**: `cron_runner` Edge Function

**Jobs**:
1. **hourly** - RSS ingestion
   - Schedule: `'0 * * * *'` (every hour at minute 0)
   - Calls: `ingest_rss`
   
2. **six_hour** - Watch content refresh (TMDB)
   - Schedule: `'0 */6 * * *'` (every 6 hours)
   - Calls: `sync-external-content`
   
3. **daily** - Books refresh + RSS cleanup
   - Schedule: `'0 2 * * *'` (daily at 2 AM UTC)
   - Calls: `fetch-open-library`, `fetch-google-books`, `prune_stale_rss`

**Configuration**:
- See `SUPABASE_CRON_SETUP.md`
- Requires `CRON_SECRET` in Supabase secrets
- Requires pg_cron schedules configured in SQL

**Health Monitoring**:
- `system_health` table - basic health tracking
- `system_health_events` table - detailed event history
- `system_health_latest` view - latest status per job
- Admin > Health tab displays cron job status

**Verification Queries**:
```sql
-- Check if pg_cron schedules exist
SELECT * FROM cron.job WHERE jobname LIKE 'kivaw%';

-- Check job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;

-- Check system health
SELECT * FROM system_health_latest
ORDER BY job_name;
```

---

## 4. DATABASE SCHEMA

### Core Tables

**`feed_items`** - RSS feed items
- `id`, `external_id`, `url`, `title`, `summary`, `author`
- `image_url`, `published_at`, `ingested_at`
- `content_kind`, `provider`, `source`
- `tags`, `topics`, `is_discoverable`, `score`
- `metadata` (JSONB)

**`external_content_cache`** - TMDB, Books cache
- `id`, `provider`, `provider_id`, `type`
- `title`, `description`, `image_url`, `url`
- `raw` (JSONB - full API response)

**`explore_items_v2`** - Unified view (RSS + external + recommendations)
- View that UNIONs:
  - `feed_items` (RSS)
  - `external_content_cache` (TMDB, Books)
  - `public_recommendations` (recommendations)
- Fields: `id`, `kind`, `title`, `summary`, `image_url`, `url`, `tags`, `published_at`, `score`

**`system_health`** - Basic health tracking
- `key`, `last_run_at`, `last_ok`, `last_error`, `meta`

**`system_health_events`** - Detailed event history
- `id`, `job_name`, `ran_at`, `status`, `duration_ms`, `error_message`, `metadata`

**`rss_sources`** - RSS feed sources
- `id`, `url`, `active`, `weight`, `category` (genre)

**`saved_items`** - User saved items
- `id`, `user_id`, `content_item_id`, `saved_at`

**`profiles`** - User profiles
- `id`, `email`, `created_at`, `last_sign_in_at`, `is_admin`

**`user_roles`** - User role assignments
- `user_id`, `role_id`

**`roles`** - Role definitions
- `id`, `key`, `name`

**`admin_allowlist`** - Admin access control
- `user_id`, `super_admin`

### Views

- `explore_items_v2` - Unified content view
- `system_health_latest` - Latest health per job

### Functions

- `log_health_event()` - Log health events
- `is_admin()` - Check if user is admin
- `is_super_admin()` - Check if user is super admin
- `get_user_permissions()` - Get user permissions
- `prune_stale_rss()` - Mark old RSS as undiscoverable

---

## 5. EDGE FUNCTIONS

**Core Functions**:
1. `explore_feed_v2` - Explore page content
2. `social_feed` - Feed page content
3. `cron_runner` - Orchestrates scheduled jobs
4. `ingest_rss` - RSS ingestion
5. `sync-external-content` - TMDB sync
6. `fetch-open-library` - Open Library books
7. `fetch-google-books` - Google Books
8. `fetch-tmdb` - TMDB movies/TV

**Admin Functions**:
- `admin-list-users`
- `admin-invite-user`
- `admin-set-user-roles`
- `admin-stats`
- `admin-update-provider-settings`

**Other Functions**:
- `get-recommendations` - Recommendation engine
- `log-interaction` - Log user interactions
- `backfill_tags` - Tag backfill utility

---

## 6. BROKEN FLOWS (TO DOCUMENT)

### Sidebar Navigation
- **Route**: `/timeline` sidebar channels
- **Issue**: "Sidebar channels don't filter or navigate"
- **Status**: TO INVESTIGATE
- **Expected**: Clicking channel should filter content
- **Actual**: Unknown (need to test)

### Collections
- **Route**: `/collection`
- **Issue**: "Collections (Read Later / Favorites) don't work"
- **Status**: TO INVESTIGATE
- **Expected**: Save items to Read Later/Favorites, persist
- **Actual**: Unknown (need to test)

### Up Next
- **Route**: `/timeline` (right sidebar)
- **Issue**: "Up Next is not clickable"
- **Status**: TO INVESTIGATE
- **Expected**: Clicking "Up Next" item opens detail view
- **Actual**: Unknown (need to test)

### Preferences
- **Route**: `/preferences`
- **Issue**: "Preferences / customized sources appear non-functional"
- **Status**: TO INVESTIGATE
- **Expected**: Preferences affect feed content
- **Actual**: Unknown (need to test)

### Feed Recommendations
- **Route**: `/timeline/feed`
- **Issue**: "Feed is chaotic and not a recommendation engine"
- **Status**: TO INVESTIGATE
- **Expected**: Feed shows personalized recommendations
- **Actual**: Unknown (need to test)

### Boards/Collections Tabs
- **Route**: `/collection`
- **Issue**: "Boards / Collections tabs do nothing"
- **Status**: TO INVESTIGATE
- **Expected**: Tabs filter or organize content
- **Actual**: Unknown (need to test)

### Profile
- **Route**: `/profile`
- **Issue**: "Profile is cluttered with broken links"
- **Status**: TO INVESTIGATE
- **Expected**: Profile shows user info, working links
- **Actual**: Unknown (need to test)

### Dark Mode
- **Route**: All routes
- **Issue**: "Dark mode is broken"
- **Status**: TO INVESTIGATE
- **Expected**: Dark mode persists, works everywhere
- **Actual**: Unknown (need to test)

---

## 7. COMMAND EXECUTION STATUS

**npm install**: 
- ❌ FAILED - Permission error (EPERM)
- **Note**: Cannot run in sandbox, requires user to run manually

**Next Steps**:
- User must run: `npm i`, `npm run build`, `npm run lint`, `npm run typecheck`
- Report failures for Phase 0 completion

---

## 8. ROOT CAUSE HYPOTHESES

### RSS Not Updating (Jan 15 cutoff)

**Possible Causes**:
1. **pg_cron schedules not configured** - Most likely
   - Check: `SELECT * FROM cron.job WHERE jobname LIKE 'kivaw%';`
   - Fix: Run SQL from `SUPABASE_CRON_SETUP.md`

2. **CRON_SECRET mismatch**
   - Check: `supabase secrets list` vs pg_cron SQL
   - Fix: Ensure secrets match

3. **ingest_rss failing silently**
   - Check: `system_health_events` table
   - Check: Supabase Edge Function logs
   - Fix: Debug error messages

4. **RSS sources inactive**
   - Check: `SELECT * FROM rss_sources WHERE active = true;`
   - Fix: Activate sources or add new ones

5. **Freshness filter too strict**
   - Check: `MAX_AGE_DAYS = 7` in `ingest_rss/index.ts`
   - Fix: Adjust if needed (but 7 days should be fine)

### Google Books Stale Content

**Possible Causes**:
1. **No recent/trending logic** - Most likely
   - Current: Random queries, no sorting
   - Fix: Add trending queries, sort by relevance/newest

2. **Not scheduled to refresh**
   - Check: `cron_runner` daily job
   - Fix: Ensure daily job calls `fetch-google-books`

3. **Cache not refreshing**
   - Check: `external_content_cache` table timestamps
   - Fix: Ensure upsert updates timestamps

### Tagging Inconsistent

**Possible Causes**:
1. **RSS tags not mapped to genres**
   - Current: RSS items may not have proper genre tags
   - Fix: Map RSS feed categories → genres (Tech, Business, etc.)

2. **Books/TMDB tags not unified**
   - Current: Different tag systems
   - Fix: Normalize all tags to same system

3. **Source name not displayed**
   - Current: May show "RSS • provider" instead of "The Verge"
   - Fix: Extract and display proper source names

---

## 9. NEXT STEPS (PHASE 0 COMPLETION)

1. **User must run commands**:
   ```bash
   npm i
   npm run build
   npm run lint
   npm run typecheck
   ```
   Report all failures.

2. **Test broken flows**:
   - Click through sidebar channels
   - Try to save items
   - Click "Up Next"
   - Test preferences
   - Test dark mode toggle
   - Document console errors and network failures

3. **Verify cron status**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM cron.job WHERE jobname LIKE 'kivaw%';
   SELECT * FROM system_health_latest;
   SELECT MAX(published_at) FROM feed_items;
   ```

4. **Check RSS sources**:
   ```sql
   SELECT url, active, category FROM rss_sources ORDER BY weight DESC;
   ```

---

**Status**: Phase 0 IN PROGRESS - Awaiting user command execution and flow testing
