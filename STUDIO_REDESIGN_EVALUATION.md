# Studio Redesign Integration Evaluation
**Date:** 2025-01-28  
**Scope:** Architectural analysis (NO CODE CHANGES)  
**Goal:** Evaluate how Studio redesign fits into existing Kivaw architecture

---

## EXECUTIVE SUMMARY

**Status:** Studio redesign is **well-isolated** and can coexist with existing pages, but requires **data source unification** to support "ALL CONTENT" and become a habit-forming daily destination.

**Key Findings:**
- ✅ **CSS isolation:** `studio-` prefix prevents conflicts
- ✅ **Routing strategy:** Coexist at `/studio/*` first, replace later
- ⚠️ **Data source gap:** StudioExplore only queries `external_content_cache` (movies/books), missing RSS/social/podcasts from `feed_items`
- ⚠️ **Feed personalization:** StudioFeed needs `social_feed` Edge Function for scoring, currently only queries raw cache
- ⚠️ **Component sharing:** Navigation, cards, and auth patterns should be unified

**Blockers for "ALL CONTENT":**
1. StudioExplore needs to query `feed_items` + `external_content_cache` + `public_recommendations`
2. Unified content type system needed (RSS items vs movies/books have different schemas)
3. Filter logic needs to handle all content types

**Blockers for Habit-Forming Feed:**
1. StudioFeed needs personalized scoring (`social_feed` Edge Function)
2. Freshness filtering needs to work across all content types
3. Bookmarking/saving system needs to work with Studio UI

---

## 1. VISUAL & LOGICAL CONFLICTS

### 1.1 CSS Conflicts

**Studio CSS (studio.css):**
- Uses `studio-` prefix: `.studio-nav`, `.studio-btn`, `.studio-card`
- Uses `--studio-coral` color tokens
- Uses `--studio-gray-*` neutral tokens

**Existing CSS (theme.css + ui.css):**
- Uses `--accent` (peach #FF9F6B), `--text-primary`, `--bg` tokens
- Uses `.btn`, `.card`, `.navlink` classes (no prefix)
- Uses `--coral-text-*` tokens (Creator Portal)

**Conflict Level: LOW**
- Studio uses prefixed classes, so won't conflict with existing components
- However, **color tokens conflict conceptually**:
  - `--studio-coral` (#F97066) vs `--accent` (#FF9F6B) - slightly different shades
  - Both use coral/peach as primary accent
  - Dark mode tokens may differ

**Recommendation:**
- Keep Studio CSS scoped to `studio-` prefixed classes
- Share color tokens from `theme.css` if possible (alias `--studio-coral` to `--accent`)
- Or keep separate tokens during testing phase

### 1.2 Component Conflicts

**Navigation:**
- Studio: `studio-nav` inline component in each page
- Existing: `TopNav` component used via `AppShell` wrapper
- **Conflict:** Studio pages don't use `AppShell`, so navigation is duplicated

**Theme Context:**
- Studio: Imports `useTheme` from `../theme/ThemeContext`
- Existing: `ThemeContext.tsx` exists in codebase
- **Conflict:** Studio expects theme toggle, but existing pages may not use it

**Auth Patterns:**
- Studio: Direct `supabase.auth.getSession()` in components
- Existing: Uses `useSession` hook + `RequireAuth` wrapper
- **Conflict:** Different auth patterns, Studio doesn't use existing auth hooks

**Recommendation:**
- Create shared `StudioNav` component that wraps `TopNav` with Studio styles
- Or use `AppShell` wrapper but with Studio-specific nav styling
- Align Studio auth with `useSession` hook for consistency

### 1.3 Data Source Conflicts

**StudioExplore.tsx (Current):**
```typescript
// Only queries external_content_cache (movies/books)
supabase
  .from("external_content_cache")
  .select("*")
  .order("fetched_at", { ascending: false })
  .limit(50);
```

**Existing ExploreFeed.tsx (Explore Mode):**
```typescript
// Queries public_recommendations (curated items)
supabase.functions.invoke("explore_feed", ...)
// OR queries explore_items_v1 view (unified view?)
```

**Existing ExploreFeed.tsx (Feed Mode):**
```typescript
// Queries feed_items via social_feed Edge Function
supabase.functions.invoke("social_feed", ...)
// Then queries feed_items directly for sections
supabase.from("feed_items").select(...).limit(1000);
```

**Conflict Level: HIGH**
- StudioExplore only shows movies/books, **missing RSS/social/podcasts**
- StudioFeed only shows external cache, **missing personalized feed_items**
- No connection to `public_recommendations` (curated items)

**Recommendation:**
- StudioExplore needs to query **all three sources**:
  1. `feed_items` (RSS/social/podcasts) - for timely content
  2. `external_content_cache` (movies/books) - for timeless content
  3. `public_recommendations` (curated) - for featured items
- StudioFeed needs `social_feed` Edge Function for personalized scoring

---

## 2. ROUTING STRATEGY

### 2.1 Current Route Structure

**Existing Routes:**
- `/` → `HomePage.tsx`
- `/explore` → `ExploreFeed.tsx` (mode="explore")
- `/feed` → `ExploreFeed.tsx` (mode="feed")
- `/home` → `Home.tsx` (unused?)

**Studio Routes (Proposed):**
- `/studio` → `StudioHome.tsx`
- `/studio/explore` → `StudioExplore.tsx`
- `/studio/feed` → `StudioFeed.tsx`

### 2.2 Recommended Strategy: **Coexist First, Replace Later**

**Phase 1: Coexistence (Testing)**
```
/studio/*     → Studio pages (new design)
/explore      → Existing ExploreFeed
/feed         → Existing ExploreFeed
```

**Phase 2: Gradual Migration (After Testing)**
```
/             → StudioHome (replace HomePage)
/explore      → StudioExplore (replace ExploreFeed explore mode)
/feed         → StudioFeed (replace ExploreFeed feed mode)
/legacy/*     → Keep old pages for rollback
```

**Phase 3: Cleanup (Post-Launch)**
```
Remove old HomePage, ExploreFeed, Feed.tsx, Explore.tsx
```

**Benefits:**
- ✅ No breaking changes during testing
- ✅ A/B testing possible (show Studio to subset of users)
- ✅ Easy rollback if issues found
- ✅ Can iterate Studio without affecting existing pages

**Implementation:**
- Add Studio routes to `App.tsx` as sibling routes (not replacing)
- Keep Studio pages outside `AppShell` wrapper (or create `StudioAppShell`)
- Link between old/new via navigation or feature flag

---

## 3. CSS ISOLATION STRATEGY

### 3.1 Current CSS Architecture

**Global Styles:**
- `index.css` - base reset + design tokens
- `theme.css` - design tokens (peach/coral theme)
- `ui.css` - 7276 lines, massive component library
- `coral.css` - Creator Portal theme

**Page-Specific Styles:**
- `homepage.css`, `explore-feed.css`, `feed.css`, etc.

**Studio CSS:**
- `studio.css` - 1216 lines, complete design system
- Uses `studio-` prefix (good isolation)
- Has its own color tokens (`--studio-coral`, `--studio-gray-*`)

### 3.2 Recommended Strategy: **Scoped with Token Sharing**

**Option A: Fully Scoped (Recommended for Testing)**
```
studio.css
├── studio-* classes only (no global overrides)
├── Uses --studio-* tokens (separate from --accent)
└── Imported per-page (no global import)
```

**Benefits:**
- ✅ Zero conflicts with existing CSS
- ✅ Easy to test side-by-side
- ✅ Can remove Studio CSS without affecting existing pages

**Option B: Shared Tokens (Recommended for Production)**
```
theme.css (shared tokens)
├── --accent (used by both old and Studio)
├── --text-primary (used by both)
└── --bg (used by both)

studio.css (Studio-specific components)
├── Uses --accent (not --studio-coral)
├── studio-* classes only
└── Imports theme.css for tokens
```

**Benefits:**
- ✅ Consistent colors across old/new pages
- ✅ Dark mode works consistently
- ✅ Easier to maintain one token system

**Recommendation:**
- **Start with Option A** (fully scoped) during testing
- **Migrate to Option B** (shared tokens) when replacing old pages
- Keep `studio-` prefix on all classes regardless of token strategy

### 3.3 Component Sharing

**Should Be Shared:**
- `ThemeContext` - Both use theme toggle
- `useSession` hook - Both need auth state
- `Card`, `Button`, `Container` - Basic UI components (but styled differently)
- `Toast` system - Notifications work the same

**Should Be Studio-Only:**
- `StudioNav` - Different navigation design
- `StudioCard`, `StudioRow` - Different card styles
- Studio-specific layouts (3-column vs 2-column)

**Should Be Unified:**
- `StudioExplore` + `ExploreFeed` → Single unified component (eventually)
- `StudioFeed` + `Feed.tsx` → Single unified component (eventually)

**Recommendation:**
- Extract shared components (`Button`, `Card`) to base components
- Create Studio-specific wrappers that apply Studio styles
- Keep Studio pages separate until ready to replace old pages

---

## 4. SUPPORTING "ALL CONTENT" IN STUDIOEXPLORE

### 4.1 Current Limitations

**StudioExplore.tsx currently:**
```typescript
// Only queries external_content_cache (movies/books)
let query = supabase
  .from("external_content_cache")
  .select("*")
  .order("fetched_at", { ascending: false })
  .limit(50);
```

**Missing Content Types:**
- ❌ RSS articles (from `feed_items` table)
- ❌ Social posts (from `feed_items` table)
- ❌ Podcasts (from `feed_items` table)
- ❌ Curated recommendations (from `public_recommendations` table)

### 4.2 Required Changes

**Unified Query Strategy:**

```typescript
// 1. Query feed_items (RSS/social/podcasts)
const { data: feedItems } = await supabase
  .from("feed_items")
  .select("*")
  .eq("is_discoverable", true)
  .order("published_at", { ascending: false })
  .limit(50);

// 2. Query external_content_cache (movies/books)
const { data: cacheItems } = await supabase
  .from("external_content_cache")
  .select("*")
  .order("fetched_at", { ascending: false })
  .limit(50);

// 3. Query public_recommendations (curated)
const { data: recommendations } = await supabase
  .from("public_recommendations")
  .select("*")
  .order("rank", { ascending: false })
  .order("published_at", { ascending: false })
  .limit(20);

// 4. Normalize all to unified FeedItem format
const allItems = [
  ...normalizeFeedItems(feedItems),
  ...normalizeCacheItems(cacheItems),
  ...normalizeRecommendations(recommendations),
];
```

**Content Type Detection:**
```typescript
function detectContentType(item: any): ContentType {
  // feed_items source detection
  if (item.source === "rss") return "news";
  if (item.source === "youtube") return "video";
  if (item.source === "spotify") return "music";
  if (item.source === "podcast") return "podcasts";
  
  // external_content_cache type detection
  if (item.type === "watch") {
    // Check raw data for TV vs Movie vs K-drama
    if (isKoreanContent(item.raw)) return "kdrama";
    if (item.raw.first_air_date) return "tv";
    return "movies";
  }
  if (item.type === "read") return "books";
  
  // public_recommendations type detection
  return item.type as ContentType; // "watch" | "read" | "listen" | "event"
}
```

**Filter Logic:**
```typescript
// Filter by active signals across all content types
const filteredItems = allItems.filter((item) => {
  if (activeSignals.length === 0) return true;
  return activeSignals.includes(item.type);
});
```

**Recommendation:**
- Create `useUnifiedContent` hook that queries all three sources
- Normalize all content to unified `FeedItem` type
- Use existing `sync-queries.ts` K-drama detection logic
- Support all signal toggles: news, social, podcasts, music, video, movies, tv, kdrama, books

---

## 5. MAKING STUDIOFEED HABIT-FORMING

### 5.1 Current Limitations

**StudioFeed.tsx currently:**
```typescript
// Only queries external_content_cache (no personalization)
let query = supabase
  .from("external_content_cache")
  .select("*")
  .order("fetched_at", { ascending: false })
  .limit(30);
```

**Missing Features:**
- ❌ Personalized scoring (uses `social_feed` Edge Function)
- ❌ Freshness filtering (only queries cache, not last 48h)
- ❌ User signals integration (saves, likes, hides)
- ❌ Trending/sections (Fresh, Today, Trending sections)

### 5.2 Required Changes

**Personalized Feed:**

```typescript
// Use social_feed Edge Function for scoring (like existing Feed.tsx)
const { data: feedData } = await supabase.functions.invoke("social_feed", {
  method: "POST",
  body: { limit: 200 },
});

// Feed items with scores
const scoredItems = feedData.feed; // Already scored by Edge Function
```

**Freshness Filtering:**

```typescript
// Filter to last 48 hours (like ExploreFeed.tsx feed mode)
const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

const freshItems = scoredItems.filter((item) => {
  const ts = item.published_at || item.ingested_at;
  if (!ts) return false;
  return new Date(ts) >= fortyEightHoursAgo;
});
```

**Sections (Habit-Forming Pattern):**

```typescript
// Create sections like ExploreFeed.tsx:
const sections = [
  {
    id: "fresh",
    title: "Fresh",
    subtitle: "Last 6 hours",
    items: filterByTime(freshItems, 6),
  },
  {
    id: "today",
    title: "Today",
    subtitle: "Last 24 hours",
    items: filterByTime(freshItems, 24),
  },
  {
    id: "trending",
    title: "Trending",
    subtitle: "Last 48 hours",
    items: filterByScore(freshItems, 48),
  },
];
```

**User Signals Integration:**

```typescript
// Track user interactions (save, like, hide)
// Store in user_signals table
// Use to filter out items user has dismissed
const { data: userSignals } = await supabase
  .from("user_signals")
  .select("recommendation_id, action")
  .eq("user_id", userId);

const excludedIds = new Set(
  userSignals
    .filter((s) => s.action === "hide" || s.action === "pass")
    .map((s) => s.recommendation_id)
);
```

**Habit-Forming Features:**

1. **Daily Fresh Content:**
   - Show "Fresh" section (last 6h) at top
   - Update timestamp ("Updated 5 min ago")
   - Auto-refresh every 30 minutes

2. **Personalization:**
   - Use `social_feed` Edge Function for scoring
   - Filter by user interests (saved signals)
   - Hide dismissed items

3. **Saving/Bookmarking:**
   - "Save" button on each item (like existing FeedPost)
   - Sync to `saved_items` table
   - Show "Saved" indicator

4. **Empty States:**
   - "Your feed is empty" → Link to Explore to add signals
   - "No fresh content" → Show older items

**Recommendation:**
- Copy personalized feed logic from existing `Feed.tsx` / `ExploreFeed.tsx`
- Use `social_feed` Edge Function instead of raw queries
- Add sections (Fresh, Today, Trending) for habit-forming pattern
- Integrate saving/bookmarking (use existing `saveLocal` + `saved_items`)

---

## 6. PERFORMANCE IMPLICATIONS

### 6.1 Current Studio Pages

**StudioExplore.tsx:**
- Queries `external_content_cache` (50 items)
- Client-side filtering (active signals)
- No pagination
- **Performance: GOOD** (small query, fast filtering)

**StudioFeed.tsx:**
- Queries `external_content_cache` (30 items)
- Client-side filtering (focus mode)
- No pagination
- **Performance: GOOD** (small query)

### 6.2 With "ALL CONTENT" Changes

**StudioExplore.tsx (Unified):**
- 3 queries: `feed_items` (50) + `external_content_cache` (50) + `public_recommendations` (20)
- Client-side merging + normalization
- **Performance: MEDIUM** (3 queries, but can parallelize)

**StudioFeed.tsx (Personalized):**
- 1 Edge Function call: `social_feed` (200 items)
- 1 query: `user_signals` (filter dismissed)
- Client-side sectioning + filtering
- **Performance: MEDIUM** (Edge Function adds latency, but optimized server-side)

**Optimization Strategies:**

1. **Parallel Queries:**
```typescript
const [feedItems, cacheItems, recommendations] = await Promise.all([
  supabase.from("feed_items").select(...).limit(50),
  supabase.from("external_content_cache").select(...).limit(50),
  supabase.from("public_recommendations").select(...).limit(20),
]);
```

2. **Pagination:**
```typescript
// Load first 50 items, lazy-load more on scroll
const [items, setItems] = useState<FeedItem[]>([]);
const [hasMore, setHasMore] = useState(true);
```

3. **Caching:**
```typescript
// Cache in localStorage (like existing Feed.tsx)
const FEED_CACHE_KEY = "kivaw_studio_feed_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

4. **Memoization:**
```typescript
// Memoize filtered items (like existing Feed.tsx)
const filteredItems = useMemo(() => {
  return items.filter(...);
}, [items, activeSignals]);
```

**Recommendation:**
- Use parallel queries for "ALL CONTENT" (3 queries at once)
- Add pagination (load 50 at a time, lazy-load more)
- Cache results in localStorage (5-minute TTL)
- Memoize filtering/sorting operations

---

## 7. RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Initial Integration (1-2 days)

1. **Add Studio routes** (`/studio/*`) to `App.tsx`
2. **Copy Studio files** to project (`StudioHome.tsx`, `StudioExplore.tsx`, `StudioFeed.tsx`, `studio.css`)
3. **Test side-by-side** (existing pages vs Studio pages)
4. **Verify CSS isolation** (no conflicts)

### Phase 2: Data Unification (2-3 days)

1. **Create `useUnifiedContent` hook:**
   - Queries `feed_items` + `external_content_cache` + `public_recommendations`
   - Normalizes to unified `FeedItem` type
   - Handles content type detection (K-drama, etc.)

2. **Update StudioExplore:**
   - Use `useUnifiedContent` hook
   - Support all signal toggles (news, social, podcasts, music, video, movies, tv, kdrama, books)
   - Client-side filtering by active signals

3. **Update StudioFeed:**
   - Use `social_feed` Edge Function (like existing Feed.tsx)
   - Add sections (Fresh, Today, Trending)
   - Integrate user signals (filter dismissed items)

### Phase 3: Component Sharing (1-2 days)

1. **Extract shared components:**
   - `Button`, `Card`, `Container` (base components)
   - `useSession` hook alignment
   - `ThemeContext` integration

2. **Create Studio wrappers:**
   - `StudioButton` (wraps `Button` with Studio styles)
   - `StudioCard` (wraps `Card` with Studio styles)
   - `StudioNav` (wraps `TopNav` with Studio styles)

### Phase 4: Testing & Refinement (2-3 days)

1. **A/B testing** (show Studio to subset of users)
2. **Performance testing** (query optimization, caching)
3. **UX testing** (habit-forming patterns, navigation)

### Phase 5: Migration (1 day)

1. **Replace routes:**
   - `/` → `StudioHome`
   - `/explore` → `StudioExplore`
   - `/feed` → `StudioFeed`

2. **Remove old pages** (or move to `/legacy/*`)

---

## 8. RISKS & MITIGATION

### 8.1 CSS Conflicts

**Risk:** Studio CSS may override existing styles if not properly scoped.

**Mitigation:**
- Use `studio-` prefix on all classes
- Import `studio.css` only in Studio pages (not globally)
- Test side-by-side before replacing routes

### 8.2 Data Source Performance

**Risk:** 3 queries (feed_items + external_content_cache + public_recommendations) may be slow.

**Mitigation:**
- Use `Promise.all` for parallel queries
- Add pagination (load 50 at a time)
- Cache results in localStorage
- Monitor query performance in production

### 8.3 User Migration

**Risk:** Users may be confused by design change when replacing routes.

**Mitigation:**
- A/B test first (show Studio to 10% of users)
- Keep old pages at `/legacy/*` for rollback
- Announce changes via in-app notifications

---

## 9. SUMMARY

**Studio Redesign Status:**
- ✅ **Well-isolated:** `studio-` prefix prevents CSS conflicts
- ✅ **Coexist-ready:** Can run at `/studio/*` alongside existing pages
- ⚠️ **Data source gap:** Needs unified content querying for "ALL CONTENT"
- ⚠️ **Personalization gap:** Needs `social_feed` Edge Function for habit-forming feed

**Recommendations:**
1. **Start coexisting:** Add `/studio/*` routes, test side-by-side
2. **Unify data sources:** Create `useUnifiedContent` hook for all content types
3. **Add personalization:** Use `social_feed` Edge Function for StudioFeed
4. **Share components:** Extract base components, create Studio wrappers
5. **Migrate gradually:** A/B test, then replace routes when ready

**Effort Estimate:**
- Initial integration: 1-2 days
- Data unification: 2-3 days
- Component sharing: 1-2 days
- Testing & migration: 3-4 days
- **Total: 7-11 days**

---

**Next Steps:** Wait for approval, then proceed with Phase 1 (initial integration) to test Studio pages side-by-side with existing pages.


