# Feed Fix Summary

## Issues Identified and Fixed

### ✅ 1. Supabase Auth → Edge Function Auth Flow

**Status: Already Correct**

The Supabase client (`src/lib/supabaseClient.ts`) is correctly configured:
- Does NOT manually override Authorization headers
- Uses `supabase.functions.invoke()` which automatically sends JWT token
- The `Feed.tsx` page correctly uses `supabase.functions.invoke("social_feed", { body: { limit: 50 } })`

**No changes needed** - the auth flow is already working correctly.

### ✅ 2. social_feed Edge Function Fixes

**Fixed Issues:**
- ✅ Improved error handling for missing `feed_items` table
- ✅ Better error messages with debug info
- ✅ Graceful handling of empty tables

**Changes Made:**
- Added error handling for missing table (returns empty feed with helpful message)
- Improved catch block error reporting
- Function already correctly uses `supabase.auth.getUser()` for authentication

### ✅ 3. feed_items Table Migration

**Created:** `supabase/migrations/create_feed_items.sql`

This migration creates the `feed_items` table with:
- Correct schema matching what `social_feed` expects
- Unique index on `(source, external_id)` for upserts
- Proper RLS policies for authenticated users
- Indexes for performance

**Required Columns:**
- `id` (UUID, primary key)
- `source` (rss, youtube, reddit, podcast, eventbrite, spotify)
- `external_id` (unique ID from source)
- `url`, `title`, `summary`, `author`, `image_url`
- `published_at`, `tags`, `topics`, `metadata`
- `created_at`, `updated_at`

### ⚠️ 4. Feed Ingestion - Important Note

**IMPORTANT:** `sync-external-content` and `feed_items` serve **different purposes**:

- **`sync-external-content`**: Populates `external_content_cache` with TMDB/Open Library content (movies, books)
- **`feed_items`**: Stores RSS/YouTube/Reddit feeds (different data sources)

**To populate `feed_items`, you need to use:**
- `feed/ingest` Edge Function (for RSS, YouTube, Reddit, Podcast feeds)
- OR the `sources` table with RSS feeds that get ingested

**The `feed_items` table is NOT populated by `sync-external-content`** - they are separate systems.

## Required Actions

### 1. Run Migration

```bash
# Apply the feed_items table migration
supabase migration up create_feed_items
# OR run the SQL in Supabase SQL Editor:
# supabase/migrations/create_feed_items.sql
```

### 2. Populate feed_items

Option A: Use the ingest functions (recommended):
```bash
# Ingest RSS/YouTube/Reddit feeds
supabase functions invoke feed/ingest
```

Option B: Set up sources in the `sources` table:
- Insert rows into `sources` table with RSS/YouTube URLs
- Run the ingest functions to populate `feed_items`

### 3. Deploy Updated Edge Function

```bash
# Deploy the updated social_feed function
supabase functions deploy social_feed
```

### 4. Test

1. Log in to the app
2. Navigate to `/feed`
3. Should see feed items (if `feed_items` is populated)
4. Check console for any errors

## Validation Checklist

- [ ] Migration applied successfully
- [ ] `feed_items` table exists and is readable
- [ ] RLS policies allow authenticated users to read
- [ ] `feed_items` table has data (or shows empty gracefully)
- [ ] `social_feed` function returns `{ feed: [...], debug: { candidates > 0 } }`
- [ ] No 401 errors when authenticated
- [ ] No 404 errors
- [ ] Feed page loads without errors

## Troubleshooting

### "feed_items table does not exist"
- Run the migration: `supabase/migrations/create_feed_items.sql`

### "Empty feed"
- Populate `feed_items` using ingest functions
- Check that `sources` table has enabled feeds
- Verify ingest functions ran successfully

### "401 Unauthorized"
- Ensure user is logged in
- Check that JWT token is being sent (should be automatic)
- Verify `social_feed` function is deployed correctly

### "RLS policy violation"
- Check RLS policies in migration
- Ensure user is authenticated (not anonymous)
- Verify Edge Function uses service role for writes
