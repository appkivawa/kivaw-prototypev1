# Open Library Migration Guide

## Summary

This migration replaces Google Books with Open Library as the "read" provider for Kivaw. Google Books content is hidden from the UI but remains in the database for future use in the Educator platform.

## Changes Made

### 1. Frontend (src/pages/Explore.tsx)
- ✅ Added `.neq("provider", "google_books")` to all `external_content_cache` queries
- ✅ Updated provider labels to show "Book" for `open_library` instead of `google_books`
- ✅ Removed provider names from UI (users see "Book" or "Movie", not provider names)
- ✅ Added DEV-only seeding buttons for Open Library

### 2. Edge Function (supabase/functions/fetch-open-library/index.ts)
- ✅ Created new edge function for Open Library API integration
- ✅ Maps Open Library docs to normalized `external_content_cache` format
- ✅ Upserts to cache with conflict on `(provider, provider_id)`
- ✅ Updates `fetched_at` on upsert
- ✅ Includes CORS headers with all required Supabase headers
- ✅ Integrates with tagging system

### 3. Database
- ✅ No SQL migrations required
- ✅ Existing `external_content_cache` table structure supports Open Library
- ✅ Unique constraint on `(provider, provider_id)` is sufficient
- ✅ Existing indexes are sufficient

## Deployment Steps

### 1. Deploy Edge Function

```bash
# From project root
supabase functions deploy fetch-open-library
```

### 2. Enable Provider in Database

You need to add an entry to `provider_settings` to enable Open Library:

```sql
INSERT INTO public.provider_settings (provider, enabled)
VALUES ('open_library', true)
ON CONFLICT (provider) 
DO UPDATE SET enabled = true;
```

Or via Supabase Dashboard:
1. Go to Table Editor → `provider_settings`
2. Insert row: `provider = 'open_library'`, `enabled = true`

### 3. Seed Initial Data (DEV)

1. Open Explore page in development mode
2. Scroll to "DEV TOOLS — OPEN LIBRARY SEEDING" card
3. Click one of the seed buttons:
   - "Seed Open Library (Comfort)"
   - "Seed Open Library (Popular Fiction)"
   - "Seed Open Library (Self Help)"
4. Results will appear in Explore under "Read" or "All" focus

### 4. Verify

1. Navigate to Explore page
2. Select "Read" or "All" focus
3. Verify books appear in curated section and main results
4. Verify no Google Books content appears (even if cached)

## Edge Function Details

### Input
```typescript
{
  query?: string;  // Search query (defaults to "popular")
  limit?: number;  // Max results (defaults to 20, max 100)
}
```

### Output
```typescript
{
  items: Array<{
    provider: "open_library";
    provider_id: string;
    type: "read";
    title: string;
    description: string | null;
    image_url: string | null;
    url: string | null;
    raw: Record<string, unknown>;
  }>;
}
```

### API Mapping

- **provider_id**: `doc.key` (e.g., "/works/OL123W") or `doc.edition_key[0]` if key missing
- **title**: `doc.title`
- **description**: `doc.first_sentence` (array joined or string)
- **image_url**: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` if `doc.cover_i` exists
- **url**: `https://openlibrary.org${doc.key}` if `doc.key` exists
- **raw**: Full `doc` object

## CORS Headers

The edge function includes all required CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Allow-Methods: POST, OPTIONS`

## Notes

- Google Books rows remain in `external_content_cache` but are filtered out in all queries
- Provider names are hidden from users (UI shows "Book" or "Movie")
- Open Library API is free and doesn't require an API key
- Rate limits: Open Library allows reasonable usage without authentication









