# External Providers Layer

## Overview

The `externalProviders.ts` module provides a simple interface for fetching content from external providers (TMDB, Google Books) via Supabase Edge Functions.

## Functions

### `fetchMovies(options?)`

Fetches movies from TMDB.

**Parameters:**
- `options.query` (optional): Search query (e.g., "inception")
- `options.limit` (optional): Maximum results (default: 20, max: 40)

**Returns:** `Promise<ExternalContentItem[]>`

**Example:**
```typescript
import { fetchMovies } from "./data/providers/externalProviders";

// Get trending movies
const movies = await fetchMovies({ limit: 20 });

// Search movies
const results = await fetchMovies({ query: "inception", limit: 10 });
```

### `fetchBooks(options?)`

Fetches books from Google Books.

**Parameters:**
- `options.query` (optional): Search query (e.g., "meditation")
- `options.subject` (optional): Subject filter (e.g., "self-help")
- `options.limit` (optional): Maximum results (default: 20, max: 40)

**Returns:** `Promise<ExternalContentItem[]>`

**Example:**
```typescript
import { fetchBooks } from "./data/providers/externalProviders";

// Get books by subject
const books = await fetchBooks({ subject: "self-help", limit: 20 });

// Search books
const results = await fetchBooks({ query: "meditation", limit: 10 });
```

## Error Handling

Both functions handle errors gracefully:
- **Disabled provider**: Returns empty array `[]` (logs warning)
- **API error**: Returns empty array `[]` (logs error)
- **Network error**: Returns empty array `[]` (logs error)

Functions never throw exceptions - they always return an array (empty on error).

## Integration

### Updated Files

1. **`src/pages/quiz/QuizResult.tsx`**
   - Now uses `fetchMovies()` and `fetchBooks()` from `externalProviders.ts`
   - Replaces previous `getTrendingMovies()` and `getSuggestedBooks()` calls

2. **`src/data/externalRecommendations.ts`**
   - Added optional `fetchFresh` parameter to `getExternalRecommendations()`
   - Can fetch fresh content before querying cache

### Usage in Recommendations

The recommendation system can optionally fetch fresh content:

```typescript
import { getExternalRecommendations } from "./data/externalRecommendations";

// Query cache only (default)
const recs = await getExternalRecommendations(context, 12);

// Fetch fresh content first, then query cache
const recs = await getExternalRecommendations(context, 12, true);
```

## Response Format

Both functions return `ExternalContentItem[]`:

```typescript
type ExternalContentItem = {
  provider: string;           // "tmdb" or "google_books"
  provider_id: string;        // Provider's internal ID
  type: "watch" | "read";     // Content type
  title: string;              // Content title
  description: string | null; // Content description
  image_url: string | null;   // Image URL
  url: string | null;         // Content URL
  raw: Record<string, unknown>; // Full API response
};
```

## Conversion to ContentItem

Use `externalToContentItem()` from `contentProviders.ts` to convert for UI:

```typescript
import { externalToContentItem } from "./data/providers/contentProviders";
import { fetchMovies } from "./data/providers/externalProviders";

const movies = await fetchMovies({ limit: 10 });
const contentItems = movies.map(externalToContentItem);
```

## Notes

- All API calls go through Edge Functions (never direct from client)
- Content is automatically cached in `external_content_cache`
- Tags are automatically computed and stored in `content_tags`
- Disabled providers return empty arrays (no errors thrown)
- Rate limits are handled by Edge Functions


