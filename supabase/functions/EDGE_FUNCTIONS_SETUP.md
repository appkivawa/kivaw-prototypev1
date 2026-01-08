# Edge Functions Setup Guide

## Overview

These Edge Functions fetch content from external providers (TMDB, Google Books) and cache it in the database. All API keys are stored server-side as Supabase secrets.

## Functions

### 1. `fetch-tmdb`

Fetches movies from The Movie Database (TMDB) API.

**Endpoint:** `POST /functions/v1/fetch-tmdb`

**Request Body:**
```json
{
  "query": "inception",  // Optional: search query
  "mode": "comfort",     // Optional: not used in API call, included for future use
  "limit": 20            // Optional: max results (default: 20)
}
```

**Response (Success):**
```json
{
  "items": [
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

**Response (Disabled):**
```json
{
  "disabled": true,
  "items": []
}
```

**Response (Error):**
```json
{
  "error": "Error message"
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

**Response (Success):**
```json
{
  "items": [
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

**Response (Disabled):**
```json
{
  "disabled": true,
  "items": []
}
```

## Required Secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

### TMDB
- **`TMDB_API_KEY`** (required)
  - Get from: https://www.themoviedb.org/settings/api
  - Free tier available
  - Used for all TMDB API requests

### Google Books
- **`GOOGLE_BOOKS_API_KEY`** (optional)
  - Google Books API works without a key for basic usage
  - Key provides higher rate limits (1000 requests/day without key, higher with key)
  - Get from: https://console.cloud.google.com/apis/credentials
  - If provided, will be added to API requests

## How to Set Secrets

### Option 1: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Enter:
   - **Name:** `TMDB_API_KEY`
   - **Value:** Your TMDB API key
5. Click **Save**
6. Repeat for `GOOGLE_BOOKS_API_KEY` (optional)

### Option 2: Supabase CLI

```bash
# Set TMDB API key (required)
supabase secrets set TMDB_API_KEY=your_tmdb_key_here

# Set Google Books API key (optional)
supabase secrets set GOOGLE_BOOKS_API_KEY=your_google_books_key_here
```

### Option 3: Environment Variables (Local Development)

For local development with Supabase CLI:

```bash
# Create .env.local file in your project root
echo "TMDB_API_KEY=your_tmdb_key_here" >> .env.local
echo "GOOGLE_BOOKS_API_KEY=your_google_books_key_here" >> .env.local
```

## Deployment

### Deploy Functions

```bash
# Deploy TMDB function
supabase functions deploy fetch-tmdb

# Deploy Google Books function
supabase functions deploy fetch-google-books
```

### Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs fetch-tmdb
supabase functions logs fetch-google-books
```

## Behavior

### Provider Settings Check

Both functions check `provider_settings.enabled` before making API calls:
- If `enabled = false`: Returns `{ disabled: true, items: [] }`
- If `enabled = true`: Proceeds with API call

### Caching

Both functions automatically:
1. Fetch content from external API
2. Normalize into unified format
3. Upsert to `external_content_cache` (using unique `provider, provider_id`)
4. Compute and store tags in `content_tags` table
5. Return normalized items

### Error Handling

- API errors: Returns `{ error: "message" }` with 500 status
- Missing API key (TMDB): Returns `{ error: "TMDB_API_KEY not configured" }` with 500 status
- Cache errors: Logged but don't block response (returns items even if cache fails)

## Usage from Frontend

**DO NOT call these functions directly from the client.** Use the provider layer:

```typescript
import { getTrendingMovies, searchBooks } from "../data/providers/contentProviders";

// Get trending movies
const movies = await getTrendingMovies(20);

// Search books
const books = await searchBooks("meditation", 20);
```

The provider layer handles:
- Edge function invocation
- Error handling
- Disabled provider responses
- Type conversion

## Testing

### Test TMDB Function

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/fetch-tmdb \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"query": "inception", "limit": 5}'
```

### Test Google Books Function

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/fetch-google-books \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"subject": "self-help", "limit": 5}'
```

## Rate Limits

- **TMDB**: Free tier allows 40 requests per 10 seconds
- **Google Books**: 
  - Without key: 1000 requests per day
  - With key: Higher limits (varies by quota)

Consider implementing rate limiting in your application layer if needed.

## Security Notes

- ✅ API keys stored in Supabase secrets (never exposed to client)
- ✅ Service role key used for database writes (bypasses RLS)
- ✅ Client writes blocked by RLS policies
- ✅ CORS headers included for cross-origin requests
- ✅ Admin-only access to `provider_settings` table


