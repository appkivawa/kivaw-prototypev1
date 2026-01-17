# Routing Refactor Verification Checklist

## Summary

Refactored routing to remove duplication and stop using the 2081-line `ExploreFeed.tsx`.

**Before:**
- `/explore` → `ExploreFeed.tsx` (2081 lines)
- `/feed` → `ExploreFeed.tsx` (2081 lines)

**After:**
- `/explore` → `ExplorePage.tsx` (uses `explore_feed_v2`)
- `/feed` → `FeedPage.tsx` (uses `social_feed`)
- `/legacy/explore-feed` → `ExploreFeedLegacy.tsx` (rollback route)

**Files Changed:**
- ✅ Created: `src/pages/ExplorePage.tsx`
- ✅ Created: `src/pages/FeedPage.tsx`
- ✅ Moved: `src/pages/ExploreFeed.tsx` → `src/pages/legacy/ExploreFeedLegacy.tsx`
- ✅ Updated: `src/App.tsx` (routes)

---

## Verification Checklist

### 1. New Pages Load Correctly

- [ ] Visit `/explore`
  - [ ] Page loads without errors
  - [ ] Shows content from `explore_feed_v2`
  - [ ] No console errors

- [ ] Visit `/feed`
  - [ ] Page loads without errors
  - [ ] Shows sections: Fresh (6h), Today (24h), Trending (48h)
  - [ ] Content from `social_feed`
  - [ ] Save button works
  - [ ] No console errors

### 2. Legacy Route Works (Rollback)

- [ ] Visit `/legacy/explore-feed`
  - [ ] Old ExploreFeed.tsx loads
  - [ ] All features still work
  - [ ] No console errors

### 3. Edge Functions Called Correctly

- [ ] Open DevTools → Network tab
- [ ] Visit `/explore`
  - [ ] Verify `explore_feed_v2` Edge Function called
  - [ ] Request body contains: `{ limit, sort?, kinds? }`
  - [ ] Response contains: `{ items, nextCursor?, hasMore }`

- [ ] Visit `/feed`
  - [ ] Verify `social_feed` Edge Function called
  - [ ] Request body contains: `{ limit: 200 }`
  - [ ] Response contains: `{ feed, fresh, today }`

### 4. Studio Pages Unchanged

- [ ] Visit `/studio/explore`
  - [ ] Still works (unchanged)
  - [ ] Uses `explore_feed_v2`

- [ ] Visit `/studio/feed`
  - [ ] Still works (unchanged)
  - [ ] Uses `social_feed`

### 5. Navigation Links Work

- [ ] Check navigation links
  - [ ] Links to `/explore` work
  - [ ] Links to `/feed` work
  - [ ] Redirects from `/events` to `/explore` work

### 6. No Breaking Changes

- [ ] Check for any references to `ExploreFeed` component
  ```bash
  grep -r "ExploreFeed" src/ --exclude-dir=legacy
  ```
  - [ ] Should only find imports/usage in `App.tsx` (legacy route)

- [ ] Check for direct route access
  - [ ] `/explore` works
  - [ ] `/feed` works
  - [ ] `/app` redirects to `/feed` still works

---

## Rollback Steps

If issues occur, you can rollback:

### Option 1: Quick Rollback (Use Legacy Route)

1. Update `App.tsx` routes:
   ```tsx
   // Change back to:
   <Route path="explore" element={<ExploreFeedLegacy />} />
   <Route path="feed" element={<ExploreFeedLegacy />} />
   ```

2. Or redirect to legacy:
   ```tsx
   <Route path="explore" element={<Navigate to="/legacy/explore-feed" replace />} />
   <Route path="feed" element={<Navigate to="/legacy/explore-feed" replace />} />
   ```

### Option 2: Full Rollback (Restore Original)

1. Move `ExploreFeedLegacy.tsx` back:
   ```bash
   mv src/pages/legacy/ExploreFeedLegacy.tsx src/pages/ExploreFeed.tsx
   ```

2. Update `App.tsx`:
   ```tsx
   import ExploreFeed from "./pages/ExploreFeed";
   // ...
   <Route path="explore" element={<ExploreFeed />} />
   <Route path="feed" element={<ExploreFeed />} />
   ```

3. Delete new pages:
   ```bash
   rm src/pages/ExplorePage.tsx
   rm src/pages/FeedPage.tsx
   ```

---

## Testing Commands

### Verify Routes
```bash
# Check route definitions
grep -A 2 "path=\"explore\"" src/App.tsx
grep -A 2 "path=\"feed\"" src/App.tsx
```

### Check for Breakage
```bash
# Find all references to ExploreFeed (should only be in App.tsx and legacy folder)
grep -r "ExploreFeed" src/ --exclude-dir=node_modules
```

### Verify Edge Functions
```bash
# Check ExplorePage uses explore_feed_v2
grep -A 5 "explore_feed_v2" src/pages/ExplorePage.tsx

# Check FeedPage uses social_feed
grep -A 5 "social_feed" src/pages/FeedPage.tsx
```

---

## Expected Behavior

✅ **Should work:**
- `/explore` shows unified content from `explore_feed_v2`
- `/feed` shows personalized feed from `social_feed` with sections
- `/legacy/explore-feed` shows old ExploreFeed component
- Studio pages unchanged (`/studio/explore`, `/studio/feed`)
- Navigation links work
- No console errors

❌ **Should NOT happen:**
- 404 errors on `/explore` or `/feed`
- Console errors about missing components
- Edge Functions not being called
- Studio pages broken

---

## Summary

✅ **Completed:**
- Created `ExplorePage.tsx` (uses `explore_feed_v2`)
- Created `FeedPage.tsx` (uses `social_feed`)
- Moved `ExploreFeed.tsx` to `legacy/ExploreFeedLegacy.tsx`
- Updated routes in `App.tsx`
- Added legacy route for rollback (`/legacy/explore-feed`)

✅ **Preserved:**
- Studio pages unchanged (`/studio/explore`, `/studio/feed`)
- Legacy file preserved for rollback
- All navigation links continue to work

**Ready for testing!**

