# Provider Integration Edge Functions

## Overview

These Edge Functions fetch content from external providers (TMDB, Google Books) and cache it in the database. They are server-side only and should never be called directly from the client.

## Functions

### 1. `fetch-tmdb`

Fetches movies from The Movie Database (TMDB) API.

**Endpoint:** `POST /functions/v1/fetch-tmdb`

**Request Body:**
```json
{
  "query": "inception",  // Optional: search query
  "limit": 20            // Optional: max results (default: 20)
}
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "results": [
    {
      "provider": "tmdb",
      "provider_id": "27205",
      "type": "watch",
      "title": "Inception",
      "description": "A skilled thief is given a chance...",
      "image_url": "https://image.tmdb.org/t/p/w500/...",
      "url": "https://www.themoviedb.org/movie/27205",
      "raw": { /* full TMDB response */ }
    }
  ]
}
```

**Error Response (if disabled):**
```json
{
  "disabled": true,
  "message": "TMDB provider is disabled"
}
```

### 2. `fetch-google-books`

Fetches books from Google Books API.

**Endpoint:** `POST /functions/v1/fetch-google-books`

**Request Body:**
```json
{
  "query": "meditation",     // Optional: search query
  "subject": "self-help",    // Optional: subject filter
  "limit": 20                // Optional: max results (default: 20)
}
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "results": [
    {
      "provider": "google_books",
      "provider_id": "abc123",
      "type": "read",
      "title": "The Power of Now",
      "description": "A guide to spiritual enlightenment...",
      "image_url": "https://books.google.com/...",
      "url": "https://books.google.com/books?id=...",
      "raw": { /* full Google Books response */ }
    }
  ]
}
```

## Required Secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

### TMDB
- **`TMDB_API_KEY`** (required)
  - Get from: https://www.themoviedb.org/settings/api
  - Free tier available

### Google Books
- **`GOOGLE_BOOKS_API_KEY`** (optional)
  - Google Books API doesn't require a key for basic usage
  - Key provides higher rate limits
  - Get from: https://console.cloud.google.com/apis/credentials

## Deployment

### Using Supabase CLI:

```bash
# Deploy TMDB function
supabase functions deploy fetch-tmdb

# Deploy Google Books function
supabase functions deploy fetch-google-books

# Set secrets
supabase secrets set TMDB_API_KEY=your_tmdb_key_here
supabase secrets set GOOGLE_BOOKS_API_KEY=your_google_books_key_here  # Optional
```

### Using Supabase Dashboard:

1. Go to Project Settings → Edge Functions
2. Upload or create functions
3. Set secrets in the Secrets section

## Usage from Client

**DO NOT call these functions directly from the client.** Instead, create a backend API route or use Supabase RPC functions that call these Edge Functions server-side.

Example (server-side only):
```typescript
// ❌ DON'T DO THIS FROM CLIENT
const { data } = await supabase.functions.invoke("fetch-tmdb", {
  body: { query: "inception" }
});

// ✅ DO THIS INSTEAD: Create a server-side API route that calls the Edge Function
```

## Database Integration

Both functions:
1. Check `provider_settings` table to see if provider is enabled
2. Fetch data from external API
3. Normalize data into unified schema
4. Upsert into `external_content_cache` table
5. Return normalized results

The cache prevents duplicate API calls and allows fast lookups.

## Error Handling

- If provider is disabled: Returns `{ disabled: true }` (200 status)
- If API key missing: Returns error (500 status)
- If API call fails: Returns error with message (500 status)
- If cache upsert fails: Logs error but still returns results

## Rate Limiting

- TMDB: Free tier allows 40 requests per 10 seconds
- Google Books: 1000 requests per day (without key), higher with key

Consider implementing rate limiting in your application layer.


