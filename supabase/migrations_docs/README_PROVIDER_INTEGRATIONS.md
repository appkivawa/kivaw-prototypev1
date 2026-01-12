# Provider Integrations Migration

## Overview

This migration creates the database tables needed for external provider integrations and content caching.

## Tables Created

### 1. `provider_settings`
- Stores configuration for external providers (TMDB, Google Books, etc.)
- Columns:
  - `provider` (TEXT, PRIMARY KEY) - Provider identifier
  - `enabled` (BOOLEAN, DEFAULT TRUE) - Whether provider is enabled
  - `config` (JSONB, DEFAULT '{}') - Provider-specific configuration
  - `updated_at` (TIMESTAMPTZ, DEFAULT NOW()) - Last update timestamp

### 2. `external_content_cache`
- Caches content fetched from external providers
- Columns:
  - `id` (UUID, PRIMARY KEY) - Unique cache entry ID
  - `provider` (TEXT, NOT NULL) - Provider identifier
  - `provider_id` (TEXT, NOT NULL) - Provider's internal ID
  - `type` (TEXT, NOT NULL) - Content type: 'watch' or 'read'
  - `title` (TEXT, NOT NULL) - Content title
  - `description` (TEXT) - Content description
  - `image_url` (TEXT) - Image URL
  - `url` (TEXT) - Content URL
  - `raw` (JSONB, NOT NULL) - Raw API response
  - `fetched_at` (TIMESTAMPTZ, DEFAULT NOW()) - When content was fetched
  - UNIQUE constraint on (provider, provider_id)

### 3. `content_tags`
- Links cached content to modes and focus categories
- Columns:
  - `cache_id` (UUID, FK to external_content_cache.id) - References cached content
  - `mode` (TEXT, NOT NULL) - Mode tag (Reset, Beauty, Logic, Faith, Reflect, Comfort)
  - `focus` (TEXT, NOT NULL) - Focus tag (Watch, Read)
  - PRIMARY KEY (cache_id, mode, focus)

## Row Level Security (RLS)

### `provider_settings`
- **Read**: Admins only (via `is_admin()` check)
- **Write**: Admins only (via Edge Functions)

### `external_content_cache`
- **Read**: Authenticated users
- **Write**: Blocked for clients (only Edge Functions with service role can write)

### `content_tags`
- **Read**: Authenticated users
- **Write**: Blocked for clients (only Edge Functions with service role can write)

## Seeded Data

The migration seeds `provider_settings` with:
- `tmdb` (enabled: true)
- `google_books` (enabled: true)

## How to Run

### Option 1: Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `create_provider_integrations_v2.sql`
4. Click "Run" to execute the migration

### Option 2: Supabase CLI

```bash
# From your project root
supabase db push

# Or run the specific migration file
supabase db execute --file supabase/migrations/create_provider_integrations_v2.sql
```

### Option 3: psql

```bash
# Connect to your Supabase database
psql -h <your-db-host> -U postgres -d postgres

# Run the migration
\i supabase/migrations/create_provider_integrations_v2.sql
```

## Verification

After running the migration, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('provider_settings', 'external_content_cache', 'content_tags');

-- Check provider_settings were seeded
SELECT provider, enabled FROM public.provider_settings;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('provider_settings', 'external_content_cache', 'content_tags');
```

## Usage

### Query cached content with tags:

```sql
SELECT 
  c.*,
  array_agg(DISTINCT t.mode || ':' || t.focus) as tags
FROM public.external_content_cache c
LEFT JOIN public.content_tags t ON t.cache_id = c.id
WHERE c.provider = 'tmdb'
GROUP BY c.id;
```

### Find content by mode and focus:

```sql
SELECT DISTINCT c.*
FROM public.external_content_cache c
JOIN public.content_tags t ON t.cache_id = c.id
WHERE t.mode = 'Comfort' AND t.focus = 'Watch';
```

## Important Notes

- **No client writes**: All writes to `external_content_cache` and `content_tags` must go through Edge Functions using the service role key
- **Service role bypasses RLS**: Edge Functions can write because they use the service role key, which bypasses RLS policies
- **Type constraint**: Only 'watch' and 'read' types are allowed in `external_content_cache`
- **Mode/Focus values**: Use capitalized names (Reset, Beauty, Logic, Faith, Reflect, Comfort, Watch, Read) when inserting tags


