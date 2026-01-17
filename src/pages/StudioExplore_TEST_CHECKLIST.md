# StudioExplore Manual Test Checklist

## Prerequisites

1. **Deploy Edge Function:**
   ```bash
   supabase functions deploy explore_feed_v2
   ```

2. **Verify view exists:**
   ```bash
   # Run migration if not already applied
   supabase db push
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

## Test Checklist

### 1. Basic Load Test
- [ ] Visit `/studio/explore`
- [ ] Page loads without errors
- [ ] Shows loading state initially
- [ ] Content appears (items from feed_items, recommendations, cache)
- [ ] No console errors

### 2. Filter by Kind Test
- [ ] Toggle "Movies" → should show items with `kind: "watch"` (filtered client-side)
- [ ] Toggle "Books" → should show items with `kind: "read"`
- [ ] Toggle "News" → should show items with `kind: "rss"`
- [ ] Toggle multiple filters → should show combined results
- [ ] All filters off → should show empty state

### 3. Pagination Test
- [ ] Scroll to bottom or click "Load more" button
- [ ] New items append to existing list
- [ ] "Load more" button appears only if `hasMore: true`
- [ ] "Load more" button disappears when `hasMore: false`
- [ ] No duplicates between pages

### 4. Cache TTL Test
- [ ] Load page (wait for content)
- [ ] Refresh page within 5 minutes
- [ ] Content loads instantly from cache (no network request)
- [ ] After 5+ minutes, cache invalidates (new network request)

### 5. Safe Rendering Test
- [ ] Items with `image_url: null` show placeholder (first letter)
- [ ] Items with `url: null` don't break onClick (no crash)
- [ ] Items with `byline: null` don't show "null" text
- [ ] Items with empty `tags: []` don't break tag rendering

### 6. Filter Changes Reset Pagination
- [ ] Load first page
- [ ] Click "Load more" to get second page
- [ ] Change filter (e.g., toggle "Movies" off)
- [ ] Pagination resets (back to first page)
- [ ] `nextCursor` is reset

### 7. Sort Test
- [ ] Change "Sort" dropdown to "recent"
- [ ] Items reorder by `created_at` DESC
- [ ] Change to "popular" (score)
- [ ] Items reorder by `score` DESC
- [ ] Change to "blended" (featured)
- [ ] Items show featured first (public_recommendations)

### 8. Error Handling Test
- [ ] Stop Edge Function (or invalid URL)
- [ ] Error message appears
- [ ] "Try again" button works
- [ ] No crash (graceful error handling)

### 9. Mixed Content Sources Test
- [ ] Check items have different `id` prefixes:
  - [ ] `feed_items:` - from RSS/news/social
  - [ ] `recommendation:` - from public_recommendations
  - [ ] `cache:` - from external_content_cache
- [ ] All sources render correctly
- [ ] Badges/colors match content type

### 10. Featured/Trending/For You Sections
- [ ] Featured item appears (first item with image)
- [ ] Featured item not duplicated in Trending
- [ ] Trending shows next 5 items
- [ ] For You shows remaining items
- [ ] All sections populate correctly

### 11. Search Query Test (if implemented)
- [ ] Type in search box
- [ ] Items filter by search query (client-side)
- [ ] Search works with active filters
- [ ] Clear search → shows all filtered items

### 12. Empty State Test
- [ ] Toggle all filters off
- [ ] Shows empty state: "No content yet"
- [ ] Message: "Toggle some signals on in the sidebar to see content"

### 13. Refresh Button Test
- [ ] Click "↻ Refresh" button
- [ ] Cache invalidates (bypasses TTL)
- [ ] New data loads
- [ ] Pagination resets

### 14. Network Tab Verification
- [ ] Open DevTools → Network tab
- [ ] Filter: XHR/Fetch
- [ ] Load page
- [ ] Verify `explore_feed_v2` Edge Function called (not `external_content_cache` query)
- [ ] Request body contains: `{ limit, kinds?, sort? }`
- [ ] Response contains: `{ items, nextCursor?, hasMore }`

### 15. Mobile Responsive Test
- [ ] Resize window to mobile (< 900px)
- [ ] Sidebar hides (CSS)
- [ ] Content stacks correctly
- [ ] "Load more" button visible
- [ ] No layout breaks

## Expected Behavior Summary

✅ **Should work:**
- Load content from `explore_feed_v2` Edge Function (not direct table query)
- Filter by kind (movies/tv/kdrama/books/news/social/etc.)
- Pagination with "Load more" button
- Cache for 5 minutes (instant load on refresh)
- Safe rendering (no crashes on null fields)
- Featured/Trending/For You sections populate

❌ **Should NOT happen:**
- Direct `external_content_cache` queries
- Console errors about missing fields
- Duplicate items between pages
- Infinite re-render loops
- Cache not invalidating after 5 minutes

## Rollback Steps

If issues occur:
1. Revert `StudioExplore.tsx` to previous version (query `external_content_cache` directly)
2. Edge Function remains deployed but unused
3. View remains but unused

