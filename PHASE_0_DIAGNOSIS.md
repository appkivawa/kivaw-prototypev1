# PHASE 0: ROOT CAUSE DIAGNOSIS

**Date**: 2025-01-28  
**Status**: COMPLETE

---

## CRITICAL FINDINGS

### 1. RSS INGESTION NOT RUNNING (CRITICAL)

**Symptom**: Latest articles stop around Jan 15, today is Jan 28 (13 days stale)

**Root Cause Analysis**:

**A. pg_cron Schedules May Not Be Configured**
- **Check**: Run `SELECT * FROM cron.job WHERE jobname LIKE 'kivaw%';` in Supabase SQL Editor
- **Expected**: Should show 3 jobs (`kivaw-hourly-rss`, `kivaw-six-hour-tmdb`, `kivaw-daily-books`)
- **If Missing**: pg_cron schedules were never created (see `SUPABASE_CRON_SETUP.md`)

**B. CRON_SECRET Mismatch**
- **Check**: `supabase secrets list` should show `CRON_SECRET`
- **Check**: pg_cron SQL must use same secret value
- **If Mismatch**: Jobs will return 403 Forbidden

**C. ingest_rss Function Failing Silently**
- **Check**: `SELECT * FROM system_health_events WHERE job_name = 'ingest_rss' ORDER BY ran_at DESC LIMIT 5;`
- **Expected**: Recent events with `status = 'ok'`
- **If Failing**: Check `error_message` column

**D. RSS Sources Inactive**
- **Check**: `SELECT url, active, category FROM rss_sources WHERE active = true ORDER BY weight DESC;`
- **Expected**: Multiple active sources across categories
- **If Empty**: Sources need to be activated or seeded

**E. Freshness Filter Too Strict**
- **Current**: `MAX_AGE_DAYS = 7` in `ingest_rss/index.ts`
- **Issue**: If items are >7 days old, they won't be ingested
- **But**: This shouldn't prevent NEW items from being ingested

**Most Likely Cause**: **pg_cron schedules not configured** or **CRON_SECRET mismatch**

**Fix Priority**: 🔴 **CRITICAL** - Must fix immediately

---

### 2. GOOGLE BOOKS STALE CONTENT

**Symptom**: Content is "stale and low-value", "not random or ancient results"

**Root Cause**:
- **Current Strategy**: `fetch-google-books` uses basic queries without trending/recent logic
- **No Sorting**: Results not sorted by relevance or publish date
- **No Subject Rotation**: Same queries used repeatedly
- **No Metadata**: `fetched_at` and ranking not stored

**Fix Required**:
1. Add trending/popular query construction
2. Add subject/topic rotation
3. Sort by relevance/newest
4. Store `fetched_at` and ranking metadata
5. Filter for recent books (2000+ publish year, favor newer)

**Fix Priority**: 🟡 **HIGH** - Affects content quality

---

### 3. TAGGING INCONSISTENT

**Symptom**: 
- RSS items must show source name (e.g., "The Verge") and genre tag (Tech, Business, etc.)
- Books and TMDB must use SAME tag system

**Root Cause Analysis**:

**A. RSS Source Names**
- **Current**: May show "RSS • provider" instead of proper source name
- **Fix**: Extract website name from URL or format provider name
- **Location**: `StudioExplore.tsx` has `extractWebsiteName()` function - verify it works

**B. RSS Genre Tags**
- **Current**: RSS items may not have genre tags
- **Required**: Map RSS feed `category` → genre (Tech, Business, World, Culture, Science, etc.)
- **Location**: `rss_sources.category` field exists, but may not be mapped to tags

**C. Unified Tag System**
- **Current**: Different tag systems for RSS, Books, TMDB
- **Required**: All content types use same tag vocabulary
- **Location**: `normalizeTags()` in `studioNormalize.ts` - verify it's used everywhere

**Fix Priority**: 🟡 **HIGH** - Affects UX coherence

---

### 4. RSS COVERAGE INSUFFICIENT

**Symptom**: Must include World/U.S. News, Business/Finance, Entertainment/Media, Culture/Ideas, Science/Health, Tech

**Current Status**:
- **Seeded Sources**: `20250120000004_seed_rss_sources.sql` has ~100 sources
- **Categories**: `tech`, `culture`, `finance`, `music`
- **Missing**: World/U.S. News, Science/Health categories

**Required**:
- Add World/U.S. News feeds (Reuters, AP, BBC, NPR, etc.)
- Add Science/Health feeds (Nature, Science, Scientific American, etc.)
- Map each feed → genre tag
- Ensure all feeds are non-paywalled and reliable

**Fix Priority**: 🟡 **HIGH** - Affects content breadth

---

### 5. SIDEBAR CHANNELS DON'T FILTER (DEAD UI)

**Symptom**: "Sidebar channels don't filter or navigate"

**Root Cause**:
- **Location**: `src/pages/Timeline.tsx` lines 326-330
- **Issue**: `StudioExplore` and `StudioFeed` are called WITHOUT `activeChannel` prop:
  ```tsx
  {viewMode === "explore" ? (
    <StudioExplore hideNav={true} />  // ❌ Missing activeChannel prop!
  ) : (
    <StudioFeed hideNav={true} />     // ❌ Missing activeChannel prop!
  )}
  ```
- **Expected**: Should pass `activeChannel={activeChannel}` and `activeCollection={activeCollection}`
- **Current**: `handleChannelClick` sets state, but components don't receive it

**Fix**: Pass props to `StudioExplore` and `StudioFeed`

**Fix Priority**: 🔴 **CRITICAL** - Dead UI element

---

### 6. COLLECTIONS DON'T WORK (DEAD UI)

**Symptom**: "Collections (Read Later / Favorites) don't work"

**Root Cause Analysis**:

**A. Read Later / Favorites Not Implemented**
- **Sidebar**: Shows "Read Later" and "Favorites" collections
- **Collection Page**: Uses `saved_items` table, but no distinction between "Read Later" and "Favorites"
- **Missing**: No `collection_type` or `status` field to differentiate

**B. Save Action**
- **Current**: `saveItem()` in `savesApi.ts` saves to `saved_items` table
- **Table**: `saved_items` has `user_id`, `content_item_id`, `created_at`
- **Missing**: No `collection_type` field (read_later vs favorites)

**Fix Required**:
1. Add `collection_type` field to `saved_items` table (or use separate tables)
2. Update save action to specify collection type
3. Update Collection page to filter by collection type
4. Make sidebar collections actually filter

**Fix Priority**: 🔴 **CRITICAL** - Dead UI element

---

### 7. UP NEXT NOT CLICKABLE (DEAD UI)

**Symptom**: "Up Next is not clickable"

**Root Cause**:
- **Location**: `src/components/timeline/TimelineWidgets.tsx` lines 95-156
- **Issue**: "Up Next" widget is just a `<div>`, no `onClick` handler
- **Expected**: Should navigate to `/item/:id` when clicked

**Fix**: Add `onClick` handler to navigate to item detail

**Fix Priority**: 🟡 **HIGH** - Dead UI element

---

### 8. PREFERENCES NON-FUNCTIONAL (DEAD UI)

**Symptom**: "Preferences / customized sources appear non-functional"

**Root Cause Analysis**:
- **Location**: `/preferences` route exists
- **Need to Check**: Does preferences page actually save preferences?
- **Need to Check**: Do preferences affect feed content?
- **Likely Issue**: Preferences saved but not used in feed scoring/filtering

**Fix Priority**: 🟡 **MEDIUM** - Needs investigation

---

### 9. FEED NOT A RECOMMENDATION ENGINE (DEAD UI)

**Symptom**: "Feed is chaotic and not a recommendation engine"

**Root Cause Analysis**:
- **Current**: `social_feed` Edge Function returns items, but no clear scoring
- **Location**: `src/pages/StudioFeed.tsx` calls `social_feed`
- **Issue**: Feed may just be chronological, not personalized

**Fix Required**:
- Implement simple but real scoring system:
  - Recency
  - Tag preference match
  - Source preference
  - Engagement (save/favorite/click)
- Document the formula
- Ensure feed ordering is explainable and stable

**Fix Priority**: 🟡 **MEDIUM** - Affects core value prop

---

### 10. BOARDS/COLLECTIONS TABS DO NOTHING (DEAD UI)

**Symptom**: "Boards / Collections tabs do nothing"

**Root Cause**:
- **Location**: `src/pages/Collection.tsx`
- **Need to Check**: Are there tabs for Boards/Collections?
- **Likely Issue**: Tabs exist but don't filter or organize content

**Fix Priority**: 🟡 **MEDIUM** - Needs investigation

---

### 11. PROFILE CLUTTERED WITH BROKEN LINKS (DEAD UI)

**Symptom**: "Profile is cluttered with broken links"

**Root Cause**:
- **Location**: `src/pages/Profile.tsx`
- **Need to Check**: What links exist and which are broken?
- **Fix**: Remove broken links or fix them

**Fix Priority**: 🟢 **LOW** - Cosmetic

---

### 12. DARK MODE BROKEN

**Symptom**: "Dark mode is broken"

**Root Cause Analysis**:
- **Theme System**: `src/theme/ThemeContext.tsx` exists and looks correct
- **Persistence**: Uses `localStorage.getItem("kivaw_theme")`
- **Application**: Sets `data-theme` attribute on `document.documentElement`
- **CSS**: `src/styles/theme.css` has dark mode styles

**Potential Issues**:
1. Some components may hardcode colors instead of using CSS variables
2. Theme may not be applied globally
3. Theme may regress on navigation

**Fix Priority**: 🟡 **MEDIUM** - Affects UX

---

## COMMAND EXECUTION STATUS

**npm install**: 
- ❌ **FAILED** - Permission error (EPERM)
- **Action Required**: User must run manually:
  ```bash
  npm i
  npm run build
  npm run lint
  npm run typecheck
  ```
- **Report**: All failures must be documented

---

## DATABASE VERIFICATION QUERIES

Run these in **Supabase SQL Editor** to diagnose:

### Check RSS Freshness
```sql
SELECT 
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_count,
  COUNT(*) as total_count
FROM feed_items;
-- Expected: latest_published should be within last 24 hours
```

### Check pg_cron Schedules
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'kivaw%';
-- Expected: 3 jobs, all active = true
```

### Check Cron Job Runs
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
LIMIT 10;
-- Expected: Recent runs with status = 'succeeded'
```

### Check System Health
```sql
SELECT 
  job_name,
  ran_at,
  status,
  error_message,
  metadata
FROM system_health_latest
WHERE job_name IN ('ingest_rss', 'cron_runner:hourly')
ORDER BY ran_at DESC;
-- Expected: Recent runs with status = 'ok'
```

### Check RSS Sources
```sql
SELECT 
  category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM rss_sources
GROUP BY category
ORDER BY category;
-- Expected: Multiple categories with active sources
```

### Check Saved Items Table
```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'saved_items'
ORDER BY ordinal_position;
-- Expected: Should have user_id, content_item_id, created_at
-- Check if collection_type or status field exists
```

---

## NEXT STEPS

1. **User must run commands** and report failures
2. **Verify cron status** using SQL queries above
3. **Test broken flows** and document console errors
4. **Begin Phase 1** - Fix RSS ingestion (highest priority)

---

**Status**: Phase 0 DIAGNOSIS COMPLETE - Ready for Phase 1
