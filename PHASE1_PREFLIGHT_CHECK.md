# Phase 1 Pre-Flight Check

## Step 1: Manual Trigger Test

Run this in Supabase SQL Editor to check current feed_items state:

```sql
-- Check latest feed_items
SELECT 
  COUNT(*) as total_items,
  MAX(created_at) as latest_created,
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days') as fresh_items
FROM feed_items;
```

Then manually trigger ingestion via Edge Function:

```bash
# Get your project URL and anon key from Supabase Dashboard
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_rss \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"maxFeeds": 5, "perFeedLimit": 10}'
```

Or use the admin panel if available.

## Step 2: Verify Rows Written

After triggering, check again:

```sql
-- Check if new items were added
SELECT 
  COUNT(*) as total_items,
  MAX(created_at) as latest_created,
  MAX(published_at) as latest_published,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as just_added
FROM feed_items;
```

Expected: `just_added` should be > 0 if ingestion worked.
