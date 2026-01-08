# Content Providers Integration Layer

This module provides a frontend integration layer for fetching content from external providers (TMDB, Google Books) via Supabase Edge Functions.

## Overview

All external API calls are made server-side through Edge Functions. The client never directly calls external APIs or handles API keys.

## Usage

### Movies (TMDB)

```typescript
import { searchMovies, getTrendingMovies } from "../data/providers/contentProviders";

// Search for movies
const movies = await searchMovies("inception", 20);

// Get trending movies
const trending = await getTrendingMovies(20);
```

### Books (Google Books)

```typescript
import { searchBooks, getSuggestedBooks } from "../data/providers/contentProviders";

// Search for books
const books = await searchBooks("meditation", 20);

// Get suggested books by subject
const suggested = await getSuggestedBooks("self-help", 20);
```

### Error Handling

All functions gracefully handle disabled providers and errors:

- If provider is disabled: Returns empty array `[]`
- If API error occurs: Returns empty array `[]` and logs error to console
- Errors are logged but don't throw exceptions

### Converting to ContentItem Format

To use external content with existing UI components:

```typescript
import { externalToContentItem } from "../data/providers/contentProviders";

const movies = await getTrendingMovies(10);
const contentItems = movies.map(externalToContentItem);
// Now compatible with ContentItem type used throughout the app
```

## Functions

### `searchMovies(query, limit?)`
Searches TMDB for movies matching the query.

**Parameters:**
- `query: string` - Search query (e.g., "inception")
- `limit?: number` - Max results (default: 20, max: 40)

**Returns:** `Promise<ExternalContentItem[]>`

### `getTrendingMovies(limit?)`
Fetches trending/popular movies from TMDB.

**Parameters:**
- `limit?: number` - Max results (default: 20, max: 40)

**Returns:** `Promise<ExternalContentItem[]>`

### `searchBooks(query, limit?)`
Searches Google Books for books matching the query.

**Parameters:**
- `query: string` - Search query (e.g., "meditation")
- `limit?: number` - Max results (default: 20, max: 40)

**Returns:** `Promise<ExternalContentItem[]>`

### `getSuggestedBooks(subject, limit?)`
Fetches suggested books by subject from Google Books.

**Parameters:**
- `subject: string` - Subject category (e.g., "self-help", "meditation")
- `limit?: number` - Max results (default: 20, max: 40)

**Returns:** `Promise<ExternalContentItem[]>`

### `isProviderEnabled(provider)`
Checks if a provider is enabled in the database.

**Parameters:**
- `provider: "tmdb" | "google_books"` - Provider name

**Returns:** `Promise<boolean>`

### `externalToContentItem(item)`
Converts `ExternalContentItem` to a format compatible with `ContentItem` type.

**Parameters:**
- `item: ExternalContentItem` - External content item

**Returns:** Partial `ContentItem`-like object

## Integration Examples

### Quiz Results Page

The Quiz Results page automatically fetches external content when focus is "watch" or "read":

```typescript
// In QuizResult.tsx
if (focus === "watch") {
  const movies = await getTrendingMovies(6);
  externalItems = movies.map(externalToContentItem);
} else if (focus === "read") {
  const books = await getSuggestedBooks(subject, 6);
  externalItems = books.map(externalToContentItem);
}
```

### Explore Page

You can enhance the Explore page to include external content:

```typescript
// Fetch external movies/books based on user's mood/focus
const externalContent = await Promise.all([
  getTrendingMovies(5),
  getSuggestedBooks("self-help", 5),
]);
```

## Notes

- All functions return empty arrays on error/disabled providers (never throw)
- Results are automatically cached in `external_content_cache` table
- Edge Functions handle API keys securely (never exposed to client)
- Rate limiting should be handled at the application level


