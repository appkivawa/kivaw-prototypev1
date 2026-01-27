# "Done Means Done" Checklist

## Phase 1: Critical Fixes (Must Complete First)

### 1.1 Auth Session Loading State
- [ ] **File**: `src/auth/useSession.ts`
- [ ] **Fix**: Ensure `loading` is set to `false` on error (line 18)
- [ ] **Test Local**: Simulate network failure, verify loading stops
- [ ] **Test Prod**: Check browser console for stuck loading states
- [ ] **Validation**: Login flow works, no infinite loading

### 1.2 Environment Variable Validation
- [ ] **File**: `src/lib/supabaseClient.ts`
- [ ] **Fix**: Add dev fallback for missing env vars
- [ ] **Test Local**: Remove `.env`, verify dev fallback works
- [ ] **Test Prod**: Deploy without env vars, verify clear error
- [ ] **Validation**: App loads in dev, clear error in prod if missing

### 1.3 Save Button Functionality
- [ ] **File**: `src/pages/StudioExplore.tsx` (lines 254-320)
- [ ] **Status**: ✅ Already implemented `getContentItemId()`
- [ ] **Test Local**: Save RSS item, TMDB item, book item
- [ ] **Test Prod**: Verify saves appear in Collection page
- [ ] **Validation**: All content types can be saved

### 1.4 Global Error Boundary
- [ ] **File**: `src/App.tsx`
- [ ] **Fix**: Wrap Routes with ErrorBoundary
- [ ] **Test Local**: Throw error in component, verify fallback
- [ ] **Test Prod**: Monitor error tracking
- [ ] **Validation**: No white screen on errors

## Phase 2: TypeScript Errors (Blocking Build)

### 2.1 Card Component Style Prop
- [ ] **Files**: Multiple (see typecheck output)
- [ ] **Fix**: Update Card component to accept `style` prop OR remove style props
- [ ] **Files to Fix**:
  - `src/components/collection/AddItemModal.tsx`
  - `src/admin/components/RSSIngestTrigger.tsx`
  - `src/admin/tabs/Operations.tsx`
  - `src/admin/tabs/RecommendationsPreview.tsx`
  - `src/admin/tabs/Security.tsx`
  - `src/components/explore/ExploreItemCard.tsx`
  - `src/components/feed/FeedItemCard.tsx`
  - `src/components/ui/LoadingSkeleton.tsx`
  - `src/pages/AdminDebug.tsx`
  - `src/pages/ForYou.tsx`
- [ ] **Test**: `npm run typecheck` passes
- [ ] **Validation**: Build succeeds

### 2.2 Unused Variables
- [ ] **Fix**: Remove or use all declared variables
- [ ] **Files**: See typecheck output (TS6133 errors)
- [ ] **Test**: `npm run typecheck` passes
- [ ] **Validation**: Zero unused variable warnings

### 2.3 Missing Functions/Imports
- [ ] **File**: `src/components/collection/AddItemModal.tsx`
- [ ] **Fix**: Add `generateId` function or import from library
- [ ] **Fix**: Fix `showToast` function signature
- [ ] **Test**: `npm run typecheck` passes
- [ ] **Validation**: Component compiles

### 2.4 Type Mismatches
- [ ] **File**: `src/components/timeline/TimelineEmptyState.tsx`
- [ ] **Fix**: Add null checks for `data` (lines 71, 72, 80, 81, 90, 91)
- [ ] **Test**: `npm run typecheck` passes
- [ ] **Validation**: No null reference errors

### 2.5 Supabase Query Errors
- [ ] **Files**: `src/components/feed/ContentCard.tsx`, `src/components/feed/FeedPost.tsx`, etc.
- [ ] **Fix**: Remove `.catch()` calls on Supabase queries (use try/catch instead)
- [ ] **Test**: `npm run typecheck` passes
- [ ] **Validation**: Queries work correctly

## Phase 3: Data Fetching Resilience

### 3.1 Edge Function Error Handling
- [ ] **Create**: `src/lib/edgeFunctionClient.ts` with `invokeEdgeFunctionSafe()`
- [ ] **Update**: All Edge Function calls to use wrapper
- [ ] **Files**:
  - `src/pages/StudioExplore.tsx`
  - `src/pages/StudioFeed.tsx`
  - `src/pages/Timeline.tsx`
  - `src/data/providers/externalProviders.ts`
  - `src/data/providers/contentProviders.ts`
- [ ] **Test Local**: Mock Edge Function failure, verify graceful error
- [ ] **Test Prod**: Monitor Edge Function error rates
- [ ] **Validation**: No crashes on Edge Function failures

### 3.2 Null Safety Guards
- [ ] **Files**: All card rendering components
- [ ] **Pattern**: Use optional chaining + fallbacks
- [ ] **Priority Files**:
  - `src/pages/StudioExplore.tsx`
  - `src/pages/StudioFeed.tsx`
  - `src/pages/Collection.tsx`
  - `src/components/collection/SavedItemCard.tsx`
  - `src/components/collection/EchoCard.tsx`
- [ ] **Test Local**: Pass null/undefined data, verify no crashes
- [ ] **Test Prod**: Monitor error logs for null references
- [ ] **Validation**: All cards render with missing data

### 3.3 API Response Validation
- [ ] **File**: `src/pages/StudioExplore.tsx`
- [ ] **Fix**: Add `validateExploreItem()` runtime type check
- [ ] **Test Local**: Pass invalid data, verify filtering
- [ ] **Test Prod**: Monitor type mismatch errors
- [ ] **Validation**: Invalid items are filtered out

## Phase 4: Route Protection

### 4.1 RequireAuth Race Condition
- [ ] **File**: `src/auth/RequireAuth.tsx`
- [ ] **Fix**: Block render until `loading === false`
- [ ] **Test Local**: Test rapid navigation during auth load
- [ ] **Test Prod**: Monitor unauthorized access attempts
- [ ] **Validation**: No unauthorized access

### 4.2 Route-Level Error Boundaries
- [ ] **File**: `src/App.tsx`
- [ ] **Fix**: Add error boundary per route group
- [ ] **Test Local**: Throw error in route, verify fallback
- [ ] **Test Prod**: Monitor route-level errors
- [ ] **Validation**: Errors don't crash entire app

## Phase 5: Build & Deploy

### 5.1 TypeScript
- [ ] Run `npm run typecheck` → **0 errors**
- [ ] All TS6133 (unused) errors fixed
- [ ] All TS2322 (type mismatch) errors fixed
- [ ] All TS2551 (method doesn't exist) errors fixed

### 5.2 Linting
- [ ] Run `npm run lint` → **0 errors**
- [ ] All ESLint warnings addressed

### 5.3 Build
- [ ] Run `npm run build` → **succeeds**
- [ ] No build warnings
- [ ] `dist/` folder created with assets

### 5.4 Environment Variables
- [ ] **Vercel**: Set `VITE_SUPABASE_URL`
- [ ] **Vercel**: Set `VITE_SUPABASE_ANON_KEY`
- [ ] **Supabase**: Set Edge Function secrets
- [ ] **Validation**: App loads in production

## Phase 6: End-to-End Testing

### 6.1 Auth Flow
- [ ] Visit `/login` → form loads
- [ ] Enter email → magic link sent
- [ ] Click link → redirects to `/auth/callback`
- [ ] Callback → creates session
- [ ] Redirects to protected route
- [ ] **Validation**: Full auth flow works

### 6.2 Public Routes
- [ ] `/studio` → loads
- [ ] `/studio/explore` → loads Explore feed
- [ ] `/creators` → loads
- [ ] **Validation**: All public routes accessible

### 6.3 Protected Routes
- [ ] `/timeline` → loads (if logged in)
- [ ] `/timeline/feed` → loads feed
- [ ] `/timeline/explore` → loads explore
- [ ] `/collection` → loads (if logged in)
- [ ] `/admin` → requires auth + admin role
- [ ] **Validation**: Protection works correctly

### 6.4 Data Operations
- [ ] Save item from Explore → appears in Collection
- [ ] Create echo → appears in Collection
- [ ] Unsave item → removed from Collection
- [ ] Delete echo → removed from Collection
- [ ] **Validation**: All CRUD operations work

### 6.5 Edge Functions
- [ ] Explore feed loads → `explore_feed_v2` works
- [ ] Social feed loads → `social_feed` works
- [ ] **Validation**: All Edge Functions respond

## Phase 7: Production Monitoring

### 7.1 Error Tracking
- [ ] Browser console → no errors
- [ ] Vercel function logs → no errors
- [ ] Supabase logs → no RLS errors
- [ ] **Validation**: Clean error logs

### 7.2 Performance
- [ ] Page load < 3s
- [ ] Edge Function response < 2s
- [ ] **Validation**: Acceptable performance

### 7.3 User Flows
- [ ] New user signup → works
- [ ] Existing user login → works
- [ ] Admin access → works
- [ ] Creator access → works
- [ ] **Validation**: All user types can access app

---

## Completion Criteria

✅ **Done means done when:**
1. `npm run typecheck` → 0 errors
2. `npm run lint` → 0 errors  
3. `npm run build` → succeeds
4. All critical fixes implemented
5. All routes tested and working
6. All data operations tested and working
7. Production deployment successful
8. 24-hour error monitoring shows no critical issues

---

**Last Updated**: 2025-01-27
**Status**: In Progress
