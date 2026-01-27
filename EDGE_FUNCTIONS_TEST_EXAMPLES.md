# Edge Functions Test Examples

Quick reference for testing Edge Functions locally and in production.

---

## CLI Examples

### explore_feed_v2

**GET (smoke test)**:
```bash
curl -X GET https://your-project.supabase.co/functions/v1/explore_feed_v2 \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**POST (anonymous)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"limit": 20}'
```

**POST (with filters)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{
    "limit": 20,
    "kinds": ["watch", "read"],
    "providers": ["tmdb", "openlibrary"]
  }'
```

**POST (authenticated)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"limit": 20}'
```

---

### social_feed

**GET (smoke test)**:
```bash
curl -X GET https://your-project.supabase.co/functions/v1/social_feed \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**POST (anonymous)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/social_feed \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"limit": 60}'
```

**POST (with filters)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/social_feed \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{
    "limit": 60,
    "types": ["rss", "youtube"],
    "query": "tech",
    "days": 7
  }'
```

**POST (authenticated)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/social_feed \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"limit": 60}'
```

---

### ingest_rss

**GET (smoke test)**:
```bash
curl -X GET https://your-project.supabase.co/functions/v1/ingest_rss \
  -H "apikey: $SUPABASE_SERVICE_KEY"
```

**POST (with secret)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ingest_rss \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -d '{
    "maxFeeds": 10,
    "perFeedLimit": 50
  }'
```

---

### cron_runner

**GET (smoke test)**:
```bash
curl -X GET https://your-project.supabase.co/functions/v1/cron_runner \
  -H "apikey: $SUPABASE_SERVICE_KEY"
```

**POST (hourly job)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"job": "hourly"}'
```

**POST (six_hour job)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"job": "six_hour"}'
```

**POST (daily job)**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"job": "daily"}'
```

---

## Success Criteria

### explore_feed_v2

**Success looks like**:
```json
{
  "items": [
    {
      "id": "...",
      "kind": "watch",
      "title": "...",
      "byline": "...",
      "image_url": "...",
      "summary": "...",
      "url": "...",
      "provider": "tmdb",
      "tags": [...],
      "created_at": "...",
      "score": 5.2
    }
  ],
  "nextCursor": "base64string",
  "hasMore": true
}
```

**HTTP Status**: `200`

**Logs should show**:
- `"Request received"` with correlation ID
- `"Query successful"` with pool size
- `"Request completed"` with item count and duration

---

### social_feed

**Success looks like**:
```json
{
  "feed": [
    {
      "id": "...",
      "source": "rss",
      "title": "...",
      "summary": "...",
      "url": "...",
      "published_at": "...",
      "score": 2.5
    }
  ],
  "fresh": [...],
  "today": [...],
  "debug": {
    "authed": false,
    "candidates": 150,
    "returned": 60,
    "freshCount": 12,
    "todayCount": 45
  }
}
```

**HTTP Status**: `200` (even if feed is empty)

**Logs should show**:
- `"Request received"` with correlation ID and user ID
- `"Request completed"` with counts and duration

**Edge Cases**:
- Missing `feed_items` table → Returns empty feed with helpful error (HTTP 200)
- Empty `feed_items` table → Returns empty feed arrays (HTTP 200)
- Auth missing → Works as anonymous user (HTTP 200)

---

### ingest_rss

**Success looks like**:
```json
{
  "ingested": 42,
  "feeds": [
    {
      "url": "https://example.com/feed.xml",
      "fetched": 50,
      "fresh": 45,
      "upserted": 45,
      "newestPublishedAt": "2025-01-27T12:00:00Z",
      "oldestPublishedAt": "2025-01-20T12:00:00Z"
    }
  ],
  "newestPublishedAt": "2025-01-27T12:00:00Z",
  "oldestPublishedAt": "2025-01-20T12:00:00Z",
  "counts": {
    "fetched": 500,
    "fresh": 450,
    "upserted": 450
  }
}
```

**HTTP Status**: `200`

---

### cron_runner

**Success looks like**:
```json
{
  "ok": true,
  "job": "hourly",
  "results": {
    "rss": {
      "ok": true,
      "status": 200,
      "data": {
        "ingested": 42,
        "feeds": [...]
      }
    }
  },
  "ranAt": "2025-01-27T12:00:00Z"
}
```

**HTTP Status**: `200` (even if some jobs failed)

---

## Error Examples

### Missing Table (social_feed)

**Response**:
```json
{
  "feed": [],
  "fresh": [],
  "today": [],
  "error": "feed_items table does not exist. Please run the migration: supabase/migrations/create_feed_items.sql",
  "message": "relation \"public.feed_items\" does not exist",
  "debug": {
    "authed": false,
    "candidates": 0,
    "returned": 0,
    "error": "relation \"public.feed_items\" does not exist",
    "code": "42P01"
  }
}
```

**HTTP Status**: `200` (graceful degradation)

---

### Missing Secret (ingest_rss)

**Response**:
```json
{
  "error": "Forbidden: Missing or invalid x-ingest-secret"
}
```

**HTTP Status**: `403`

---

### Invalid Job (cron_runner)

**Response**:
```json
{
  "error": "Invalid job. Must be: hourly, six_hour, or daily"
}
```

**HTTP Status**: `400`

---

## Quick Test Script

Run the smoke test script:

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_KEY="your-service-key"
export CRON_SECRET="your-cron-secret"

# Run tests
./test_edge_functions.sh
```

**Expected Output**:
```
🧪 Testing Edge Functions...

Testing explore_feed_v2 (GET)... ✓ (HTTP 200)
Testing explore_feed_v2 (POST anonymous)... ✓ (HTTP 200)
Testing social_feed (GET)... ✓ (HTTP 200)
Testing social_feed (POST anonymous)... ✓ (HTTP 200)
Testing cron_runner (GET)... ✓ (HTTP 200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Results: 5 passed, 0 failed

✅ All tests passed!
```

---

**Last Updated**: 2025-01-27
