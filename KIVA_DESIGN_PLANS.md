# KIVAW Architecture Design Plans
**Date:** 2025-01-28  
**Mode:** DESIGN ONLY (NO CODE CHANGES)  
**Based on:** KIVA_AUDIT_REPORT.md

---

## TABLE OF CONTENTS

1. [Unified Content Spine Design](#1-unified-content-spine-design)
2. [StudioExplore ALL CONTENT Support](#2-studioexplore-all-content-support)
3. [StudioFeed Habit-Forming Design](#3-studiofeed-habit-forming-design)
4. [Cron System Decision & Fix Plan](#4-cron-system-decision--fix-plan)
5. [Creator Content Publishing Design](#5-creator-content-publishing-design)
6. [ExploreFeed.tsx Duplication Elimination](#6-explorefeedtsx-duplication-elimination)
7. [Performance Hardening Plan](#7-performance-hardening-plan)
8. [Styling Consolidation Plan](#8-styling-consolidation-plan)

---

# 1. UNIFIED CONTENT SPINE DESIGN

## Summary of Findings

**Current State:**
- RSS → `feed_items` table → Feed UI (via `social_feed` Edge Function)
- External APIs → `external_content_cache` → Admin publish → `public_recommendations` → Explore UI
- Creator content → **NOWHERE** (no table or ingestion path)
- Explore uses `explore_items_v1` view (only `feed_items`)
- Multiple entry points with different schemas

**Problem:**
- No single source of truth for "ALL CONTENT"
- Client-side must query multiple tables and merge
- Inconsistent ordering/filtering across sources
- Creator content has no path to discovery

**Goal:**
Create ONE unified backend output that includes:
- `feed_items` (rss/news, social, video, podcast, music)
- `external_content_cache` → `public_recommendations` (watch: movies/tv/kdrama, read: books)
- Future `creator_posts` (creator content)
- Future events, music, etc.

---

## Recommendation: OPTION B - Edge Function (`explore_feed_v2`)

**Why Edge Function over View:**

1. **Complexity:** Views can't UNION with different schemas easily (feed_items has `content_kind`, external_content_cache has `type`, creator_posts will have `post_type`)
2. **Scoring:** Personalization requires user context (views can't access RLS user context dynamically)
3. **Deduplication:** Need fuzzy matching across sources (views are SQL-only)
4. **Future-proof:** Edge Functions can integrate external APIs, AI scoring, etc.
5. **Performance:** Can cache, paginate, and optimize per request

**View Alternative (OPTION A):**
- Would require all sources to conform to same schema (major migration)
- Cannot do dynamic filtering based on user auth
- Cannot deduplicate across providers

---

## UnifiedContentItem Schema

```typescript
interface UnifiedContentItem {
  // Identity (required)
  id: string;                    // Global ID: "feed_items:{uuid}" | "ext:{uuid}" | "creator:{uuid}"
  source_table: "feed_items" | "external_content_cache" | "creator_posts" | "public_recommendations";
  source_id: string;             // Original table ID
  
  // Content type (required)
  content_kind: 
    | "news" | "social" | "podcast" | "video" | "music"  // From feed_items
    | "movie" | "tv" | "kdrama" | "documentary"           // From external_content_cache
    | "book"                                                // From external_content_cache
    | "creator"                                             // From creator_posts
    | "event";                                              // Future
  
  // Basic fields (required)
  title: string;
  description?: string | null;
  url?: string | null;
  image_url?: string | null;
  
  // Metadata (optional)
  author?: string | null;
  provider?: string | null;        // "tmdb", "open_library", "rss", "youtube", etc.
  external_id?: string | null;     // Provider's ID
  
  // Timestamps (required)
  published_at?: string | null;    // Original publish time
  ingested_at?: string | null;     // When Kivaw ingested
  created_at: string;              // When record created in Kivaw DB
  
  // Discoverability (required)
  tags: string[];                  // Normalized tags
  topics: string[];                // Extracted topics
  categories?: string[];           // K-drama, anime, etc.
  
  // Scoring (optional, from social_feed logic)
  score?: number | null;           // Personalized score (0-10)
  raw_score?: number | null;       // Raw popularity score
  
  // Source-specific (optional JSONB)
  metadata?: Record<string, unknown>;  // Original raw data
  
  // Moderation (optional)
  is_discoverable: boolean;        // Can appear in explore
  is_featured?: boolean;           // Admin-picked featured
}
```

---

## Mapping Rules

### From `feed_items`
```sql
-- In explore_feed_v2 Edge Function
SELECT 
  'feed_items:' || id as id,
  'feed_items' as source_table,
  id::text as source_id,
  CASE 
    WHEN content_kind IN ('news', 'social', 'podcast', 'video', 'music') 
    THEN content_kind
    ELSE 'other'
  END as content_kind,
  title,
  summary as description,
  url,
  image_url,
  author,
  source as provider,
  external_id,
  published_at,
  ingested_at,
  created_at,
  COALESCE(tags, '[]'::jsonb)::text[] as tags,
  COALESCE(topics, '[]'::jsonb)::text[] as topics,
  score,
  metadata,
  is_discoverable,
  false as is_featured
FROM feed_items
WHERE is_discoverable = true
```

### From `external_content_cache` → `public_recommendations`
```sql
-- Only include items that have been published to explore
SELECT 
  'ext:' || e.id as id,
  'public_recommendations' as source_table,
  e.id::text as source_id,
  CASE 
    WHEN e.type = 'read' THEN 'book'
    WHEN e.provider = 'tmdb' THEN
      CASE 
        WHEN (e.raw->>'first_air_date' IS NOT NULL OR e.raw->>'name' IS NOT NULL) THEN
          CASE 
            WHEN (e.raw->>'origin_country')::jsonb ? 'KR' 
              OR e.raw->>'original_language' = 'ko'
              OR e.title ~ '[\uAC00-\uD7AF]'
            THEN 'kdrama'
            ELSE 'tv'
          END
        ELSE 'movie'
      END
    ELSE 'movie'
  END as content_kind,
  e.title,
  e.description,
  e.url,
  e.image_url,
  NULL as author,
  e.provider,
  e.provider_id as external_id,
  COALESCE(
    (e.raw->>'release_date'),
    (e.raw->>'first_air_date'),
    e.fetched_at::text
  ) as published_at,
  e.fetched_at as ingested_at,
  e.fetched_at as created_at,
  COALESCE(
    (SELECT array_agg(tag::text) FROM jsonb_array_elements_text(COALESCE(e.raw->'genres', '[]'::jsonb)) tag),
    ARRAY[]::text[]
  ) as tags,
  ARRAY[]::text[] as topics,
  p.rank as raw_score,
  e.raw as metadata,
  true as is_discoverable,
  false as is_featured
FROM external_content_cache e
INNER JOIN public_recommendations p ON e.id = p.cached_content_id
ORDER BY p.rank ASC, e.fetched_at DESC
```

### From `creator_posts` (future)
```sql
-- Only published creator posts
SELECT 
  'creator:' || id as id,
  'creator_posts' as source_table,
  id::text as source_id,
  'creator' as content_kind,
  title,
  content as description,
  url,
  image_url,
  (SELECT username FROM creators WHERE id = creator_id) as author,
  'creator' as provider,
  NULL as external_id,
  published_at,
  created_at as ingested_at,
  created_at,
  COALESCE(tags, ARRAY[]::text[]) as tags,
  COALESCE(topics, ARRAY[]::text[]) as topics,
  NULL as score,
  jsonb_build_object('creator_id', creator_id) as metadata,
  status = 'published' as is_discoverable,
  is_featured
FROM creator_posts
WHERE status = 'published'
```

---

## Pagination + Ordering Strategy

**Edge Function Parameters:**
```typescript
interface ExploreFeedV2Params {
  limit?: number;              // Default: 50, max: 200
  offset?: number;             // Cursor-based pagination
  content_kinds?: string[];    // Filter by kind: ["news", "movie", "book"]
  tags?: string[];             // Filter by tags: ["tech", "ai"]
  topics?: string[];           // Filter by topics
  sort?: "recent" | "popular" | "blended";  // Default: "blended"
  include_score?: boolean;     // Include personalized score (requires auth)
}
```

**Ordering Logic:**
1. **"blended"** (default):
   - Combine `score` (if available) + recency
   - Formula: `(score * 0.6) + (recency_score * 0.4)`
   - Recency: Items from last 48h get +2, last 7d get +1

2. **"recent"**:
   - Order by `published_at DESC`, then `ingested_at DESC`
   - NULL timestamps go last

3. **"popular"**:
   - Order by `raw_score DESC` (from public_recommendations.rank or feed_items.score)
   - Then `published_at DESC`

**Pagination:**
- Cursor-based using `offset` (not page numbers)
- Return `{ items: UnifiedContentItem[], next_offset?: number }`
- Client tracks `offset` for "Load more"

---

## Rollout Plan

### Phase 1: Create Edge Function (Week 1)
1. Create `supabase/functions/explore_feed_v2/index.ts`
2. Implement mapping from `feed_items` only (prove concept)
3. Test with StudioExplore

### Phase 2: Add External Content (Week 2)
1. Extend to include `public_recommendations` → `external_content_cache`
2. Implement K-drama detection logic
3. Update StudioExplore to use new function

### Phase 3: Add Creator Content (Week 3-4)
1. Create `creator_posts` table (see Plan #5)
2. Extend function to include creator posts
3. Test all content types appear

### Phase 4: Migrate Legacy Pages (Week 5+)
1. Update `Explore.tsx` to use `explore_feed_v2` (instead of `explore_items_v1` view)
2. Deprecate `explore_items_v1` view
3. Keep `feed_items` table for RSS ingestion (don't remove)

---

## File-by-File Plan

**Files to Create:**
- `supabase/functions/explore_feed_v2/index.ts` - New Edge Function
- `supabase/migrations/YYYYMMDD_create_explore_feed_v2_function.sql` - Optional SQL wrapper (if needed)

**Files to Modify (Phase 4):**
- `src/pages/StudioExplore.tsx` - Change query to use `explore_feed_v2`
- `src/pages/Explore.tsx` - Change from `explore_items_v1` view to `explore_feed_v2` function
- `src/pages/ExploreFeed.tsx` - Update Explore mode to use `explore_feed_v2`

**Files to Keep (No Changes):**
- `supabase/migrations/20250120000011_create_explore_items_view.sql` - Keep for rollback
- `supabase/functions/social_feed/index.ts` - Keep for Feed personalization

---

## Risks

1. **Performance:** Edge Function may be slower than direct SQL queries
   - **Mitigation:** Cache results, use connection pooling, optimize SQL queries

2. **Schema Drift:** If source tables change, Edge Function breaks
   - **Mitigation:** Version the function (`explore_feed_v2`, `explore_feed_v3`), keep migrations atomic

3. **Deduplication:** Same content from different sources appears twice
   - **Mitigation:** Fuzzy match on `title` + `url` similarity, use `id` uniqueness per `source_table`

4. **Rollback:** If Edge Function fails, pages break
   - **Mitigation:** Keep `explore_items_v1` view as fallback, add feature flag

---

## Rollback Strategy

**Immediate Rollback (< 1 hour):**
- Revert StudioExplore/Explore to use `explore_items_v1` view (feed_items only)
- Edge Function remains deployed but unused

**Partial Rollback (1-24 hours):**
- Disable Edge Function endpoint (return 503)
- Client falls back to existing queries

**Full Rollback (if needed):**
- Delete Edge Function deployment
- No database changes to rollback (function is stateless)

---

# 2. STUDIOEXPLORE ALL CONTENT SUPPORT

## Summary of Findings

**Current Gap:**
- StudioExplore only queries `external_content_cache` (movies/books/TV/K-dramas)
- Missing RSS/news, social posts, podcasts, video from `feed_items`
- Missing published recommendations from `public_recommendations`
- Missing future creator content

**Requirement:**
Support ALL content types:
- news, social, podcast, video, music (from `feed_items`)
- movie, tv, kdrama, book (from `external_content_cache` + `public_recommendations`)
- creator (future from `creator_posts`)

---

## Recommendation: OPTION 2 (Correct Long-term)

**Phase 1:** Use `explore_feed_v2` Edge Function (from Plan #1)
- Single unified endpoint
- Server-side filtering, pagination, deduplication
- Consistent ordering

**Why NOT Option 1 (Client-side Bridge):**
- ❌ Performance: Client downloads 1000+ items then filters
- ❌ Duplicates: Same content from multiple sources
- ❌ Inconsistent: Different ordering per source
- ❌ Memory: Large client-side arrays
- ✅ Only use Option 1 if `explore_feed_v2` isn't ready yet (temporary bridge)

---

## Normalized Item Model

StudioExplore will receive `UnifiedContentItem` from `explore_feed_v2`:

```typescript
interface UnifiedContentItem {
  id: string;
  content_kind: "news" | "social" | "podcast" | "video" | "music" | "movie" | "tv" | "kdrama" | "book" | "creator";
  title: string;
  description?: string | null;
  url?: string | null;
  image_url?: string | null;
  author?: string | null;
  provider?: string | null;
  published_at?: string | null;
  tags: string[];
  topics: string[];
  score?: number | null;
  // ... (full schema from Plan #1)
}
```

**Transform to StudioExplore's `FeedItem` format:**
```typescript
function unifiedToFeedItem(item: UnifiedContentItem): FeedItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    image_url: item.image_url,
    url: item.url,
    source: item.provider || "unknown",
    type: item.content_kind,  // Maps directly
    tags: item.tags,
    meta: item.published_at || "",
    badge: getCategoryLabel(item.content_kind),
    badgeColor: getBadgeClass(item.content_kind),
  };
}
```

---

## Filter Logic

**Content Type Filtering:**
- User toggles: News, Social, Podcasts, Music, Video, Movies, TV, K-Drama, Books
- Maps to `content_kind[]` parameter in `explore_feed_v2`
- Server filters BEFORE pagination (efficient)

**Tag/Topic Filtering:**
- Search bar filters client-side on `tags` + `topics` arrays
- OR: Add `tags` parameter to Edge Function (server-side filtering)

**Sort Options:**
- "Blended" → `sort: "blended"` (default)
- "Recent" → `sort: "recent"`
- "Popular" → `sort: "popular"`

**StudioExplore Filter State:**
```typescript
const [activeSignals, setActiveSignals] = useState<string[]>(["movies", "tv", "kdrama", "books"]);
// Maps to: content_kinds: ["movie", "tv", "kdrama", "book"] in API call
```

---

## TV vs Movie vs K-Drama Detection

**Detection Logic (in `explore_feed_v2` Edge Function):**

```typescript
function detectContentKind(
  provider: string,
  type: string,
  raw: Record<string, unknown>
): "movie" | "tv" | "kdrama" {
  if (type === "read" || provider === "open_library") {
    return "book";
  }
  
  if (provider === "tmdb") {
    // TV shows have first_air_date or name field
    const isTVShow = !!raw.first_air_date || !!raw.name;
    
    if (isTVShow) {
      // K-drama detection
      const originCountry = raw.origin_country as string[] | undefined;
      const originalLanguage = raw.original_language as string | undefined;
      const title = (raw.title || raw.name || "") as string;
      
      if (originCountry?.includes("KR") || 
          originalLanguage === "ko" ||
          /[\uAC00-\uD7AF]/.test(title)) {
        return "kdrama";
      }
      
      return "tv";
    }
    
    return "movie";
  }
  
  return "movie"; // Default
}
```

---

## Option 1 Bridge (Temporary Fallback)

**If `explore_feed_v2` not ready, use client-side merging:**

```typescript
async function loadContentBridge() {
  const [feedItems, externalContent, recommendations] = await Promise.all([
    // Query feed_items
    supabase.from("feed_items")
      .select("*")
      .eq("is_discoverable", true)
      .limit(500),
    
    // Query external_content_cache
    supabase.from("external_content_cache")
      .select("*")
      .limit(500),
    
    // Query public_recommendations (joined)
    supabase.from("public_recommendations")
      .select(`
        *,
        cached_content:external_content_cache(*)
      `)
      .limit(500),
  ]);
  
  // Normalize and merge
  const normalized = [
    ...feedItems.data.map(normalizeFeedItem),
    ...externalContent.data.map(normalizeExternalContent),
    ...recommendations.data.map(normalizeRecommendation),
  ];
  
  // Deduplicate by title + url similarity
  const deduped = deduplicateByTitleUrl(normalized);
  
  // Filter by activeSignals
  const filtered = deduped.filter(item => activeSignals.includes(item.type));
  
  setItems(filtered);
}
```

**Risks of Client-side Merging:**
- ❌ Downloads 1500+ items (500 per source)
- ❌ Client-side deduplication is slow
- ❌ Inconsistent ordering across sources
- ❌ No pagination (all-or-nothing)

---

## File-by-File Plan

**Files to Create:**
- `supabase/functions/explore_feed_v2/index.ts` (from Plan #1)

**Files to Modify:**
- `src/pages/StudioExplore.tsx`
  - Replace `loadContent()` to call `explore_feed_v2` Edge Function
  - Remove direct `external_content_cache` query
  - Update `FeedItem` interface to match `UnifiedContentItem`

**Files to Keep (No Changes):**
- `studio.css` - CSS stays isolated

---

## Risks

1. **Edge Function Not Ready:** StudioExplore blocks on `explore_feed_v2`
   - **Mitigation:** Use Option 1 bridge temporarily, switch to Option 2 when ready

2. **Content Kind Mismatch:** StudioExplore expects `type: "movies"` but API returns `content_kind: "movie"`
   - **Mitigation:** Normalize in transform function (`unifiedToFeedItem`)

3. **Missing Content:** If filter excludes too much, empty state
   - **Mitigation:** Default to "all" signals, show "No content" message

---

## Rollback Strategy

**If Edge Function fails:**
1. Revert `StudioExplore.tsx` to query `external_content_cache` directly (current code)
2. Edge Function remains deployed but unused

**If client-side bridge needed temporarily:**
1. Add `loadContentBridge()` function (Option 1 code)
2. Feature flag: `const USE_BRIDGE = true;`
3. Switch back to Edge Function when ready

---

# 3. STUDIOFEED HABIT-FORMING DESIGN

## Summary of Findings

**Current State:**
- StudioFeed queries `external_content_cache` directly (raw, no personalization)
- `social_feed` Edge Function exists but StudioFeed doesn't use it
- No freshness sections (Fresh/Today/Trending)
- No save/hide/pass actions
- No "Last updated X min ago" based on cron activity

**Goal:**
Make StudioFeed a **habit-forming daily destination** with:
- Personalized scoring (use `social_feed`)
- Time-based sections (Fresh 6h, Today 24h, Trending 48h)
- User actions (save/hide/pass) that affect scoring
- Real-time freshness indicator

---

## Feed Data Pipeline

**Step 1: Call `social_feed` Edge Function**
```typescript
const { data, error } = await supabase.functions.invoke("social_feed", {
  body: {
    limit: 100,              // Get more items for sectioning
    days: 7,                 // Last 7 days of content
    types: focus === "all" ? [] : [focus],  // Filter by focus mode
  },
});
```

**Step 2: Receive Scored Items**
```typescript
interface SocialFeedResponse {
  feed: Array<{
    id: string;
    title: string;
    summary?: string;
    url?: string;
    source: string;
    score: number;           // Personalized score (0-10)
    published_at?: string;
    // ... other fields
  }>;
  fresh?: FeedItem[];        // Last 6 hours (if provided)
  today?: FeedItem[];        // Last 24 hours (if provided)
}
```

**Step 3: Section Items by Freshness**
```typescript
function sectionItems(items: FeedItem[]): {
  fresh: FeedItem[];      // published_at >= 6h ago
  today: FeedItem[];      // published_at >= 24h ago && < 6h ago
  trending: FeedItem[];   // published_at >= 48h ago && < 24h ago
} {
  const now = Date.now();
  const sixHoursAgo = now - 6 * 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
  
  return {
    fresh: items.filter(item => {
      const ts = new Date(item.published_at || 0).getTime();
      return ts >= sixHoursAgo;
    }).sort((a, b) => (b.score || 0) - (a.score || 0)),
    
    today: items.filter(item => {
      const ts = new Date(item.published_at || 0).getTime();
      return ts >= twentyFourHoursAgo && ts < sixHoursAgo;
    }).sort((a, b) => (b.score || 0) - (a.score || 0)),
    
    trending: items.filter(item => {
      const ts = new Date(item.published_at || 0).getTime();
      return ts >= fortyEightHoursAgo && ts < twentyFourHoursAgo;
    }).sort((a, b) => (b.score || 0) - (a.score || 0)),
  };
}
```

---

## Sectioning Logic

**Sections (in order):**
1. **Fresh** (Last 6 hours)
   - Title: "Fresh"
   - Subtitle: "Last 6 hours"
   - Items: Top 20 by score, then by recency
   - Empty state: Hide section if empty

2. **Today** (Last 24 hours, excluding Fresh)
   - Title: "Today"
   - Subtitle: "Last 24 hours"
   - Items: Top 30 by score
   - Empty state: Hide section if empty

3. **Trending** (Last 48 hours, excluding Fresh/Today)
   - Title: "Trending"
   - Subtitle: "Last 48 hours"
   - Items: Top 30 by score
   - Empty state: Hide section if empty

4. **Deep Cuts** (7-30 days old)
   - Title: "Deep Cuts"
   - Subtitle: "7-30 days ago"
   - Items: Top 20 by score
   - Only show if no Fresh/Today/Trending (fallback)

**Deduplication:**
- Track `seenIds` across sections
- Once an item appears in one section, exclude from others

---

## Signal Integration (Save/Hide/Pass)

**Actions:**
- **Save:** Add to saved items, boost score for similar content
- **Hide:** Hide item immediately, reduce score for similar topics
- **Pass:** No action, but track for learning

**Implementation:**
```typescript
async function handleAction(itemId: string, action: "save" | "hide" | "pass") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  // Insert/update user_item_actions
  await supabase.from("user_item_actions").upsert({
    user_id: user.id,
    item_id: itemId,
    action: action,
    created_at: new Date().toISOString(),
  });
  
  // Remove item from feed if hidden
  if (action === "hide") {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }
  
  // Refresh feed to get updated scores
  // (social_feed Edge Function reads user_item_actions and adjusts scores)
  await loadContent();
}
```

**UI Buttons (per item):**
```tsx
<div className="studio-card__actions">
  <button onClick={() => handleAction(item.id, "save")}>💾 Save</button>
  <button onClick={() => handleAction(item.id, "hide")}>🙈 Hide</button>
  <button onClick={() => handleAction(item.id, "pass")}>➡️ Pass</button>
</div>
```

---

## "Last Updated X min ago" Display

**Strategy:**
1. Track last successful `social_feed` call time: `lastRefresh`
2. Track last cron job run: Query `cron.job_run_details` table (if pg_cron) OR check last successful Edge Function call
3. Display: `"Last updated X min ago"` based on `lastRefresh`

**Implementation:**
```typescript
const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

async function loadContent() {
  // ... call social_feed ...
  setLastRefresh(new Date());
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return `${Math.floor(diffHours / 24)}d ago`;
}

// In UI:
<div className="studio-feed-header__meta">
  <span>Updated {formatTimeAgo(lastRefresh)}</span>
</div>
```

**Cron Activity Indicator (Advanced):**
- Query `cron.job_run_details` for `ingest-rss-feeds` job
- Show: `"Last sync: X min ago"` (separate from user's last refresh)

---

## Empty State Behavior

**If no items:**
```tsx
<div className="studio-empty">
  <div className="studio-empty__icon">📭</div>
  <div className="studio-empty__title">Your feed is empty</div>
  <div className="studio-empty__desc">
    We're still gathering content for you. Check back soon or explore to discover more.
  </div>
  <button onClick={() => navigate("/studio/explore")}>
    Explore content
  </button>
</div>
```

**If sections empty but feed has items:**
- Show "Deep Cuts" section as fallback
- OR: Show "All items" section (no time filtering)

---

## Observability Plan

**Logging:**
- Log `social_feed` call time, response time, item count
- Log section counts: `{ fresh: 5, today: 12, trending: 8 }`
- Log action counts: `{ save: 3, hide: 1, pass: 2 }`

**Metrics:**
- Feed load time (target: < 2s)
- Section population rate (target: Fresh > 0 items 80% of time)
- User actions per session (target: > 2 actions)

**Error Handling:**
- If `social_feed` fails, show cached feed (from localStorage)
- If no cached feed, show empty state with "Try again" button

---

## File-by-File Plan

**Files to Modify:**
- `src/pages/StudioFeed.tsx`
  - Replace `loadContent()` to call `social_feed` Edge Function
  - Add sectioning logic (`sectionItems()`)
  - Add action handlers (`handleAction()`)
  - Add "Last updated" display
  - Update UI to show sections (Fresh/Today/Trending)

**Files to Keep (No Changes):**
- `supabase/functions/social_feed/index.ts` - Already implements scoring
- `studio.css` - CSS supports sections

**Files to Create:**
- None (reuse existing `social_feed` function)

---

## Risks

1. **`social_feed` Performance:** If slow, feed feels sluggish
   - **Mitigation:** Cache results, show loading skeleton, optimize Edge Function

2. **Empty Sections:** If cron hasn't run, Fresh section is empty
   - **Mitigation:** Show "Deep Cuts" or "Today" as fallback, hide empty sections

3. **Action Feedback:** If save/hide fails, user doesn't know
   - **Mitigation:** Show toast notification, retry on failure

---

## Rollback Strategy

**If `social_feed` breaks:**
1. Revert `StudioFeed.tsx` to query `external_content_cache` directly (current code)
2. Remove sectioning logic, show flat feed
3. `social_feed` remains deployed but unused

**If actions fail:**
1. Remove action buttons temporarily
2. Feed still loads (actions are optional)

---

# 4. CRON SYSTEM DECISION & FIX PLAN

## Summary of Findings

**Current State:**
- Vercel cron exists: `pages/api/cron.ts` → calls `cron_runner` Edge Function
- pg_cron migration exists: `20250120000006_schedule_rss_ingest.sql`
- Cron only runs on deploy/push (not automatically)
- Both systems exist but unclear which is active

**Root Cause:**
- Vercel cron requires `vercel.json` config (check if exists)
- pg_cron requires extension enabled + jobs scheduled (check if enabled)
- Likely: Vercel cron not configured OR pg_cron not enabled

---

## Root Cause Analysis

**Check Vercel Cron:**
```bash
# Check vercel.json for cron config
cat vercel.json | grep -A 10 "crons"
```

**Check pg_cron:**
```sql
-- Check if extension enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check if jobs scheduled
SELECT jobid, jobname, schedule, command 
FROM cron.job 
ORDER BY jobname;

-- Check recent runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

**Likely Issues:**
1. Vercel cron not configured in `vercel.json`
2. pg_cron extension not enabled
3. pg_cron jobs not scheduled (migration not run)
4. Both systems configured but conflicting

---

## Decision: Choose ONE System

**RECOMMENDATION: Use Supabase pg_cron (with Edge Function triggers)**

**Why pg_cron over Vercel Cron:**
1. ✅ Database-native (no external dependency on Vercel)
2. ✅ Reliable (runs inside Supabase, not dependent on Vercel deployment)
3. ✅ Auditable (can query `cron.job_run_details` for history)
4. ✅ Scalable (can schedule multiple jobs with different intervals)
5. ✅ Works across environments (dev/staging/prod all use same mechanism)

**Why NOT Vercel Cron:**
1. ❌ Tied to Vercel deployment (if you switch hosting, cron breaks)
2. ❌ Harder to debug (no database logs)
3. ❌ Requires `vercel.json` config (one more file to maintain)

**However:** Keep Vercel cron as **backup/fallback** (disable but don't delete)

---

## Migration Steps

### Step 1: Verify pg_cron is Enabled

```sql
-- Enable extension (if not enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;  -- Required for HTTP calls

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

### Step 2: Schedule Jobs (Use setup_cron_jobs.sql)

```sql
-- Remove existing jobs (for re-running)
SELECT cron.unschedule('sync-external-content-hourly');
SELECT cron.unschedule('ingest-rss-feeds');
SELECT cron.unschedule('refresh-feed-cache');

-- Schedule sync-external-content every hour
SELECT cron.schedule(
  'sync-external-content-hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-external-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule ingest_rss every 30 minutes
SELECT cron.schedule(
  'ingest-rss-feeds',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_rss',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object('maxFeeds', 50, 'perFeedLimit', 100)
  );
  $$
);

-- Optional: Pre-compute feed cache every 15 minutes
SELECT cron.schedule(
  'refresh-feed-cache',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/feed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object('safeMode', false)
  );
  $$
);
```

**IMPORTANT:** Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with actual values.

### Step 3: Verify Jobs are Running

```sql
-- Check scheduled jobs
SELECT jobid, jobname, schedule, command 
FROM cron.job 
ORDER BY jobname;

-- After 1 hour, check recent runs
SELECT 
  jobid,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Step 4: Disable Vercel Cron (Keep as Backup)

**Option A: Comment out in `vercel.json`:**
```json
{
  "crons": [
    // DISABLED: Using Supabase pg_cron instead
    // {
    //   "path": "/api/cron",
    //   "schedule": "*/30 * * * *"
    // }
  ]
}
```

**Option B: Keep but add flag in `pages/api/cron.ts`:**
```typescript
// DISABLED: Using Supabase pg_cron instead
// Return early if flag set
if (process.env.USE_VERCEL_CRON !== "true") {
  return res.status(503).json({ message: "Vercel cron disabled" });
}
```

---

## Monitoring & Verification Strategy

**Health Check Query:**
```sql
-- Check if jobs are running regularly
SELECT 
  jobname,
  COUNT(*) as run_count,
  MAX(start_time) as last_run,
  COUNT(*) FILTER (WHERE status = 'succeeded') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failure_count
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '24 hours'
GROUP BY jobname
ORDER BY jobname;
```

**Alerting (Manual Check Daily):**
- If `last_run` > 2 hours ago → cron may be broken
- If `failure_count` > 0 → investigate errors

**Edge Function Logs:**
- Check Supabase Dashboard → Logs → Edge Functions
- Look for `ingest_rss` and `sync-external-content` calls
- Should see calls every 30 min (RSS) and every hour (sync)

---

## Rollback Plan

**If pg_cron fails:**
1. Re-enable Vercel cron (uncomment `vercel.json`)
2. OR: Manually trigger `pages/api/cron.ts` endpoint
3. pg_cron jobs remain scheduled but unused

**If both fail:**
1. Manual trigger: `curl -X POST https://your-project.supabase.co/functions/v1/cron_runner -H "x-cron-secret: YOUR_SECRET"`
2. Document manual trigger process for emergency

---

## File-by-File Plan

**Files to Create:**
- `supabase/migrations/YYYYMMDD_setup_pg_cron_jobs.sql` - SQL to schedule jobs (use provided `setup_cron_jobs.sql`)

**Files to Modify:**
- `vercel.json` - Comment out cron config (or add disable flag)

**Files to Keep (No Changes):**
- `pages/api/cron.ts` - Keep as backup
- `supabase/functions/cron_runner/index.ts` - Keep (pg_cron calls Edge Functions directly)
- `supabase/functions/ingest_rss/index.ts` - Keep
- `supabase/functions/sync-external-content/index.ts` - Keep

---

## Risks

1. **pg_cron Not Available:** Some Supabase plans don't support pg_cron
   - **Mitigation:** Check plan, use Vercel cron as primary if needed

2. **Service Role Key Exposure:** If key exposed, anyone can trigger Edge Functions
   - **Mitigation:** Store in Supabase secrets, never commit to git

3. **Job Failures:** If jobs fail silently, no alerts
   - **Mitigation:** Query `cron.job_run_details` daily, add monitoring

---

# 5. CREATOR CONTENT PUBLISHING DESIGN

## Summary of Findings

**Current State:**
- Creator Portal exists: `/creator`, `/creators/dashboard`, `RequireCreator` guard
- Admin creator approval exists: `creator_access_requests` table
- **No creator content table yet** (no `creator_posts` table)
- No publishing workflow

**Goal:**
Allow creators to publish content that appears in unified content spine (StudioExplore/StudioFeed) without changing existing creator auth or routes.

---

## Schema + RLS Plan

### Create `creator_posts` Table

```sql
-- Migration: create_creator_posts.sql
CREATE TABLE public.creator_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  
  -- Content (required)
  title TEXT NOT NULL,
  content TEXT,  -- Markdown or plain text
  url TEXT,      -- Optional external link
  image_url TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  post_type TEXT DEFAULT 'article',  -- 'article', 'video', 'podcast', 'event'
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'pending', 'published', 'archived'
  
  -- Moderation (optional)
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id),
  moderation_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,  -- When status changed to 'published'
  
  -- Discoverability
  is_featured BOOLEAN DEFAULT false,  -- Admin-picked featured posts
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  CONSTRAINT valid_post_type CHECK (post_type IN ('article', 'video', 'podcast', 'event', 'other'))
);

-- Indexes
CREATE INDEX idx_creator_posts_creator_id ON public.creator_posts(creator_id);
CREATE INDEX idx_creator_posts_status ON public.creator_posts(status);
CREATE INDEX idx_creator_posts_published_at ON public.creator_posts(published_at DESC NULLS LAST);
CREATE INDEX idx_creator_posts_tags ON public.creator_posts USING GIN(tags);
CREATE INDEX idx_creator_posts_topics ON public.creator_posts USING GIN(topics);

-- Updated_at trigger
CREATE TRIGGER update_creator_posts_updated_at
  BEFORE UPDATE ON public.creator_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Set published_at when status changes to 'published'
CREATE OR REPLACE FUNCTION set_creator_post_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = NOW();
  END IF;
  IF NEW.status != 'published' AND OLD.status = 'published' THEN
    NEW.published_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_creator_post_published_at_trigger
  BEFORE UPDATE ON public.creator_posts
  FOR EACH ROW
  EXECUTE FUNCTION set_creator_post_published_at();
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;

-- Policy 1: Creators can view their own posts
CREATE POLICY "Creators can view own posts"
  ON public.creator_posts
  FOR SELECT
  TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Creators can insert their own posts
CREATE POLICY "Creators can insert own posts"
  ON public.creator_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
    AND status IN ('draft', 'pending')  -- Can only create drafts/pending
  );

-- Policy 3: Creators can update their own posts (but can't change status to 'published' without moderation)
CREATE POLICY "Creators can update own posts"
  ON public.creator_posts
  FOR UPDATE
  TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
    -- Can only set status to 'draft' or 'pending', not 'published'
    AND (NEW.status != 'published' OR OLD.status = 'published')
  );

-- Policy 4: Public can view published posts
CREATE POLICY "Public can view published posts"
  ON public.creator_posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Policy 5: Admins can do anything
CREATE POLICY "Admins can manage all creator posts"
  ON public.creator_posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.key = 'admin'
    )
  );
```

---

## UI Additions (Inside Existing Creator Dashboard)

**File: `src/pages/CreatorsDashboard.tsx`**

**Add Tab: "My Posts"**
```tsx
const [activeTab, setActiveTab] = useState<"overview" | "posts">("overview");

// In render:
<div className="dashboard-tabs">
  <button onClick={() => setActiveTab("overview")}>Overview</button>
  <button onClick={() => setActiveTab("posts")}>My Posts</button>
</div>

{activeTab === "posts" && <CreatorPostsTab />}
```

**New Component: `src/pages/CreatorPostsTab.tsx`**
```tsx
export default function CreatorPostsTab() {
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load creator's posts
  useEffect(() => {
    loadPosts();
  }, []);
  
  async function loadPosts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Get creator ID
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!creator) return;
    
    // Load posts
    const { data, error } = await supabase
      .from("creator_posts")
      .select("*")
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error loading posts:", error);
      return;
    }
    
    setPosts(data || []);
    setLoading(false);
  }
  
  async function handlePublish(postId: string) {
    // Set status to 'pending' (requires admin moderation)
    // OR 'published' if no moderation required
    const { error } = await supabase
      .from("creator_posts")
      .update({ status: "pending" })  // Change to 'published' if no moderation
      .eq("id", postId);
    
    if (error) {
      console.error("Error publishing:", error);
      return;
    }
    
    loadPosts(); // Refresh
  }
  
  return (
    <div>
      <button onClick={() => navigate("/creators/posts/new")}>
        + New Post
      </button>
      
      <div>
        {posts.map(post => (
          <div key={post.id}>
            <h3>{post.title}</h3>
            <span>Status: {post.status}</span>
            {post.status === "draft" && (
              <button onClick={() => handlePublish(post.id)}>
                Publish
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Content Lifecycle

**1. Draft → Pending (Creator clicks "Publish")**
- Status changes from `draft` to `pending`
- If no moderation required, skip to `published`

**2. Pending → Published (Admin approves)**
- Admin reviews in Admin dashboard
- Admin clicks "Approve" → status changes to `published`
- `published_at` timestamp set automatically (via trigger)

**3. Published → Discoverable**
- Published posts appear in `explore_feed_v2` Edge Function (see Plan #1)
- Mapped to `content_kind: "creator"`

**4. Published → Archived (Optional)**
- Creator or admin can archive
- No longer appears in explore/feed

---

## How Creator Posts Surface in StudioExplore/StudioFeed

**In `explore_feed_v2` Edge Function (from Plan #1):**

Add to UNION query:
```typescript
// From creator_posts
const creatorPosts = await supabase
  .from("creator_posts")
  .select("*")
  .eq("status", "published")
  .order("published_at", { ascending: false })
  .limit(100);

// Transform to UnifiedContentItem
const creatorItems = creatorPosts.data.map(post => ({
  id: `creator:${post.id}`,
  source_table: "creator_posts",
  source_id: post.id,
  content_kind: "creator",
  title: post.title,
  description: post.content,
  url: post.url,
  image_url: post.image_url,
  author: `@${creator.username}`,  // From creators table
  provider: "creator",
  published_at: post.published_at,
  ingested_at: post.created_at,
  created_at: post.created_at,
  tags: post.tags || [],
  topics: post.topics || [],
  is_discoverable: true,
  is_featured: post.is_featured || false,
}));
```

**In StudioExplore/StudioFeed:**
- No changes needed (consume `UnifiedContentItem` from `explore_feed_v2`)
- Creator posts appear with badge: "Creator"

---

## File-by-File Plan

**Files to Create:**
- `supabase/migrations/YYYYMMDD_create_creator_posts.sql` - Table + RLS
- `src/pages/CreatorPostsTab.tsx` - New tab component
- `src/pages/CreatorPostEditor.tsx` - Post editor (if needed)

**Files to Modify:**
- `src/pages/CreatorsDashboard.tsx` - Add "My Posts" tab
- `supabase/functions/explore_feed_v2/index.ts` - Add creator posts to UNION (from Plan #1)

**Files to Keep (No Changes):**
- `src/auth/RequireCreator.tsx` - Auth guard stays the same
- `/creator`, `/creators/dashboard` routes - Routes stay the same

---

## Risks

1. **RLS Complexity:** If policies too restrictive, creators can't edit
   - **Mitigation:** Test thoroughly, allow creators to edit their own drafts

2. **Spam:** If no moderation, low-quality content appears
   - **Mitigation:** Require `pending` → `published` admin approval (or community moderation)

3. **Performance:** If many creator posts, `explore_feed_v2` slows down
   - **Mitigation:** Index `published_at`, limit to last 30 days

---

## Rollback Strategy

**If creator posts cause issues:**
1. Set all `creator_posts.status = 'archived'` (hide from explore)
2. Remove creator posts from `explore_feed_v2` UNION query
3. Table remains, but content not discoverable

**If RLS breaks:**
1. Disable RLS temporarily: `ALTER TABLE creator_posts DISABLE ROW LEVEL SECURITY;`
2. Fix policies, re-enable
3. Table stays, security temporarily relaxed

---

# 6. EXPLOREFEED.TSX DUPLICATION ELIMINATION

## Summary of Findings

**Current State:**
- `ExploreFeed.tsx` - 2081 lines, combines Explore + Feed modes
- `Feed.tsx` - 471 lines, personalized feed
- `Explore.tsx` - 405 lines, public discovery
- Multiple card components: `ExploreCard`, `FeedPost`, `ContentCard`, `RecommendationCover`

**Problem:**
- Massive duplication (ExploreFeed has both Explore and Feed logic)
- Same data rendered differently
- Hard to maintain (changes must be made in multiple places)

---

## New Component Structure

**Proposed Hierarchy:**
```
ContentFeed (shared container)
├── FeedPage (personalized, uses social_feed)
│   └── FeedCard (personalized item)
├── ExplorePage (public, uses explore_feed_v2)
│   └── ExploreCard (public item)
└── Shared:
    ├── ContentCard (base card component)
    ├── useContentFeed (shared data fetching hook)
    └── useContentFilters (shared filter logic)
```

---

## New Component Tree

### 1. `ContentCard` (Base Component)
**File: `src/components/content/ContentCard.tsx`**
- Shared card UI (image, title, description, tags)
- Props: `item: UnifiedContentItem`, `variant: "compact" | "full"`
- Used by both Feed and Explore

### 2. `FeedCard` (Personalized)
**File: `src/components/feed/FeedCard.tsx`**
- Extends `ContentCard`
- Adds: Score display, save/hide/pass actions, "Fresh/Today/Trending" badges
- Used only by FeedPage

### 3. `ExploreCard` (Public)
**File: `src/components/explore/ExploreCard.tsx`**
- Extends `ContentCard`
- Adds: Provider badge, category badges, no personalization
- Used only by ExplorePage

### 4. `ContentFeed` (Container)
**File: `src/components/content/ContentFeed.tsx`**
- Shared container: Loading states, error states, empty states, pagination
- Props: `children`, `loading`, `error`, `emptyMessage`

### 5. `FeedPage` (Personalized Feed)
**File: `src/pages/FeedPage.tsx`** (rename from `Feed.tsx`)
- Uses `useContentFeed("social_feed")` hook
- Sections: Fresh/Today/Trending (from Plan #3)
- Renders `FeedCard` components

### 6. `ExplorePage` (Public Discovery)
**File: `src/pages/ExplorePage.tsx`** (rename from `Explore.tsx`)
- Uses `useContentFeed("explore_feed_v2")` hook
- Filters: Content kind, tags, search
- Renders `ExploreCard` components

---

## Hooks to Extract

### `useContentFeed` (Shared Data Fetching)
**File: `src/hooks/useContentFeed.ts`**
```typescript
interface UseContentFeedOptions {
  source: "social_feed" | "explore_feed_v2";
  limit?: number;
  filters?: {
    content_kinds?: string[];
    tags?: string[];
    search?: string;
  };
}

function useContentFeed(options: UseContentFeedOptions) {
  const [items, setItems] = useState<UnifiedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadContent();
  }, [options.source, options.filters]);
  
  // ... fetch logic ...
  
  return { items, loading, error, refresh: loadContent };
}
```

### `useContentFilters` (Shared Filter Logic)
**File: `src/hooks/useContentFilters.ts`**
```typescript
function useContentFilters() {
  const [activeKinds, setActiveKinds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "blended">("blended");
  
  const filteredItems = useMemo(() => {
    // Client-side filtering (if needed)
    // OR: Pass to useContentFeed as filters (server-side)
  }, [items, activeKinds, searchQuery]);
  
  return {
    activeKinds,
    setActiveKinds,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    filteredItems,
  };
}
```

---

## File-by-File Migration Plan

### Phase 1: Extract Shared Components (Week 1)
1. Create `src/components/content/ContentCard.tsx`
2. Create `src/components/content/ContentFeed.tsx`
3. Create `src/hooks/useContentFeed.ts`
4. Test with existing Feed.tsx (refactor to use new components)

### Phase 2: Split ExploreFeed.tsx (Week 2)
1. Extract `FeedPage.tsx` from ExploreFeed.tsx (Feed mode logic)
2. Extract `ExplorePage.tsx` from ExploreFeed.tsx (Explore mode logic)
3. Update `App.tsx` routes: `/feed` → `FeedPage`, `/explore` → `ExplorePage`
4. Test both pages work independently

### Phase 3: Consolidate Cards (Week 3)
1. Create `FeedCard.tsx` (extends `ContentCard`)
2. Create `ExploreCard.tsx` (extends `ContentCard`)
3. Update `FeedPage.tsx` to use `FeedCard`
4. Update `ExplorePage.tsx` to use `ExploreCard`

### Phase 4: Deprecate ExploreFeed.tsx (Week 4)
1. Mark `ExploreFeed.tsx` as deprecated (add comment)
2. Keep file for 2 weeks (for rollback)
3. Delete after confirmation no regressions

---

## Files to Deprecate

**After migration complete:**
- ❌ `src/pages/ExploreFeed.tsx` - Delete (replaced by `FeedPage.tsx` + `ExplorePage.tsx`)
- ❌ `src/components/feed/FeedPost.tsx` - Delete (replaced by `FeedCard.tsx`)
- ❌ `src/components/feed/ContentCard.tsx` - Delete (replaced by `ContentCard.tsx`)

**Keep (may still be used elsewhere):**
- ✅ `src/ui/RecommendationCover.tsx` - May be used by other pages

---

## Rollback Strategy

**If new structure breaks:**
1. Revert `App.tsx` routes to use `ExploreFeed.tsx`
2. Keep new components but unused
3. `ExploreFeed.tsx` remains as fallback

**If shared components cause issues:**
1. Copy component logic back into `FeedPage.tsx` and `ExplorePage.tsx` (inline)
2. Remove shared components
3. Pages work independently (no sharing)

---

## Risks

1. **Breaking Changes:** If refactor breaks existing functionality
   - **Mitigation:** Test thoroughly, keep `ExploreFeed.tsx` as backup

2. **Performance:** If shared components add overhead
   - **Mitigation:** Use React.memo, optimize re-renders

3. **Complexity:** If shared hooks become too complex
   - **Mitigation:** Split hooks further, keep each hook focused

---

# 7. PERFORMANCE HARDENING PLAN

## Summary of Findings

**Current Issues:**
- Client pulls 1000 items then filters client-side (`ExploreFeed.tsx` line 484)
- No pagination (all-or-nothing loading)
- Over-rendering (no React.memo on cards)
- No query optimization (multiple queries for same data)

---

## Server-Side Filtering Strategy

**Problem:** Client downloads 1000 items, filters to 50

**Solution:** Filter in Edge Function (`explore_feed_v2`, `social_feed`)

**Implementation:**
```typescript
// In explore_feed_v2 Edge Function
const { content_kinds, tags, search, limit = 50, offset = 0 } = body;

// Build WHERE clause
let query = supabase.from("feed_items").select("*");

if (content_kinds?.length > 0) {
  query = query.in("content_kind", content_kinds);
}

if (tags?.length > 0) {
  query = query.contains("tags", tags);
}

if (search) {
  query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
}

// Apply pagination
query = query
  .order("published_at", { ascending: false })
  .range(offset, offset + limit - 1);

const { data } = await query;
```

**Result:** Client receives only 50 items (not 1000)

---

## Pagination Approach

### Cursor-Based Pagination

**Edge Function Response:**
```typescript
interface PaginatedResponse {
  items: UnifiedContentItem[];
  next_offset?: number;  // null if no more items
  total?: number;        // Optional: total count (expensive)
}
```

**Client Implementation:**
```typescript
const [items, setItems] = useState<UnifiedContentItem[]>([]);
const [offset, setOffset] = useState(0);
const [hasMore, setHasMore] = useState(true);

async function loadMore() {
  const { data } = await supabase.functions.invoke("explore_feed_v2", {
    body: { limit: 50, offset },
  });
  
  setItems(prev => [...prev, ...data.items]);
  setOffset(data.next_offset || 0);
  setHasMore(!!data.next_offset);
}

// "Load more" button
{hasMore && (
  <button onClick={loadMore}>
    Load more
  </button>
)}
```

**OR: Infinite Scroll**
```typescript
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && !loading) {
      loadMore();
    }
  });
  
  if (loadMoreRef.current) {
    observer.observe(loadMoreRef.current);
  }
  
  return () => observer.disconnect();
}, [hasMore, loading]);
```

---

## React Memoization Checklist

### 1. Memoize Card Components
```typescript
// FeedCard.tsx
export const FeedCard = React.memo(function FeedCard({ item }: { item: UnifiedContentItem }) {
  // ... render
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if item ID changes
  return prevProps.item.id === nextProps.item.id;
});
```

### 2. Memoize Filtered Lists
```typescript
const filteredItems = useMemo(() => {
  return items.filter(item => {
    // ... filter logic
  });
}, [items, activeKinds, searchQuery]);
```

### 3. Memoize Expensive Calculations
```typescript
const sectionedItems = useMemo(() => {
  return sectionItems(items);  // Expensive operation
}, [items]);
```

### 4. Avoid Inline Functions in JSX
```typescript
// ❌ Bad: Creates new function on every render
<FeedCard onClick={() => handleClick(item.id)} />

// ✅ Good: Memoized callback
const handleClickItem = useCallback((id: string) => {
  handleClick(id);
}, [handleClick]);

<FeedCard onClick={handleClickItem} />
```

### 5. Use React.lazy for Code Splitting
```typescript
const FeedPage = React.lazy(() => import("./pages/FeedPage"));
const ExplorePage = React.lazy(() => import("./pages/ExplorePage"));

<Suspense fallback={<Loading />}>
  <FeedPage />
</Suspense>
```

---

## Query Optimization Plan

### 1. Add Database Indexes
```sql
-- Index on feed_items for filtering
CREATE INDEX idx_feed_items_content_kind ON feed_items(content_kind);
CREATE INDEX idx_feed_items_is_discoverable ON feed_items(is_discoverable);
CREATE INDEX idx_feed_items_published_at ON feed_items(published_at DESC NULLS LAST);

-- GIN index for array searches
CREATE INDEX idx_feed_items_tags_gin ON feed_items USING GIN(tags);
CREATE INDEX idx_feed_items_topics_gin ON feed_items USING GIN(topics);

-- Composite index for common queries
CREATE INDEX idx_feed_items_discoverable_published ON feed_items(is_discoverable, published_at DESC NULLS LAST);
```

### 2. Use Connection Pooling
```typescript
// In Edge Function
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: "public",
  },
  global: {
    headers: {
      "x-connection-pool": "true",
    },
  },
});
```

### 3. Batch Queries
```typescript
// ❌ Bad: Multiple queries
const feedItems = await supabase.from("feed_items").select("*");
const externalContent = await supabase.from("external_content_cache").select("*");

// ✅ Good: Parallel queries
const [feedItems, externalContent] = await Promise.all([
  supabase.from("feed_items").select("*"),
  supabase.from("external_content_cache").select("*"),
]);
```

### 4. Cache Results
```typescript
// In Edge Function (Redis or in-memory cache)
const cacheKey = `explore_feed:${JSON.stringify(filters)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const data = await fetchData();
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min cache
return data;
```

---

## Before/After Benchmarks

### Before (Current)
- **Initial Load:** 1000 items downloaded, 2-5 seconds
- **Filter:** Client-side, 100-500ms
- **Re-render:** All cards re-render on filter change
- **Memory:** ~10MB for 1000 items in memory

### After (Optimized)
- **Initial Load:** 50 items downloaded, 500ms-1s
- **Filter:** Server-side, 200-500ms (network time only)
- **Re-render:** Only changed cards re-render (React.memo)
- **Memory:** ~1MB for 50 items in memory

**Target Metrics:**
- Initial load < 1s (p95)
- Filter response < 500ms (p95)
- Re-render < 100ms (p95)
- Memory usage < 5MB for typical feed

---

## File-by-File Plan

**Files to Create:**
- `supabase/migrations/YYYYMMDD_add_content_indexes.sql` - Database indexes

**Files to Modify:**
- `src/components/content/ContentCard.tsx` - Add React.memo
- `src/components/feed/FeedCard.tsx` - Add React.memo
- `src/components/explore/ExploreCard.tsx` - Add React.memo
- `src/pages/FeedPage.tsx` - Add pagination, memoize filtered lists
- `src/pages/ExplorePage.tsx` - Add pagination, memoize filtered lists
- `supabase/functions/explore_feed_v2/index.ts` - Add server-side filtering, pagination
- `supabase/functions/social_feed/index.ts` - Add pagination

**Files to Keep (No Changes):**
- Database tables (indexes only)

---

## Risks

1. **Over-Indexing:** Too many indexes slow down writes
   - **Mitigation:** Only index frequently queried columns, monitor query performance

2. **Cache Staleness:** Cached results may be stale
   - **Mitigation:** Short TTL (5 min), invalidate on content updates

3. **Pagination Complexity:** Cursor-based pagination harder to implement
   - **Mitigation:** Start with offset-based, migrate to cursor later

---

## Rollback Strategy

**If pagination breaks:**
1. Revert to loading all items (remove pagination)
2. Keep server-side filtering (still better than client-side)

**If memoization causes issues:**
1. Remove React.memo from components
2. Keep other optimizations (server-side filtering, indexes)

---

# 8. STYLING CONSOLIDATION PLAN

## Summary of Findings

**Current State:**
- 17 CSS files in `src/styles/`
- `src/ui/ui.css` - 7276 lines (massive)
- Duplicate design tokens (colors, spacing, typography)
- Studio CSS isolated (`studio.css`) - good

**Problem:**
- Inconsistent tokens (same color defined in 5 places)
- Hard to maintain (change color requires updating 5 files)
- Bundle size (all CSS loaded even if not used)

---

## Styling Hierarchy

**Proposed Structure:**
```
src/styles/
├── tokens.css          # Canonical design tokens (NEW)
├── reset.css           # CSS reset (if needed)
├── base.css            # Base typography, body styles
├── ui.css              # Shared UI components (buttons, forms, etc.)
└── themes/
    ├── light.css       # Light theme overrides
    └── dark.css        # Dark theme overrides

src/pages/
├── studio.css          # Studio-specific (KEEP ISOLATED)
└── [other page CSS]    # Page-specific styles

src/components/
└── [component CSS]     # Component-specific styles (if needed)
```

---

## Canonical Token File

**File: `src/styles/tokens.css`**

```css
:root {
  /* Colors - Primary */
  --color-coral: #F97066;
  --color-coral-light: #FEE4E2;
  --color-coral-dark: #D92D20;
  
  /* Colors - Neutral */
  --color-white: #FFFFFF;
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;
  
  /* Colors - Semantic */
  --color-text: var(--color-gray-900);
  --color-text-secondary: var(--color-gray-600);
  --color-text-muted: var(--color-gray-500);
  --color-border: var(--color-gray-200);
  --color-bg: var(--color-white);
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 36px;
  --font-size-4xl: 48px;
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;
  --spacing-3xl: 48px;
  --spacing-4xl: 64px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  
  /* Layout */
  --max-width: 1280px;
  --sidebar-width: 280px;
}

/* Dark mode */
[data-theme="dark"] {
  --color-text: var(--color-gray-50);
  --color-text-secondary: var(--color-gray-400);
  --color-text-muted: var(--color-gray-500);
  --color-border: var(--color-gray-700);
  --color-bg: var(--color-gray-900);
}
```

---

## What to Fix Now vs Later

### Fix Now (High Priority)
1. ✅ **Create `tokens.css`** - Single source of truth for tokens
2. ✅ **Keep `studio.css` isolated** - Don't merge (Studio is testing)
3. ✅ **Document token usage** - Create reference doc

### Fix Later (Post-Launch)
1. ⏳ **Refactor `ui.css`** - Use tokens instead of hardcoded values
2. ⏳ **Consolidate duplicate CSS files** - Merge similar files
3. ⏳ **Remove unused CSS** - Audit and delete unused styles

### Don't Fix (Leave As-Is)
1. ❌ **Creator Portal coral theme** - Keep separate (different brand)
2. ❌ **Studio CSS** - Keep isolated until Studio replaces legacy pages

---

## Migration Strategy

### Phase 1: Create Tokens (Week 1)
1. Create `src/styles/tokens.css`
2. Import in `src/main.tsx` (before other CSS)
3. Document token usage in `STYLE_GUIDE.md`

### Phase 2: Migrate ui.css (Week 2-3)
1. Replace hardcoded colors with `var(--color-*)`
2. Replace hardcoded spacing with `var(--spacing-*)`
3. Test all pages still look correct

### Phase 3: Consolidate (Week 4+)
1. Merge duplicate CSS files
2. Remove unused styles
3. Audit bundle size reduction

---

## Rollback Strategy

**If tokens break styling:**
1. Revert `tokens.css` changes
2. Keep file but don't import
3. Styles revert to hardcoded values

**If ui.css migration breaks:**
1. Revert `ui.css` to previous version
2. Keep tokens file (for future use)

---

## File-by-File Plan

**Files to Create:**
- `src/styles/tokens.css` - Canonical tokens
- `docs/STYLE_GUIDE.md` - Token reference

**Files to Modify:**
- `src/main.tsx` - Import `tokens.css` first
- `src/ui/ui.css` - Replace hardcoded values with tokens (Phase 2)

**Files to Keep (No Changes):**
- `src/styles/studio.css` - Keep isolated
- Creator Portal CSS files - Keep separate

**Files to Deprecate (Later):**
- Duplicate CSS files (after consolidation in Phase 3)

---

## Risks

1. **Breaking Changes:** If token migration breaks existing styles
   - **Mitigation:** Test thoroughly, keep backups, migrate incrementally

2. **Bundle Size:** If tokens add overhead
   - **Mitigation:** Tokens are small (< 5KB), benefits outweigh costs

3. **Token Conflicts:** If different pages need different values
   - **Mitigation:** Use CSS custom properties (can override per page)

---

## END OF DESIGN PLANS

**Summary:**
- 8 comprehensive design plans covering all audit findings
- All plans include: Summary, File-by-file plan, Risks, Rollback strategy
- Ready for implementation after approval

**Next Steps:**
1. Review each plan
2. Approve priority order
3. Say "IMPLEMENT NOW" to begin coding


