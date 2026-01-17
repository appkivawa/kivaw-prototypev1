# explore_feed_v2 Edge Function - Examples

## Example Payloads

### 1. Basic Request (Default)
```json
POST /functions/v1/explore_feed_v2
Content-Type: application/json

{
  "limit": 50
}
```

**Response:**
```json
{
  "items": [
    {
      "id": "recommendation:550e8400-e29b-41d4-a716-446655440000",
      "kind": "watch",
      "title": "The Shawshank Redemption",
      "byline": null,
      "image_url": "https://image.tmdb.org/t/p/w500/...",
      "url": "https://www.themoviedb.org/movie/278",
      "provider": "tmdb",
      "external_id": null,
      "tags": ["comfort", "reflect", "watch"],
      "created_at": "2025-01-17T10:00:00Z",
      "raw": null,
      "score": 10
    },
    {
      "id": "feed_items:550e8400-e29b-41d4-a716-446655440001",
      "kind": "rss",
      "title": "Tech News: AI Breakthrough",
      "byline": "John Doe",
      "image_url": null,
      "url": "https://example.com/article/123",
      "provider": "rss",
      "external_id": "article-123",
      "tags": ["tech", "ai", "news"],
      "created_at": "2025-01-17T09:00:00Z",
      "raw": { "source": "techcrunch", "category": "ai" },
      "score": 8.5
    }
  ],
  "nextCursor": "NTA=",
  "hasMore": true
}
```

### 2. Filter by Kind
```json
POST /functions/v1/explore_feed_v2
Content-Type: application/json

{
  "limit": 20,
  "kinds": ["watch", "read"]
}
```

### 3. Filter by Tags
```json
POST /functions/v1/explore_feed_v2
Content-Type: application/json

{
  "limit": 20,
  "tags": ["tech", "ai"]
}
```

### 4. Sort by Recency
```json
POST /functions/v1/explore_feed_v2
Content-Type: application/json

{
  "limit": 20,
  "sort": "recent"
}
```

### 5. Pagination (Second Page)
```json
POST /functions/v1/explore_feed_v2
Content-Type: application/json

{
  "limit": 20,
  "cursor": "MjA="
}
```

### 6. Combined Filters
```json
POST /functions/v1/explore_feed_v2
Content-Type: application/json

{
  "limit": 30,
  "kinds": ["watch", "read"],
  "tags": ["comfort", "reflect"],
  "sort": "score"
}
```

## Verification Steps

### 1. Deploy Function
```bash
cd /Users/mauvekiara/kivaw-web
supabase functions deploy explore_feed_v2
```

### 2. Test with GET (Smoke Test)
```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2
```

**Expected Response:**
```json
{"ok":true,"fn":"explore_feed_v2","version":"1.0.0"}
```

### 3. Test with POST (Basic Query)
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 10}'
```

**Expected Response:**
- `items` array with 10 or fewer items
- Each item has: `id`, `kind`, `title`, `provider`, `tags`, etc.
- `hasMore` boolean
- `nextCursor` present if `hasMore: true`

### 4. Test Pagination
```bash
# First page
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 5}' > page1.json

# Extract nextCursor from page1.json (e.g., "NTA=")
# Second page
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 5, "cursor": "NTA="}' > page2.json

# Verify no duplicates between page1.json and page2.json
```

### 5. Test Filters

**Filter by kind:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 10, "kinds": ["watch"]}'
```

**Expected:** All items have `kind: "watch"`

**Filter by tags:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 10, "tags": ["tech"]}'
```

**Expected:** All items have "tech" in `tags` array

### 6. Test Sorting

**Sort by recency:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 10, "sort": "recent"}'
```

**Expected:** Items ordered by `created_at` DESC (newest first)

**Sort by score:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 10, "sort": "score"}'
```

**Expected:** Items ordered by `score` DESC (highest first)

### 7. Verify Item Sources

Check that items come from different sources:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 30}' | jq '.items[] | {id, kind, provider}'
```

**Expected:** Mix of `id` prefixes:
- `feed_items:` - from feed_items table
- `recommendation:` - from public_recommendations table
- `cache:` - from external_content_cache table

## Invoke from TypeScript

```typescript
import { supabase } from "../lib/supabaseClient";

interface ExploreFeedV2Request {
  limit?: number;
  cursor?: string;
  kinds?: string[];
  tags?: string[];
  sort?: "featured" | "recent" | "score";
}

interface UnifiedContentItem {
  id: string;
  kind: string;
  title: string;
  byline: string | null;
  image_url: string | null;
  url: string | null;
  provider: string;
  external_id: string | null;
  tags: string[];
  created_at: string;
  raw: Record<string, unknown> | null;
  score: number | null;
}

interface ExploreFeedV2Response {
  items: UnifiedContentItem[];
  nextCursor?: string;
  hasMore: boolean;
}

async function fetchExploreFeedV2(
  params: ExploreFeedV2Request
): Promise<ExploreFeedV2Response> {
  const { data, error } = await supabase.functions.invoke("explore_feed_v2", {
    body: params,
  });

  if (error) {
    throw new Error(`explore_feed_v2 failed: ${error.message}`);
  }

  return data as ExploreFeedV2Response;
}

// Example usage
const response = await fetchExploreFeedV2({
  limit: 20,
  kinds: ["watch", "read"],
  tags: ["tech"],
  sort: "featured",
});

console.log(`Got ${response.items.length} items`);
console.log(`Has more: ${response.hasMore}`);
if (response.nextCursor) {
  console.log(`Next cursor: ${response.nextCursor}`);
}
```

## Common Issues

### Issue: Empty items array
**Possible causes:**
- `explore_items_v2` view is empty (no data in source tables)
- Filters too restrictive (no items match)
- RLS policies blocking access

**Fix:**
- Check source tables have data: `SELECT COUNT(*) FROM feed_items;`
- Try without filters: `{"limit": 10}`
- Check RLS policies on `explore_items_v2` view

### Issue: nextCursor always null
**Possible causes:**
- Fewer items than limit (no next page)
- `count` query not working

**Fix:**
- Increase limit to test pagination: `{"limit": 1}` should have `nextCursor` if >1 item exists
- Check Supabase logs for errors

### Issue: Filters not working
**Possible causes:**
- Invalid filter values
- PostgREST query syntax issue

**Fix:**
- Verify `kinds` values match actual `kind` values in view
- Verify `tags` values exist in `tags` arrays
- Check Supabase logs for query errors

