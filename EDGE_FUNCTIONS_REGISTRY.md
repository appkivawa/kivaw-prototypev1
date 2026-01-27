# Edge Functions Registry

Complete documentation of all Edge Functions used by the frontend.

---

## Functions Table

| Function Name | Path | Auth Mode | DB Tables Used | Expected Response | Error Shape |
|--------------|------|-----------|----------------|------------------|-------------|
| `explore_feed_v2` | `/functions/v1/explore_feed_v2` | Optional (anon OK) | `explore_items_v2` (view) | `{ items, nextCursor, hasMore }` | `{ error, detail }` |
| `social_feed` | `/functions/v1/social_feed` | Optional (anon OK) | `feed_items`, `user_preferences`, `sources`, `user_item_actions`, `rss_sources` | `{ feed, fresh, today, debug }` | `{ error, message, debug }` |
| `ingest_rss` | `/functions/v1/ingest_rss` | Service Role + `x-ingest-secret` OR `x-cron-secret` | `feed_items`, `rss_sources` | `{ ingested, feeds, newestPublishedAt, oldestPublishedAt, counts }` | `{ error }` |
| `cron_runner` | `/functions/v1/cron_runner` | Service Role + `x-cron-secret` | `system_health` (writes) | `{ ok, job, results, ranAt }` | `{ error }` |
| `fetch-tmdb` | `/functions/v1/fetch-tmdb` | Service Role + `x-cron-secret` | `external_content_cache` | `{ cached, fetched }` | `{ error }` |
| `fetch-open-library` | `/functions/v1/fetch-open-library` | Service Role + `x-cron-secret` | `external_content_cache` | `{ cached, fetched }` | `{ error }` |
| `fetch-google-books` | `/functions/v1/fetch-google-books` | Service Role + `x-cron-secret` | `external_content_cache` | `{ cached, fetched }` | `{ error }` |
| `sync-external-content` | `/functions/v1/sync-external-content` | Service Role + `x-cron-secret` | `external_content_cache` | `{ cached, fetched }` | `{ error }` |

---

## Function Details

### 1. `explore_feed_v2`

**Purpose**: Fetch mixed content for Explore page (RSS, books, movies/TV).

**Auth**: Optional (works for anonymous users)

**Input Schema**:
```typescript
{
  limit?: number;        // 1-50, default 20
  cursor?: string;        // base64 encoded offset
  kinds?: string[];       // e.g., ["watch", "read", "rss"]
  providers?: string[];   // e.g., ["tmdb", "openlibrary"]
  includeRecommendations?: boolean; // default false
}
```

**Output Schema**:
```typescript
{
  items: UnifiedContentItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UnifiedContentItem {
  id: string;
  kind: string;
  title: string;
  byline: string | null;
  image_url: string | null;
  summary: string | null;
  url: string | null;
  provider: string;
  external_id: string | null;
  tags: string[];
  created_at: string;
  raw: Record<string, unknown> | null;
  score: number | null;
}
```

**Error Shape**:
```typescript
{
  error: string;          // e.g., "Failed to fetch explore items"
  detail?: string;        // Detailed error message
}
```

**Status Codes**:
- `200`: Success
- `500`: Server error (missing env vars, DB error)

**Frontend Usage**:
- `src/pages/StudioExplore.tsx` (line 153)
- `src/pages/ExplorePage.tsx` (line 76)

---

### 2. `social_feed`

**Purpose**: Fetch personalized social feed (RSS, YouTube, Reddit, etc.).

**Auth**: Optional (works for anonymous users, personalizes if logged in)

**Input Schema**:
```typescript
{
  limit?: number;    // 10-120, default 60
  types?: Source[];  // e.g., ["rss", "youtube"]
  query?: string;    // Search query
  days?: number;     // 1-365, default 21
}
```

**Output Schema**:
```typescript
{
  feed: FeedItem[];      // Main feed (scored, sorted)
  fresh: FeedItem[];    // Items from last 6 hours
  today: FeedItem[];    // Items from last 24 hours
  debug?: {
    authed: boolean;
    days: number;
    sinceIso: string;
    limit: number;
    types: Source[];
    query: boolean;
    candidates: number;
    returned: number;
    freshCount: number;
    todayCount: number;
  };
}

interface FeedItem {
  id: string;
  source: "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";
  external_id: string;
  url: string;
  title: string;
  summary?: string | null;
  author?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  topics?: string[] | null;
  metadata?: Record<string, unknown>;
  score?: number;
}
```

**Error Shape**:
```typescript
{
  feed: [];              // Always empty array on error
  fresh: [];
  today: [];
  error: string;         // Error message
  message?: string;      // Detailed message
  code?: string;         // Error code (e.g., "42P01" for missing table)
  debug: {
    authed: boolean;
    candidates: 0;
    returned: 0;
    error: string;
    code?: string;
  };
}
```

**Status Codes**:
- `200`: Success (even if empty feed)
- `500`: Server error (missing env vars, unhandled exception)

**Edge Cases Handled**:
- ✅ Missing `feed_items` table → Returns empty feed with helpful error message
- ✅ Empty `feed_items` table → Returns empty feed arrays
- ✅ Auth missing → Works as anonymous user
- ✅ Missing user preferences → Uses defaults
- ✅ Missing `rss_sources` table → Continues without RSS weights

**Frontend Usage**:
- `src/pages/StudioFeed.tsx` (line 186)
- `src/pages/Timeline.tsx` (line 94)
- `src/pages/FeedPage.tsx` (line 108)

---

### 3. `ingest_rss`

**Purpose**: Ingest RSS feeds into `feed_items` table.

**Auth**: Service Role + `x-ingest-secret` OR `x-cron-secret`

**Input Schema**:
```typescript
{
  maxFeeds?: number;      // Default 25
  perFeedLimit?: number;  // Default 75
  user_id?: string;       // Optional (for tracking)
}
```

**Output Schema**:
```typescript
{
  ingested: number;       // Total items ingested
  feeds: Array<{
    url: string;
    fetched: number;
    fresh: number;
    upserted: number;
    newestPublishedAt: string | null;
    oldestPublishedAt: string | null;
  }>;
  newestPublishedAt: string | null;
  oldestPublishedAt: string | null;
  counts: {
    fetched: number;
    fresh: number;
    upserted: number;
  };
}
```

**Error Shape**:
```typescript
{
  error: string;
}
```

**Status Codes**:
- `200`: Success
- `403`: Forbidden (missing/invalid secret)
- `500`: Server error

**Frontend Usage**:
- `src/pages/DevRSSIngest.tsx` (line 60)
- `src/admin/components/RSSIngestTrigger.tsx` (line 42)

---

### 4. `cron_runner`

**Purpose**: Orchestrate scheduled jobs (hourly, six_hour, daily).

**Auth**: Service Role + `x-cron-secret`

**Input Schema**:
```typescript
{
  job: "hourly" | "six_hour" | "daily";
}
```

**Output Schema**:
```typescript
{
  ok: boolean;
  job: string;
  results: {
    rss?: { ok: boolean; status: number; data: unknown; error?: string };
    tmdb?: { ok: boolean; status: number; data: unknown; error?: string };
    openLibrary?: { ok: boolean; status: number; data: unknown; error?: string };
    googleBooks?: { ok: boolean; status: number; data: unknown; error?: string };
    prune?: { pruned: number };
  };
  ranAt: string;  // ISO timestamp
}
```

**Error Shape**:
```typescript
{
  ok: false;
  error: string;
}
```

**Status Codes**:
- `200`: Success (even if some jobs failed)
- `400`: Invalid job type
- `403`: Forbidden (missing/invalid secret)
- `500`: Server error

**Frontend Usage**:
- `src/pages/StudioExplore.tsx` (line 397) - Dev only

---

## Authentication Modes

### Optional (Anon OK)
- `explore_feed_v2`
- `social_feed`

**How it works**:
- Accepts `Authorization` header if present
- Uses `SUPABASE_ANON_KEY` with user JWT (if provided)
- Respects RLS policies
- Works for anonymous users

### Service Role Required
- `ingest_rss`
- `cron_runner`
- `fetch-tmdb`
- `fetch-open-library`
- `fetch-google-books`
- `sync-external-content`

**How it works**:
- Requires `SUPABASE_SERVICE_ROLE_KEY` (auto-provided by Supabase)
- Bypasses RLS policies
- Also requires `x-ingest-secret` or `x-cron-secret` header (if env var set)

---

## Error Handling Patterns

### Standard Error Response
```typescript
{
  error: string;           // User-friendly error message
  detail?: string;         // Technical details (optional)
  message?: string;        // Alternative error message
  code?: string;           // Error code (e.g., PostgreSQL error code)
  debug?: Record<string, unknown>;  // Debug info (dev only)
}
```

### Status Code Guidelines
- `200`: Success (even if empty results)
- `400`: Bad request (invalid input)
- `403`: Forbidden (auth/secret required)
- `404`: Not found (function not deployed)
- `500`: Server error (unhandled exception, missing env vars)

---

## Frontend Invocation Pattern

```typescript
const { data, error } = await supabase.functions.invoke<ResponseType>("function_name", {
  body: {
    // Request payload
  },
});

if (error) {
  // Handle error
  console.error("Function error:", error.message);
  // Check error.status for HTTP status code
}

if (data?.error) {
  // Handle function-level error
  console.error("Function returned error:", data.error);
}
```

---

**Last Updated**: 2025-01-27
