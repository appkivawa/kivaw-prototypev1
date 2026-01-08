# Automatic Tagging System

## Overview

The automatic tagging system maps external content (from TMDB, Google Books, etc.) into Modes and Focus categories for discovery and recommendations.

## How It Works

### 1. Automatic Tag Inference

When content is fetched and cached, tags are automatically computed:

- **Focus** is inferred from content type:
  - `watch` → Focus: "watch"
  - `read` → Focus: "read"
  - `listen` → Focus: "music"
  - `event` → Focus: "move"

- **Modes** are inferred from keyword matching on:
  - Title
  - Description
  - Genres (for movies)
  - Categories (for books)

### 2. Keyword Rules

Modes are matched using simple keyword lists:

- **Reset**: calm, peace, quiet, zen, meditation, mindfulness, relax, rest, etc.
- **Beauty**: beauty, aesthetic, art, visual, design, nature, landscape, photography, etc.
- **Logic**: science, logic, reason, analysis, thinking, philosophy, theory, research, etc.
- **Faith**: faith, spiritual, religion, prayer, god, divine, sacred, bible, etc.
- **Reflect**: reflection, introspection, self, awareness, mindfulness, journal, etc.
- **Comfort**: comfort, cozy, warm, safe, home, family, love, care, support, etc.

If no modes match, content defaults to "comfort" mode.

### 3. Tag Overrides

Admins can manually override automatic tags using the `tag_overrides` table:

```sql
-- Example: Override tags for a specific movie
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES ('tmdb', '27205', 'reflect', 'watch');

-- Example: Add multiple modes/focus for a book
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES 
  ('google_books', 'abc123', 'comfort', 'read'),
  ('google_books', 'abc123', 'reflect', 'read');
```

Overrides are merged with automatic tags. If an override exists, it is combined with auto-tags (both are included in the final result).

### 4. Storage

Tags are stored in `content_tags` table:
- `cache_id` - Links to `external_content_cache.id`
- `mode` - One of: reset, beauty, logic, faith, reflect, comfort
- `focus` - One of: watch, read, create, move, music, reflect, reset

Each content item can have multiple mode/focus combinations (e.g., a movie can be both "beauty" and "comfort" mode with "watch" focus).

## Edge Function Integration

Both `fetch-tmdb` and `fetch-google-books` edge functions automatically:

1. Fetch content from external APIs
2. Upsert to `external_content_cache`
3. Compute tags (checking overrides first)
4. Store tags in `content_tags`

Tagging happens automatically - no additional API calls needed.

## Admin Management

### View Tags

```sql
-- View all tags for cached content
SELECT 
  c.provider,
  c.provider_id,
  c.title,
  t.mode,
  t.focus
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
ORDER BY c.title;
```

### Add Override

```sql
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES ('tmdb', '27205', 'reflect', 'watch');
```

### Remove Override

```sql
DELETE FROM public.tag_overrides
WHERE provider = 'tmdb' AND provider_id = '27205';
```

### Update Keywords

To modify keyword matching rules, edit the `MODE_KEYWORDS` constant in:
- `supabase/functions/fetch-tmdb/index.ts`
- `supabase/functions/fetch-google-books/index.ts`

Or extract to a shared module for easier maintenance.

## Querying Tagged Content

```sql
-- Get all "watch" content tagged with "beauty" mode
SELECT c.*
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE t.mode = 'beauty' AND t.focus = 'watch';

-- Get all "read" content tagged with "comfort" or "reflect"
SELECT DISTINCT c.*
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE t.focus = 'read' AND t.mode IN ('comfort', 'reflect');
```

## Future Enhancements

- Extract tagging logic to shared module for easier maintenance
- Add admin UI for managing tag overrides
- Add admin UI for editing keyword rules
- Support for merging overrides with auto-tags (instead of replacing)
- Machine learning-based tagging (optional enhancement)

