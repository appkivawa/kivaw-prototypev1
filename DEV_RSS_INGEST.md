# Local RSS Ingest Tools

This document describes the local-only tools for triggering RSS ingest during development.

## Overview

Three tools are available for triggering RSS ingest locally:

1. **Dev Page UI** - A web interface at `/dev/rss-ingest`
2. **CLI Script** - A Node.js script runnable via `npm run ingest-rss` (runs once)
3. **Loop Script** - A continuous script runnable via `npm run dev:ingest` (runs every 5 minutes)

All tools are **only available in development mode** and will not work in production builds.

## Prerequisites

1. **Supabase running locally**: Make sure you have `supabase start` running
   ```bash
   supabase start
   ```

2. **Environment variables**: Ensure your `.env` or `.env.local` file has:
   ```env
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **RSS sources**: Make sure you have active RSS sources in the `rss_sources` table

## Option 1: Dev Page UI

### Access

Navigate to: `http://localhost:5173/dev/rss-ingest` (or your dev server URL)

### Features

- One-click trigger button
- Real-time loading state
- Summary statistics:
  - Sources Processed
  - Items Fetched
  - Items Upserted
  - Errors Count
- Detailed feed-by-feed results (expandable)
- Error messages with helpful context

### Usage

1. Start your dev server: `npm run dev`
2. Navigate to `/dev/rss-ingest`
3. Click "🚀 Trigger RSS Ingest"
4. View results and statistics

## Option 2: CLI Script (One-time)

### Usage

```bash
npm run ingest-rss
```

### Output

The script will display:
- Summary statistics (sources processed, items fetched, items upserted, errors)
- Detailed feed-by-feed results
- Error messages if something goes wrong

## Option 3: Loop Script (Continuous)

### Usage

```bash
npm run dev:ingest
```

### Features

- Runs immediately once when started
- Then runs every 5 minutes automatically
- Logs each run with timestamps
- Shows summary statistics for each run
- Gracefully handles Ctrl+C to stop

### Output

The script continuously logs:
- Timestamp for each run
- Summary statistics (sources processed, items fetched, items upserted, errors)
- Condensed feed results (success/failure counts)
- Failed feed details (if any)

### Stopping

Press `Ctrl+C` to stop the loop gracefully.

### Example Output

```
🚀 Triggering RSS ingest...
📍 Function URL: http://localhost:54321/functions/v1/ingest_rss

✅ RSS Ingest Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Sources Processed: 25
📥 Items Fetched: 1250
💾 Items Upserted: 1250
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Feed Details:
  1. ✅ https://example.com/feed.xml - Fetched: 50, Upserted: 50 (1234ms)
  2. ✅ https://another.com/rss - Fetched: 50, Upserted: 50 (987ms)
  ...
```

## Configuration

Both tools use the same configuration:

- **maxFeeds**: 50 (maximum number of RSS sources to process)
- **perFeedLimit**: 100 (maximum items to fetch per feed)

These can be modified in:
- `src/pages/DevRSSIngest.tsx` (line ~50)
- `scripts/ingest-rss.ts` (line ~32)

## Troubleshooting

### Error: "Failed to trigger RSS ingest"

**Possible causes:**
1. Supabase is not running locally
   - Solution: Run `supabase start`

2. Wrong Supabase URL
   - Solution: Check `VITE_SUPABASE_URL` in your `.env` file
   - Default should be `http://localhost:54321`

3. Edge Function not deployed locally
   - Solution: Make sure the `ingest_rss` function exists in `supabase/functions/ingest_rss/`
   - Run `supabase functions serve ingest_rss` if needed

### Error: "No active RSS sources found"

**Cause**: The `rss_sources` table is empty or has no active sources

**Solution**: 
1. Check your `rss_sources` table: `SELECT * FROM rss_sources WHERE active = true;`
2. Run the RSS sources seed migration if needed

### Error: "feed_items table does not exist"

**Cause**: The `feed_items` table hasn't been created

**Solution**: Run the migration: `supabase/migrations/create_feed_items.sql`

## Security Notes

- These tools are **only available in development mode**
- The dev page checks `import.meta.env.PROD` and shows an error in production
- The CLI script can be run in any environment, but it's intended for local dev only
- Both tools call the local Supabase Edge Function, which requires local Supabase to be running

## Files

- `src/pages/DevRSSIngest.tsx` - Dev page UI component
- `scripts/ingest-rss.ts` - CLI script (one-time)
- `scripts/dev-ingest-rss.ts` - Loop script (continuous, every 5 minutes)
- `package.json` - Added `ingest-rss` and `dev:ingest` scripts
- `src/App.tsx` - Added route for dev page (dev-only)

