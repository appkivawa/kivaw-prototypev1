# explore_feed_v2 Edge Function

Unified Explore feed endpoint that queries `explore_items_v2` view to fetch content from all sources (feed_items, public_recommendations, external_content_cache).

## Usage

### POST Request

```typescript
POST /functions/v1/explore_feed_v2
Content-Type: application/json
Authorization: Bearer <token> (optional)

{
  "limit": 50,              // Optional: 1-200, default 50
  "cursor": "base64offset", // Optional: pagination cursor from previous response
  "kinds": ["rss", "watch"], // Optional: filter by content kinds
  "tags": ["tech", "ai"],    // Optional: filter by tags (any match)
  "sort": "featured"         // Optional: "featured" | "recent" | "score", default "featured"
}
```

### Response

```typescript
{
  "items": UnifiedContentItem[],
  "nextCursor": "base64offset",  // Present if hasMore = true
  "hasMore": boolean
}
```

## UnifiedContentItem Schema

```typescript
interface UnifiedContentItem {
  id: string;                    // 'feed_items:{uuid}' | 'recommendation:{uuid}' | 'cache:{uuid}'
  kind: string;                  // 'rss' | 'article' | 'video' | 'podcast' | 'watch' | 'read' | etc.
  title: string;
  byline: string | null;         // Author (only from feed_items)
  image_url: string | null;
  url: string | null;
  provider: string;              // 'rss' | 'youtube' | 'tmdb' | 'open_library' | etc.
  external_id: string | null;    // Provider's ID (nullable for recommendations)
  tags: string[];                // Merged tags from all sources
  created_at: string;            // ISO timestamp
  raw: Record<string, unknown> | null;  // Raw source data (JSONB)
  score: number | null;          // Relevance score (from feed_items.score or public_recommendations.rank)
}
```

## Sorting Strategies

- **"featured"** (default): public_recommendations first (by rank), then feed_items (by score), then cache (by recency)
- **"recent"**: Pure recency (created_at desc), score as tiebreaker
- **"score"**: Score first (score desc), recency as tiebreaker

## Pagination

Uses cursor-based pagination:

1. First request: Omit `cursor` (starts at offset 0)
2. Next request: Include `nextCursor` from previous response
3. Continue until `hasMore = false`

Example:
```typescript
// First page
const response1 = await fetch("/functions/v1/explore_feed_v2", {
  method: "POST",
  body: JSON.stringify({ limit: 50 })
});

// Second page
const response2 = await fetch("/functions/v1/explore_feed_v2", {
  method: "POST",
  body: JSON.stringify({ 
    limit: 50,
    cursor: response1.nextCursor 
  })
});
```

## Filtering

- **kinds**: Array of content kinds to include. Example: `["rss", "watch", "read"]`
- **tags**: Array of tags. Returns items that contain ANY of the provided tags. Example: `["tech", "ai"]` matches items with tag "tech" OR "ai"

## Examples

### Get featured items (default)
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

### Filter by kind
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -d '{"limit": 20, "kinds": ["watch", "read"]}'
```

### Sort by recency
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -d '{"limit": 20, "sort": "recent"}'
```

### Filter by tags
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -d '{"limit": 20, "tags": ["tech", "ai"]}'
```

### Pagination
```bash
# First page
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}' > page1.json

# Extract nextCursor from page1.json, then:
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -d '{"limit": 20, "cursor": "NDA="}'
```

## Verification Steps

1. **Deploy the function:**
   ```bash
   supabase functions deploy explore_feed_v2
   ```

2. **Test with GET (smoke test):**
   ```bash
   curl https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2
   ```
   Expected: `{"ok":true,"fn":"explore_feed_v2","version":"1.0.0"}`

3. **Test with POST (default query):**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
     -H "Content-Type: application/json" \
     -d '{"limit": 10}'
   ```
   Expected: JSON with `items` array, `hasMore` boolean, optionally `nextCursor`

4. **Verify items have correct structure:**
   - Check `id` starts with `feed_items:`, `recommendation:`, or `cache:`
   - Check `kind`, `provider`, `title` are populated
   - Check `tags` is an array

5. **Test pagination:**
   - Request with `limit: 10`
   - If `hasMore: true`, use `nextCursor` for next request
   - Verify no duplicates between pages

6. **Test filters:**
   - Request with `kinds: ["watch"]` - should only return items with `kind: "watch"`
   - Request with `tags: ["tech"]` - should only return items with "tech" in tags array

## Notes

- Requires `explore_items_v2` view to exist (created by migration `20250117025542_create_explore_items_v2_view.sql`)
- Respects RLS policies on underlying tables
- Works with or without authentication (anon users can read public_recommendations)
- Cursor is base64-encoded offset (not page number) for consistent pagination
- Maximum limit: 200 items per request (to prevent abuse)


