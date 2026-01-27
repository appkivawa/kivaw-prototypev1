# Kivaw App Stabilization Plan

## Executive Summary

This document outlines a systematic approach to stabilize the Vite + React Router + Supabase app for production. The plan prioritizes minimal changes that eliminate whole classes of bugs.

---

## 1. App Architecture Overview

### Entry Points
- **Main Entry**: `src/main.tsx` → `App.tsx`
- **Build Output**: `dist/` (Vite)
- **Deployment**: Vercel (SPA with rewrites)

### Routing Structure
- **Public Routes**: `/login`, `/auth/callback`, `/studio`, `/creators`
- **Protected Routes**: `/timeline`, `/collection`, `/admin/*`, `/creator`, `/team`
- **Nested Routes**: `/timeline/explore`, `/timeline/feed`, `/admin/*` (tabs)
- **Legacy Routes**: `/explore`, `/feed`, `/legacy/explore-feed` (for rollback)

### Auth Flow
1. **Login**: `Login.tsx` → `signInWithOtp()` → email magic link
2. **Callback**: `AuthCallback.tsx` → handles `?code=` and `#access_token=`
3. **Session**: `useSession()` hook → `supabase.auth.getSession()` + `onAuthStateChange`
4. **Profile**: Auto-creates via `ensureProfile()` in callback
5. **Roles**: `useRoles()` → queries `user_roles` + `roles` tables
6. **Guards**: `RequireAuth`, `RequireAdmin`, `RequirePermission`, `RequireCreator`

### Data-Fetching Hot Paths
1. **Explore Feed**: `explore_feed_v2` Edge Function → `explore_items_v2` SQL view
2. **Social Feed**: `social_feed` Edge Function → `feed_items` table
3. **Saved Items**: `saves_v2` table → `fetchSavedIds()`, `saveItem()`, `unsaveItem()`
4. **Echoes**: `echoes` table → `createEcho()`, `listEchoes()`
5. **Content Items**: `content_items` table → `listContentItems()`
6. **External Content**: `fetch-tmdb`, `fetch-open-library`, `fetch-google-books` Edge Functions
7. **RSS Ingestion**: `ingest_rss` Edge Function → `feed_items` table
8. **Cron Jobs**: `cron_runner` Edge Function → orchestrates hourly/daily jobs

---

## 2. Validation Commands

### Required Environment Variables

**Frontend (Vite):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Edge Functions (Supabase Secrets):**
- `CRON_SECRET` - Internal job authentication
- `TMDB_API_KEY` - TMDB API key (optional)
- `GOOGLE_BOOKS_API_KEY` - Google Books API key (optional)
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected by Supabase

**Where Used:**
- `src/lib/supabaseClient.ts` - Frontend client initialization
- `supabase/functions/*/index.ts` - Edge Function secrets
- `supabase/config.toml` - Local development config

### Command Results

```bash
# Note: npm i failed due to sandbox permissions, but dependencies are already installed
# Run these locally:
npm i                    # Install dependencies
npm run typecheck        # TypeScript validation
npm run build            # Production build
npm run lint             # ESLint validation
```

---

## 3. Top 10 Runtime Failure Risks

### 🔴 CRITICAL (Production-Breaking)

1. **Missing Environment Variables**
   - **Risk**: App crashes on load if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing
   - **Current**: Hard error in `supabaseClient.ts` (✅ good)
   - **Issue**: No graceful degradation, no dev fallback
   - **Impact**: White screen on production if env vars not set

2. **Auth Session Race Conditions**
   - **Risk**: `useSession()` returns `loading: true` indefinitely if `getSession()` fails
   - **Current**: Error logged but `loading` never set to `false` on error
   - **Impact**: Infinite loading states, blocked navigation

3. **RLS Policy Failures**
   - **Risk**: Queries fail silently or throw cryptic errors if RLS policies misconfigured
   - **Current**: Many queries don't handle RLS errors gracefully
   - **Impact**: Data not loading, save operations fail silently

4. **Edge Function Invocation Failures**
   - **Risk**: `explore_feed_v2`, `social_feed` failures cause empty feeds
   - **Current**: Some error handling, but not consistent
   - **Impact**: Users see empty states, no error messages

5. **UUID Validation Failures**
   - **Risk**: `saveItem()` rejects prefixed IDs from `explore_feed_v2` (e.g., `feed_items:123`)
   - **Current**: `isValidUUID()` rejects non-UUID formats
   - **Impact**: Save buttons don't work for Explore items

### 🟡 HIGH (User-Impact)

6. **Null/Undefined Data Access**
   - **Risk**: `item.title`, `item.summary`, `item.image_url` accessed without null checks
   - **Current**: Some defensive coding, but inconsistent
   - **Impact**: Runtime errors, broken UI

7. **Route Protection Bypass**
   - **Risk**: `RequireAuth` components may not block navigation during session loading
   - **Current**: Race condition between `loading` and `isAuthed` checks
   - **Impact**: Unauthorized access to protected routes

8. **Content Item ID Mismatch**
   - **Risk**: `explore_feed_v2` returns prefixed IDs (`feed_items:`, `external_content_cache:`), but `saves_v2` expects UUIDs
   - **Current**: `getContentItemId()` helper exists but may fail on edge cases
   - **Impact**: Save operations fail for certain content types

9. **CORS/Network Failures**
   - **Risk**: Edge Function calls fail due to CORS or network issues
   - **Current**: Basic error handling, but no retry logic
   - **Impact**: Intermittent failures, poor UX

10. **Type Mismatches**
    - **Risk**: API responses don't match TypeScript types (e.g., `summary` as object vs string)
    - **Current**: Some type guards, but not comprehensive
    - **Impact**: Runtime errors, broken rendering

---

## 4. Minimal Stabilization Plan

### Phase 1: Critical Fixes (Do First)

#### 1.1 Fix Auth Session Loading State
**File**: `src/auth/useSession.ts`
**Change**: Ensure `loading` is set to `false` even on error
```typescript
// After line 18, add:
if (error) {
  console.warn("[useSession] getSession error:", error);
  setSession(null); // Explicitly set to null
  setLoading(false); // ✅ CRITICAL: Always stop loading
}
```

**Validation**:
- Local: Simulate network failure, verify loading stops
- Prod: Check browser console for stuck loading states

#### 1.2 Add Environment Variable Validation
**File**: `src/lib/supabaseClient.ts`
**Change**: Add dev fallback and better error message
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
  (import.meta.env.DEV ? "http://localhost:54321" : null);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
  (import.meta.env.DEV ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" : null);

if (!supabaseUrl && !import.meta.env.DEV) {
  throw new Error("Missing VITE_SUPABASE_URL. Set in .env or Vercel env vars.");
}
```

**Validation**:
- Local: Remove env vars, verify dev fallback works
- Prod: Deploy without env vars, verify clear error message

#### 1.3 Fix Save Button for Prefixed IDs
**File**: `src/pages/StudioExplore.tsx`
**Change**: Ensure `getContentItemId()` handles all prefixed ID formats
**Status**: ✅ Already implemented (lines 254-320)
**Validation**: Test saving RSS items, TMDB items, books

#### 1.4 Add Global Error Boundary
**File**: `src/App.tsx` (wrap Routes)
**Change**: Add React Error Boundary to catch unhandled errors
```typescript
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Something went wrong</h1>
      <pre>{error.message}</pre>
    </div>
  );
}

// Wrap Routes with ErrorBoundary
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <Routes>...</Routes>
</ErrorBoundary>
```

**Validation**:
- Local: Throw error in component, verify fallback renders
- Prod: Monitor error tracking (Sentry, etc.)

### Phase 2: Data Fetching Resilience

#### 2.1 Standardize Edge Function Error Handling
**Files**: All files calling `supabase.functions.invoke()`
**Pattern**: Create shared wrapper
```typescript
// src/lib/edgeFunctionClient.ts
export async function invokeEdgeFunctionSafe<T>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { retries?: number; timeout?: number }
): Promise<{ data?: T; error?: string }> {
  // Implementation with retry logic, timeout, error normalization
}
```

**Files to Update**:
- `src/pages/StudioExplore.tsx` (line ~180)
- `src/pages/StudioFeed.tsx`
- `src/data/providers/externalProviders.ts`
- `src/data/providers/contentProviders.ts`

**Validation**:
- Local: Mock Edge Function failure, verify graceful error
- Prod: Monitor Edge Function error rates

#### 2.2 Add Null Safety Guards
**Files**: All components rendering `item.title`, `item.summary`, etc.
**Pattern**: Use optional chaining + fallbacks
```typescript
// Instead of: item.title
// Use: item?.title || "Untitled"

// Instead of: item.summary.length
// Use: item?.summary?.length || 0
```

**High-Priority Files**:
- `src/pages/StudioExplore.tsx` (card rendering)
- `src/pages/StudioFeed.tsx`
- `src/pages/Collection.tsx`
- `src/components/collection/SavedItemCard.tsx`

**Validation**:
- Local: Pass null/undefined data, verify no crashes
- Prod: Monitor error logs for null reference errors

### Phase 3: Route Protection Hardening

#### 3.1 Fix RequireAuth Race Condition
**File**: `src/auth/RequireAuth.tsx`
**Change**: Block render until `loading === false`
```typescript
if (loading) {
  return <div>Loading...</div>; // Don't render children during load
}
if (!isAuthed) {
  // Redirect logic
}
```

**Validation**:
- Local: Test rapid navigation during auth load
- Prod: Monitor unauthorized access attempts

#### 3.2 Add Route-Level Error Handling
**File**: `src/App.tsx`
**Change**: Wrap each Route with error boundary
**Validation**: Test error scenarios per route

### Phase 4: Type Safety

#### 4.1 Add Runtime Type Validation
**File**: `src/pages/StudioExplore.tsx` (cleanExploreItems)
**Change**: Validate API response shape before use
```typescript
function validateExploreItem(item: any): item is UnifiedContentItem {
  return (
    typeof item.id === "string" &&
    typeof item.kind === "string" &&
    // ... other validations
  );
}
```

**Validation**:
- Local: Pass invalid data, verify filtering
- Prod: Monitor type mismatch errors

---

## 5. "Done Means Done" Checklist

### Critical Fixes
- [ ] Fix `useSession()` loading state on error
- [ ] Add environment variable validation with dev fallback
- [ ] Verify save button works for all content types (RSS, TMDB, books)
- [ ] Add global Error Boundary
- [ ] Test auth flow end-to-end (login → callback → protected route)

### Data Fetching
- [ ] Create `invokeEdgeFunctionSafe()` wrapper
- [ ] Update all Edge Function calls to use wrapper
- [ ] Add null safety guards to all card rendering
- [ ] Test Explore feed with network failures
- [ ] Test Social feed with network failures

### Route Protection
- [ ] Fix `RequireAuth` race condition
- [ ] Test rapid navigation during auth
- [ ] Verify admin routes are protected
- [ ] Verify creator routes are protected

### Type Safety
- [ ] Add runtime validation for `UnifiedContentItem`
- [ ] Add runtime validation for API responses
- [ ] Fix all TypeScript strict mode errors
- [ ] Run `npm run typecheck` with zero errors

### Testing & Validation
- [ ] Run `npm run build` successfully
- [ ] Run `npm run lint` with zero errors
- [ ] Test save/unsave operations
- [ ] Test echo creation
- [ ] Test Explore feed loading
- [ ] Test Timeline feed loading
- [ ] Test Collection page loading
- [ ] Test admin panel access
- [ ] Deploy to staging and verify all routes work
- [ ] Monitor production error logs for 24 hours

---

## 6. Production Validation Steps

### Pre-Deployment
1. Run `npm run typecheck` → must pass
2. Run `npm run lint` → must pass
3. Run `npm run build` → must succeed
4. Test locally: `npm run dev` → verify all routes load
5. Check env vars in Vercel dashboard

### Post-Deployment
1. Visit `/studio` → should load
2. Visit `/login` → should work
3. Login → should redirect correctly
4. Visit `/timeline` → should load feed
5. Visit `/collection` → should load (if logged in)
6. Visit `/admin` → should require auth
7. Check browser console → no errors
8. Check Vercel function logs → no errors
9. Check Supabase logs → no RLS errors

---

## 7. Monitoring & Alerts

### Key Metrics to Track
- Edge Function error rate
- Auth callback failures
- RLS policy violations
- Null reference errors
- Route protection bypasses

### Recommended Tools
- Vercel Analytics (deployment health)
- Supabase Dashboard (database errors)
- Browser console errors (client-side)
- Sentry (optional, for error tracking)

---

## Next Steps

1. **Immediate**: Fix Phase 1 critical issues
2. **This Week**: Complete Phase 2 data fetching resilience
3. **Next Week**: Complete Phase 3 route protection
4. **Ongoing**: Monitor production errors and iterate

---

**Last Updated**: 2025-01-27
**Status**: Draft - Awaiting validation command results
