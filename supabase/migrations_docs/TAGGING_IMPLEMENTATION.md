# Automatic Tagging Implementation Summary

## Overview

Automatic tagging maps external content (from TMDB, Google Books, etc.) into Modes and Focus categories for discovery and recommendations.

## Components

### 1. Database Tables

#### `content_tags` (already exists)
- Links cached content to modes and focus
- Columns: `cache_id`, `mode`, `focus`
- Primary key: `(cache_id, mode, focus)`

#### `tag_overrides` (new migration)
- Allows admins to manually add/override tags
- Columns: `provider`, `provider_id`, `mode`, `focus`
- Primary key: `(provider, provider_id, mode, focus)`
- RLS: Only admins can read/manage

**Migration file:** `supabase/migrations/create_tag_overrides.sql`

### 2. Tagging Logic

#### Focus Inference
- Automatically inferred from content type:
  - `watch` → Focus: "watch"
  - `read` → Focus: "read"
  - `listen` → Focus: "music"
  - `event` → Focus: "move"

#### Mode Inference
- Uses keyword matching on:
  - Title
  - Description
  - Genres (for movies from TMDB)
  - Categories (for books from Google Books)

**Modes:**
- **Reset**: calm, peace, quiet, zen, meditation, mindfulness, relax, rest, etc.
- **Beauty**: beauty, aesthetic, art, visual, design, nature, landscape, photography, etc.
- **Logic**: science, logic, reason, analysis, thinking, philosophy, theory, research, etc.
- **Faith**: faith, spiritual, religion, prayer, god, divine, sacred, bible, etc.
- **Reflect**: reflection, introspection, self, awareness, mindfulness, journal, etc.
- **Comfort**: comfort, cozy, warm, safe, home, family, love, care, support, etc.

**Default:** If no modes match, content defaults to "comfort" mode.

### 3. Override Merging

**Important:** Overrides are MERGED with auto-tags, not replaced.

Example:
- Auto-tags: `{ modes: ["beauty", "comfort"], focus: ["watch"] }`
- Override: `{ modes: ["reflect"], focus: ["watch"] }`
- Final result: `{ modes: ["beauty", "comfort", "reflect"], focus: ["watch"] }`

### 4. Edge Function Integration

Both `fetch-tmdb` and `fetch-google-books` edge functions:

1. Fetch content from external APIs
2. Upsert to `external_content_cache`
3. Compute auto-tags (focus from type, modes from keywords)
4. Check for tag overrides
5. Merge overrides with auto-tags
6. Store final tags in `content_tags` table

**Implementation files:**
- `supabase/functions/fetch-tmdb/index.ts`
- `supabase/functions/fetch-google-books/index.ts`

## Usage

### Run Migration

```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/create_tag_overrides.sql
```

### Add Tag Override

```sql
-- Add a mode override for a specific movie
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES ('tmdb', '27205', 'reflect', 'watch');

-- Add multiple overrides (will be merged with auto-tags)
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES 
  ('google_books', 'abc123', 'comfort', 'read'),
  ('google_books', 'abc123', 'reflect', 'read');
```

### Remove Override

```sql
DELETE FROM public.tag_overrides
WHERE provider = 'tmdb' AND provider_id = '27205' AND mode = 'reflect' AND focus = 'watch';
```

### Query Tagged Content

```sql
-- Get all "watch" content with "beauty" mode
SELECT c.*
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE t.mode = 'beauty' AND t.focus = 'watch';

-- Get all content with any override tags
SELECT DISTINCT c.*
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE EXISTS (
  SELECT 1 FROM tag_overrides o
  WHERE o.provider = c.provider 
    AND o.provider_id = c.provider_id
    AND o.mode = t.mode
    AND o.focus = t.focus
);
```

## Editing Keyword Rules

To modify keyword matching rules, edit the `MODE_KEYWORDS` constant in:
- `supabase/functions/fetch-tmdb/index.ts` (lines ~118-125)
- `supabase/functions/fetch-google-books/index.ts` (lines ~118-125)

After editing, redeploy the edge functions:
```bash
supabase functions deploy fetch-tmdb
supabase functions deploy fetch-google-books
```

## Testing

1. Fetch content via edge functions (or frontend provider layer)
2. Check `content_tags` table for auto-generated tags
3. Add override via SQL
4. Re-fetch same content (or trigger re-tagging)
5. Verify tags are merged (both auto and override present)

## Notes

- Tagging happens automatically when content is fetched and cached
- Tags are stored per content item (can have multiple mode/focus combinations)
- Overrides are additive - they add to auto-tags, not replace them
- Keyword matching is case-insensitive and uses substring matching
- If no keywords match, content defaults to "comfort" mode


