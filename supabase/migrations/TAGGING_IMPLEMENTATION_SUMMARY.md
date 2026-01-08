# Tagging Implementation Summary

## Overview

Simple, deterministic tagging system for external content (movies, books) that assigns **Modes** and **Focus** tags based on keyword matching and content type.

## Implementation

### 1. Shared Tagging Module
**File:** `supabase/functions/_shared/tagging.ts`

- Contains all tagging logic in one place
- Simple, editable keyword rules
- Functions:
  - `inferFocusFromType()` - Maps type to focus (watch→Watch, read→Read)
  - `inferModesFromContent()` - Keyword matching on title/description/genres/categories
  - `computeTagsForContent()` - Combines auto-tags with overrides
  - `storeTagsForCache()` - Stores tags in `content_tags` table

### 2. Edge Functions Updated
Both edge functions now use the shared tagging module:

- **`fetch-tmdb/index.ts`** - Extracts genres from TMDB data, computes tags, stores in `content_tags`
- **`fetch-google-books/index.ts`** - Extracts categories from Google Books data, computes tags, stores in `content_tags`

### 3. Database Tables

#### `content_tags` (already exists)
Stores computed tags (auto + overrides merged):
```sql
cache_id UUID REFERENCES external_content_cache(id)
mode TEXT -- reset, beauty, logic, faith, reflect, comfort
focus TEXT -- watch, read, music, move, etc.
PRIMARY KEY (cache_id, mode, focus)
```

#### `tag_overrides` (migration: `create_tag_overrides.sql`)
Stores manual tag overrides:
```sql
provider TEXT -- "tmdb" or "google_books"
provider_id TEXT -- Provider's internal ID
mode TEXT -- Mode to add
focus TEXT -- Focus to add
PRIMARY KEY (provider, provider_id, mode, focus)
```

## Tagging Rules

### Focus (Simple Rule)
- `watch` type → `watch` focus
- `read` type → `read` focus
- `listen` type → `music` focus
- `event` type → `move` focus

### Modes (Keyword Matching)
Searches title, description, genres (movies), categories (books) for keywords:

- **reset**: reset, calm, peace, quiet, zen, meditation, mindfulness, relax, rest, pause, break, breathe, stillness, silence
- **beauty**: beauty, aesthetic, art, visual, design, nature, landscape, photography, cinematography, gorgeous, stunning, breathtaking, scenic, picturesque, elegant, graceful
- **logic**: science, logic, reason, analysis, thinking, philosophy, theory, research, study, academic, intellectual, rational, critical thinking, problem solving, mathematics, physics, engineering
- **faith**: faith, spiritual, religion, prayer, god, divine, sacred, bible, scripture, worship, devotion, blessing, grace, salvation, heaven, soul, spirit, holy
- **reflect**: reflection, introspection, self, awareness, mindfulness, journal, diary, thought, contemplation, meditation, inner, personal, growth, development, insight, wisdom
- **comfort**: comfort, cozy, warm, safe, home, family, love, care, support, healing, recovery, nurture, gentle, soft, tender, compassion, empathy, kindness, hug

**Default:** If no modes match, assigns `comfort`.

### Override Tags
- Stored in `tag_overrides` table
- Merged with auto-tags (additive, not replacement)
- Admin-only access (RLS policies)

## Tag Computation Flow

1. Fetch content from external API
2. Normalize to standard format
3. Upsert to `external_content_cache` (get `cache_id`)
4. **Compute auto-tags:**
   - Infer focus from type
   - Extract genres (TMDB) or categories (Google Books)
   - Infer modes from keywords
5. **Fetch overrides** from `tag_overrides` table
6. **Merge** auto-tags with overrides (union)
7. **Store** final tags in `content_tags` table

## Editing Keyword Rules

Edit `supabase/functions/_shared/tagging.ts`:

```typescript
export const MODE_KEYWORDS: Record<Mode, string[]> = {
  reset: ["reset", "calm", "peace", ...], // Add/remove keywords
  beauty: ["beauty", "aesthetic", "art", ...],
  // ... etc
};
```

Then redeploy:
```bash
supabase functions deploy fetch-tmdb
supabase functions deploy fetch-google-books
```

## SQL Migrations

### Run these migrations:
1. `create_provider_integrations_v2.sql` - Creates `content_tags` table (if not exists)
2. `create_tag_overrides.sql` - Creates `tag_overrides` table

### Verify tables exist:
```sql
-- Check content_tags
SELECT COUNT(*) FROM public.content_tags;

-- Check tag_overrides
SELECT COUNT(*) FROM public.tag_overrides;
```

## Example Usage

### Add Manual Override
```sql
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES ('tmdb', '12345', 'beauty', 'watch');
```

### Query Tags for Content
```sql
SELECT c.title, t.mode, t.focus
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE c.provider = 'tmdb' AND c.provider_id = '12345';
```

### Query Content by Tag
```sql
SELECT c.*
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE t.mode = 'comfort' AND t.focus = 'watch';
```

## Files Changed

1. **Created:**
   - `supabase/functions/_shared/tagging.ts` - Shared tagging module
   - `supabase/functions/_shared/TAGGING_README.md` - Detailed documentation

2. **Updated:**
   - `supabase/functions/fetch-tmdb/index.ts` - Uses shared tagging module
   - `supabase/functions/fetch-google-books/index.ts` - Uses shared tagging module

3. **SQL (already exists):**
   - `supabase/migrations/create_tag_overrides.sql` - Override table migration
   - `supabase/migrations/create_provider_integrations_v2.sql` - Content tags table migration

## Testing

After deployment, test by:
1. Calling edge functions to fetch content
2. Checking `content_tags` table for computed tags
3. Adding manual overrides in `tag_overrides`
4. Verifying merged tags in `content_tags`


