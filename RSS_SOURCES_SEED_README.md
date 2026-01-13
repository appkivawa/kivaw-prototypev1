# RSS Sources Seed Guide

This guide explains how to seed default RSS sources for Kivaw.

## Overview

The seed includes ~100 RSS sources across 4 categories:
- **Tech** (35 sources): AI, startups, engineering, VC blogs
- **Culture** (35 sources): Film/TV, internet culture, books, gaming
- **Finance** (35 sources): Markets, macro economics, VC firms
- **Music** (25 sources): Music news, reviews, industry coverage

## Database Schema

The `rss_sources` table has the following structure:
- `id` (UUID): Primary key
- `title` (TEXT): Display name of the RSS source
- `url` (TEXT): RSS feed URL (unique)
- `category` (TEXT): Category (tech, culture, finance, music)
- `weight` (INTEGER): Priority weight 1-5 (higher = more important)
- `language` (TEXT): Language code (default: 'en')
- `active` (BOOLEAN): Whether source is currently active
- `created_at`, `updated_at`: Timestamps

## Running the Seed

### Option 1: Via Supabase CLI (Recommended)

```bash
# From project root
supabase db push
```

This will run all migrations including the seed.

### Option 2: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migrations in order:
   - First: `supabase/migrations/20250120000003_create_rss_sources.sql`
   - Then: `supabase/migrations/20250120000004_seed_rss_sources.sql`

### Option 3: Direct SQL Execution

```bash
# Run locally with Supabase CLI
supabase db reset  # This will run all migrations including seeds
```

Or manually in SQL Editor:
1. Copy contents of `20250120000003_create_rss_sources.sql`
2. Paste and run in SQL Editor
3. Copy contents of `20250120000004_seed_rss_sources.sql`
4. Paste and run in SQL Editor

## Verification

After running the seed, verify it worked:

```sql
-- Check counts by category
SELECT 
  category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active
FROM public.rss_sources
GROUP BY category
ORDER BY category;

-- Should show ~100 total sources
SELECT COUNT(*) FROM public.rss_sources;

-- Check a few sample sources
SELECT title, url, category, weight, active
FROM public.rss_sources
ORDER BY category, weight DESC
LIMIT 20;
```

## Re-running the Seed

The seed uses `ON CONFLICT (url) DO UPDATE`, so you can safely re-run it:
- Existing sources will be updated with new values
- New sources will be inserted
- No duplicates will be created

## How It Works

The `ingest_rss` function now checks for RSS sources in this order:
1. **Request body URLs** (if provided)
2. **rss_sources table** (default/global sources) - NEW
3. **user_sources table** (user-specific sources) - fallback

This means the default seed sources will be automatically ingested when the function runs, without requiring user-specific configuration.

## Updating Sources

To add or modify sources:

```sql
-- Add a new source
INSERT INTO public.rss_sources (title, url, category, weight, active)
VALUES ('New Source', 'https://example.com/feed', 'tech', 3, true)
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  weight = EXCLUDED.weight,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Deactivate a source
UPDATE public.rss_sources
SET active = false, updated_at = NOW()
WHERE url = 'https://example.com/feed';
```

## Notes

- All sources default to `active = true` and `language = 'en'`
- Weight defaults to 3 (medium priority)
- The `ingest_rss` function orders by weight (descending) when fetching sources
- Sources are de-duplicated by URL (unique constraint)

