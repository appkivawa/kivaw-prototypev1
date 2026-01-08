# Tagging System Documentation

## Overview

The tagging system automatically assigns **Modes** and **Focus** tags to content fetched from external providers (TMDB, Google Books). Tags are stored in `content_tags` and can be manually overridden via `tag_overrides`.

## Tag Types

### Modes
- `reset` - Calm, peaceful, meditative content
- `beauty` - Aesthetic, visual, artistic content
- `logic` - Scientific, analytical, intellectual content
- `faith` - Spiritual, religious content
- `reflect` - Introspective, self-awareness content
- `comfort` - Cozy, warm, supportive content

### Focus
- `watch` - Movies, visual content (from type: "watch")
- `read` - Books, reading content (from type: "read")
- `music` - Audio content (from type: "listen")
- `move` - Events, activities (from type: "event")

## Tagging Rules

### 1. Focus Inference (Simple Rule)
- **Type `watch`** → Focus: `watch`
- **Type `read`** → Focus: `read`
- **Type `listen`** → Focus: `music`
- **Type `event`** → Focus: `move`

### 2. Mode Inference (Keyword Matching)
Modes are inferred by searching for keywords in:
- Title
- Description
- Genres (for movies)
- Categories (for books)

**Keyword Rules:**
- Each mode has a list of keywords (see `MODE_KEYWORDS` in `tagging.ts`)
- If any keyword appears in the searchable text, the mode is assigned
- Multiple modes can be assigned to a single item
- If no modes match, defaults to `comfort`

### 3. Override Tags
- Stored in `tag_overrides` table
- Merged with auto-tags (additive, not replacement)
- Admin-only access

## Editing Keyword Rules

To modify keyword rules, edit `supabase/functions/_shared/tagging.ts`:

```typescript
export const MODE_KEYWORDS: Record<Mode, string[]> = {
  reset: ["reset", "calm", "peace", ...], // Add/remove keywords here
  beauty: ["beauty", "aesthetic", "art", ...],
  // ... etc
};
```

After editing, redeploy the edge functions:
```bash
supabase functions deploy fetch-tmdb
supabase functions deploy fetch-google-books
```

## Database Schema

### `content_tags`
Stores computed tags (auto + overrides merged):
```sql
cache_id UUID REFERENCES external_content_cache(id)
mode TEXT -- reset, beauty, logic, faith, reflect, comfort
focus TEXT -- watch, read, music, move, etc.
PRIMARY KEY (cache_id, mode, focus)
```

### `tag_overrides`
Stores manual tag overrides:
```sql
provider TEXT -- "tmdb" or "google_books"
provider_id TEXT -- Provider's internal ID
mode TEXT -- Mode to add
focus TEXT -- Focus to add
PRIMARY KEY (provider, provider_id, mode, focus)
```

## Tag Computation Flow

1. **Fetch content** from external API (TMDB/Google Books)
2. **Normalize** content to standard format
3. **Upsert** to `external_content_cache` (get cache_id)
4. **Compute auto-tags:**
   - Infer focus from type
   - Infer modes from keywords in title/description/genres/categories
5. **Fetch overrides** from `tag_overrides` table
6. **Merge** auto-tags with overrides (union, not replacement)
7. **Store** final tags in `content_tags` table

## Example: Tagging a Movie

**Input:**
- Type: `watch`
- Title: "The Art of Meditation"
- Description: "A peaceful journey into mindfulness and inner peace"
- Genres: ["Documentary", "Spiritual"]

**Auto-tags computed:**
- Focus: `watch` (from type)
- Modes: `reset` (matches "meditation", "peaceful", "mindfulness", "peace"), `reflect` (matches "inner")

**If override exists:**
- Override: `{ modes: ["beauty"], focus: ["watch"] }`
- Final tags: `{ modes: ["reset", "reflect", "beauty"], focus: ["watch"] }`

## Example: Tagging a Book

**Input:**
- Type: `read`
- Title: "The Science of Logic"
- Description: "An academic exploration of rational thinking"
- Categories: ["Science", "Philosophy"]

**Auto-tags computed:**
- Focus: `read` (from type)
- Modes: `logic` (matches "science", "logic", "academic", "rational", "thinking")

## Manual Override Example

To add a manual override:

```sql
INSERT INTO public.tag_overrides (provider, provider_id, mode, focus)
VALUES ('tmdb', '12345', 'beauty', 'watch');
```

This will add `beauty` mode to the movie, merged with existing auto-tags.

## Querying Tags

To get all tags for a cached item:

```sql
SELECT c.*, t.mode, t.focus
FROM external_content_cache c
LEFT JOIN content_tags t ON t.cache_id = c.id
WHERE c.provider = 'tmdb' AND c.provider_id = '12345';
```

To get all content with a specific tag:

```sql
SELECT c.*
FROM external_content_cache c
JOIN content_tags t ON t.cache_id = c.id
WHERE t.mode = 'comfort' AND t.focus = 'watch';
```

## Files

- **`supabase/functions/_shared/tagging.ts`** - Shared tagging logic (keyword rules, computation)
- **`supabase/functions/fetch-tmdb/index.ts`** - TMDB edge function (uses tagging module)
- **`supabase/functions/fetch-google-books/index.ts`** - Google Books edge function (uses tagging module)
- **`supabase/migrations/create_tag_overrides.sql`** - SQL migration for override table


