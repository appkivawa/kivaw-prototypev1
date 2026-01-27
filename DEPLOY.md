# Kivaw Production Deployment Guide

**Single authoritative deployment guide** - Follow this like a recipe for clean production deployments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Preflight Checklist](#preflight-checklist)
3. [Environment Variables](#environment-variables)
4. [Database Migrations](#database-migrations)
5. [Edge Functions Deployment](#edge-functions-deployment)
6. [Vercel Deployment](#vercel-deployment)
7. [Post-Deploy Smoke Test](#post-deploy-smoke-test)
8. [Rollback & Quick Fixes](#rollback--quick-fixes)

---

## Prerequisites

### Required Tools

```bash
# 1. Node.js (v18+)
node --version  # Should show v18.x or higher

# 2. npm
npm --version

# 3. Supabase CLI
npm install -g supabase
supabase --version

# 4. Vercel CLI (optional, can use dashboard)
npm install -g vercel
vercel --version
```

### Required Accounts

- ✅ **Supabase Account** - Project created and active
- ✅ **Vercel Account** - Project connected to Git repository
- ✅ **Git Repository** - Code pushed to GitHub/GitLab/Bitbucket

### Required Access

- ✅ **Supabase Dashboard** - Access to project settings, SQL editor, Edge Functions
- ✅ **Vercel Dashboard** - Access to project settings, environment variables
- ✅ **Supabase CLI** - Logged in and linked to project:
  ```bash
  supabase login
  supabase link --project-ref YOUR_PROJECT_REF
  ```

---

## Preflight Checklist

Run these commands **before deploying** to catch issues early.

### Step 1: Verify Local Build

```bash
# Test TypeScript compilation
npm run typecheck

# Expected: No errors, or only non-blocking warnings
# If errors: Fix them before deploying
```

**Expected Output**:
```
✅ No TypeScript errors (or only warnings)
```

---

### Step 2: Test Production Build

```bash
# Build for production
npm run build

# Expected: Build succeeds, creates dist/ folder
```

**Expected Output**:
```
vite v7.x.x building for production...
✓ built in X.XXs
```

**If Build Fails**:
- Check error message
- Common issues:
  - Missing env vars → See [Environment Variables](#environment-variables)
  - TypeScript errors → Fix in code
  - Missing dependencies → Run `npm install`

---

### Step 3: Verify Environment Variables (Local)

```bash
# Check .env file exists (for local reference)
cat .env.example

# Verify required vars are documented
```

**Expected**: `.env.example` contains:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEV_ADMIN_EMAILS` (optional)

---

### Step 4: Verify Supabase Project Link

```bash
# Check Supabase project is linked
supabase status

# Expected: Shows project info, API URL, anon key
```

**Expected Output**:
```
Project URL: https://YOUR_PROJECT.supabase.co
API URL: https://YOUR_PROJECT.supabase.co
anon key: eyJhbGci...
```

**If Not Linked**:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

---

### Step 5: Verify Edge Function Secrets

```bash
# List all secrets
supabase secrets list

# Expected: Should show at least CRON_SECRET
```

**Expected Output**:
```
CRON_SECRET: [set]
TMDB_API_KEY: [set] (optional)
GOOGLE_BOOKS_API_KEY: [set] (optional)
```

**If Missing CRON_SECRET**:
```bash
# Generate a secure secret
openssl rand -hex 32

# Set it
supabase secrets set CRON_SECRET=your-generated-secret-here
```

---

### Step 6: Verify Critical Database Objects

Run in **Supabase SQL Editor**:

```sql
-- Check explore_items_v2 view exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name = 'explore_items_v2'
) as view_exists;

-- Expected: view_exists = true

-- Check system_health_events table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'system_health_events'
) as table_exists;

-- Expected: table_exists = true

-- Check feed_items table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'feed_items'
) as table_exists;

-- Expected: table_exists = true
```

**If Any Return `false`**: Run missing migrations (see [Database Migrations](#database-migrations))

---

### Step 7: Verify Vercel Environment Variables

**In Vercel Dashboard**:
1. Go to **Project** → **Settings** → **Environment Variables**
2. Verify these exist for **Production**:
   - ✅ `VITE_SUPABASE_URL` (should be production URL, not localhost)
   - ✅ `VITE_SUPABASE_ANON_KEY` (should be production key)

**If Missing**:
- Add them (see [Environment Variables](#environment-variables))
- **Important**: Redeploy after adding env vars

---

## Environment Variables

### Vercel Environment Variables (Client-Side)

**Set in**: Vercel Dashboard → Project → Settings → Environment Variables

**Required**:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Settings → API → anon/public key |

**Optional**:

| Variable | Description | Notes |
|----------|-------------|-------|
| `VITE_DEV_ADMIN_EMAILS` | Comma-separated admin emails | Dev-only, not used in production builds |

**How to Set**:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Click **Add New**
3. Add each variable:
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: `https://YOUR_PROJECT_REF.supabase.co`
   - **Environment**: Select **Production** (or "Production, Preview, Development")
4. Click **Save**
5. **Redeploy** after adding (env vars don't auto-update existing deployments)

**Verification**:
```bash
# After deployment, check browser console on production site
# Should see: [supabase] ✅ Connected to: https://...
# Should NOT see: "Missing VITE_SUPABASE_URL"
```

---

### Supabase Edge Function Secrets

**Set via**: Supabase CLI or Dashboard

**Required**:

| Secret | Description | How to Set |
|--------|-------------|------------|
| `CRON_SECRET` | Secret for internal cron jobs | `supabase secrets set CRON_SECRET=$(openssl rand -hex 32)` |

**Optional**:

| Secret | Description | How to Set |
|--------|-------------|------------|
| `TMDB_API_KEY` | TMDB API key for movies/TV | `supabase secrets set TMDB_API_KEY=your-key` |
| `GOOGLE_BOOKS_API_KEY` | Google Books API key | `supabase secrets set GOOGLE_BOOKS_API_KEY=your-key` |
| `INGEST_SECRET` | Secret for RSS ingestion (if different from CRON_SECRET) | `supabase secrets set INGEST_SECRET=your-secret` |

**Auto-Provided** (DO NOT set manually):
- `SUPABASE_URL` - Auto-injected by Supabase
- `SUPABASE_ANON_KEY` - Auto-injected by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected by Supabase

**How to Set**:
```bash
# Via CLI (recommended)
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)

# Or via Dashboard:
# 1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
# 2. Click "Add Secret"
# 3. Enter name and value
# 4. Click "Save"
```

**Verification**:
```bash
supabase secrets list
# Should show: CRON_SECRET: [set]
```

---

## Database Migrations

### Critical Migrations (Must Run)

These migrations are **required** for the app to function. Run them **in order**:

#### Core Functionality

1. **`20250117025542_create_explore_items_v2_view.sql`**
   - Creates `explore_items_v2` view (used by Explore page)
   - **Status**: ✅ **CRITICAL** - Explore page won't work without this
   - **Dependencies**: Requires `feed_items`, `external_content_cache`, `public_recommendations` tables

2. **`20250127000000_fix_auth_rls_final.sql`**
   - Fixes RLS recursion issues, creates permission functions (`is_admin()`, `is_super_admin()`, `get_user_permissions()`)
   - **Status**: ✅ **CRITICAL** - Admin access won't work without this
   - **Dependencies**: Requires `admin_allowlist`, `user_roles`, `roles` tables

#### Health Monitoring

3. **`20250127000000_create_system_health.sql`**
   - Creates `system_health` table (for cron monitoring)
   - **Status**: ✅ Required (for cron job monitoring)

4. **`20250128000000_create_system_health_events.sql`**
   - Creates `system_health_events` table and `system_health_latest` view
   - Creates `log_health_event()` RPC function
   - **Status**: ✅ Required (for detailed health monitoring)

#### Cron Jobs

5. **`20250127000001_prune_stale_rss.sql`**
   - Creates `prune_stale_rss()` function (used by daily cron)
   - **Status**: ✅ Required (for RSS cleanup cron job)

### Optional Migrations (Run if Needed)

These migrations add features but aren't required for basic functionality:

- `20250120000000_add_onboarded_to_profiles.sql` - Adds onboarding flag
- `20250120000001_add_ingested_at_to_feed_items.sql` - Adds ingestion timestamp
- `20250120000003_create_rss_sources.sql` - Creates RSS sources table
- `20250120000004_seed_rss_sources.sql` - Seeds default RSS feeds
- `20250122000002_create_creator_posts.sql` - Creates creator posts table
- `20250122000003_add_creator_posts_to_explore_items_v2.sql` - Adds creator posts to explore view
- `20250127000001_break_glass_recovery.sql` - Emergency admin recovery procedure (keep for emergencies)

**Note**: Many migrations in the `20260112*` series are legacy/duplicate. Focus on the `202501*` series for core functionality.

### How to Apply Migrations

**Option A: Supabase SQL Editor (Recommended for Production)**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. For each critical migration (in order):
   - Open `supabase/migrations/FILENAME.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**
   - Verify: "Success. No rows returned" or similar success message
   - **If error**: Read error message, fix issue, retry

**Option B: Supabase CLI (For Development)**

```bash
# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase migration up FILENAME
```

**Important**: 
- Run migrations **in order** (by timestamp)
- Don't skip critical migrations
- Verify each migration succeeds before moving to next

### Verification Queries

After applying migrations, run these in **Supabase SQL Editor** to verify:

```sql
-- 1. Verify explore_items_v2 view exists and is queryable
SELECT EXISTS (
  SELECT 1 FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name = 'explore_items_v2'
) as view_exists;
-- Expected: view_exists = true

SELECT COUNT(*) FROM explore_items_v2;
-- Expected: Returns count (may be 0 if no data yet)

-- 2. Verify system_health_events table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'system_health_events'
) as table_exists;
-- Expected: table_exists = true

-- 3. Verify system_health_latest view exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name = 'system_health_latest'
) as view_exists;
-- Expected: view_exists = true

-- 4. Verify log_health_event function exists and works
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name = 'log_health_event'
) as function_exists;
-- Expected: function_exists = true

-- Test the function
SELECT public.log_health_event(
  'test_job',
  'ok',
  123,
  NULL,
  '{}'::jsonb
) as event_id;
-- Expected: Returns UUID

-- 5. Verify permission functions exist
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name = 'is_admin'
) as is_admin_exists;
-- Expected: is_admin_exists = true

SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name = 'is_super_admin'
) as is_super_admin_exists;
-- Expected: is_super_admin_exists = true

-- 6. Clean up test event
DELETE FROM system_health_events WHERE job_name = 'test_job';
```

**If any query returns `false`**: The corresponding migration didn't apply successfully. Re-run that migration.

---

## Edge Functions Deployment

### Required Edge Functions

Deploy these functions in order:

1. **`explore_feed_v2`** - Explore page content
2. **`social_feed`** - Feed page content
3. **`cron_runner`** - Orchestrates scheduled jobs
4. **`ingest_rss`** - RSS feed ingestion
5. **`sync-external-content`** - TMDB movies/TV sync
6. **`fetch-open-library`** - Open Library books
7. **`fetch-google-books`** - Google Books
8. **`fetch-tmdb`** - TMDB movies/TV (standalone)

### Deployment Command

```bash
# Deploy all functions at once
supabase functions deploy explore_feed_v2
supabase functions deploy social_feed
supabase functions deploy cron_runner
supabase functions deploy ingest_rss
supabase functions deploy sync-external-content
supabase functions deploy fetch-open-library
supabase functions deploy fetch-google-books
supabase functions deploy fetch-tmdb
```

**Expected Output** (for each function):
```
Deploying function explore_feed_v2...
Function explore_feed_v2 deployed successfully
```

### Verification

After deploying, test each function:

```bash
# Test explore_feed_v2
curl -X GET https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "apikey: YOUR_ANON_KEY"

# Expected: {"ok": true, "fn": "explore_feed_v2", "version": "..."}

# Test social_feed (requires auth)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/social_feed \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"limit": 10}'

# Expected: {"feed": [...], "fresh": [...], "today": [...]}
```

**Or use the smoke test script**:
```bash
chmod +x test_edge_functions.sh
./test_edge_functions.sh
```

---

## Vercel Deployment

### Step 1: Verify Environment Variables

**Before deploying**, ensure Vercel env vars are set (see [Environment Variables](#environment-variables))

### Step 2: Deploy

**Option A: Via CLI**

```bash
# Deploy to production
vercel --prod

# Expected: Builds and deploys, shows deployment URL
```

**Option B: Via Git Push** (if auto-deploy enabled)

```bash
# Push to main branch
git push origin main

# Vercel will auto-deploy
```

**Option C: Via Vercel Dashboard**

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** → **Create Deployment**
3. Select branch and deploy

### Step 3: Verify Build

**In Vercel Dashboard**:
1. Go to **Deployments**
2. Click on latest deployment
3. Check **Build Logs**:
   - ✅ Should show "Build successful"
   - ❌ No errors about missing env vars
   - ❌ No TypeScript errors

**If Build Fails**:
- Check build logs for specific error
- Common fixes:
  - Missing env vars → Add in Vercel Dashboard, redeploy
  - TypeScript errors → Fix in code, push again
  - Missing dependencies → Run `npm install`, commit `package-lock.json`

---

## Post-Deploy Smoke Test

Run these tests **immediately after deployment** to verify everything works.

### Test 1: App Loads

1. **Visit production URL**: `https://YOUR_APP.vercel.app`
2. **Expected**:
   - ✅ Page loads (no white screen)
   - ✅ Navigation visible
   - ✅ No console errors

3. **Check Browser Console**:
   - Open DevTools (F12) → Console
   - **Expected**: `[supabase] ✅ Connected to: https://...`
   - **Unexpected**: "Missing VITE_SUPABASE_URL" or other errors

---

### Test 2: Login Flow

1. **Visit**: `https://YOUR_APP.vercel.app/login`
2. **Enter email** and click "Send magic link"
3. **Expected**:
   - ✅ Success message appears
   - ✅ Email sent (check inbox)
   - ✅ Click magic link → redirects and creates session

4. **After login**:
   - ✅ Should redirect to `/timeline` or `/studio`
   - ✅ User menu shows email
   - ✅ No console errors

---

### Test 3: Explore Page Loads

1. **Visit**: `https://YOUR_APP.vercel.app/timeline/explore`
2. **Expected**:
   - ✅ Page loads (may show loading state briefly)
   - ✅ Content cards appear (or empty state if no data)
   - ✅ No console errors

3. **Check Network Tab**:
   - Open DevTools → Network
   - Filter: `explore_feed_v2`
   - **Expected**: Request returns `200 OK`
   - **Response**: `{"items": [...], "hasMore": true/false}`

**If Explore Fails**:
- Check console for error message
- Common issues:
  - `explore_feed_v2` not deployed → Deploy function
  - `explore_items_v2` view missing → Run migration
  - 401/403 error → Check JWT/auth

---

### Test 4: Feed Page Loads

1. **After login**, visit: `https://YOUR_APP.vercel.app/timeline/feed`
2. **Expected**:
   - ✅ Page loads
   - ✅ Feed items appear (or empty state)
   - ✅ No console errors

3. **Check Network Tab**:
   - Filter: `social_feed`
   - **Expected**: Request returns `200 OK`
   - **Response**: `{"feed": [...], "fresh": [...], "today": [...]}`

**If Feed Fails**:
- Check console for error
- Common issues:
  - `social_feed` not deployed → Deploy function
  - Auth token missing → Re-login
  - 401 error → Check JWT

---

### Test 5: Admin Health (Admin Only)

1. **Login as admin user**
2. **Visit**: `https://YOUR_APP.vercel.app/admin`
3. **Click**: **Health** tab
4. **Expected**:
   - ✅ Health tab loads
   - ✅ Shows "Supabase Connection" check
   - ✅ Shows "Cron Jobs & Ingest Health" section
   - ✅ Lists all cron jobs with status

5. **Click**: "🔄 Refresh Cron Status"
6. **Expected**:
   - ✅ Cron jobs list updates
   - ✅ Shows last run times
   - ✅ Shows OK/FAILED status

**If Admin Health Fails**:
- Check console for error
- Common issues:
  - Not admin user → Use admin account
  - `system_health_latest` view missing → Run migration
  - RLS blocking → Check RLS policies

---

### Test 6: Collection Page (After Login)

1. **Visit**: `https://YOUR_APP.vercel.app/collection`
2. **Expected**:
   - ✅ Page loads
   - ✅ Shows "Recent Echoes" and "Saved Items" sections
   - ✅ No console errors

---

### Quick Verification Script

A smoke test script is available: `smoke_test.sh`

**Usage**:
```bash
# Set your production URL and anon key
export PROD_URL="https://YOUR_APP.vercel.app"
export ANON_KEY="YOUR_ANON_KEY"

# Run smoke test
./smoke_test.sh "$PROD_URL" "$ANON_KEY"
```

**Or use the Edge Functions test script**:
```bash
# Set environment variables
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_ANON_KEY="YOUR_ANON_KEY"
export SUPABASE_SERVICE_KEY="YOUR_SERVICE_KEY"
export CRON_SECRET="YOUR_CRON_SECRET"

# Run tests
./test_edge_functions.sh
```

---

## Rollback & Quick Fixes

### Emergency Rollback

**If production is completely broken**:

1. **Revert to Last Working Deployment**:
   - Go to **Vercel Dashboard** → **Deployments**
   - Find last working deployment (green checkmark)
   - Click **"..."** → **"Promote to Production"**

2. **Or Rollback Code**:
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Check Environment Variables** (see below)

---

### Quick Fix 1: JWT Signature Errors

**Symptoms**:
- Console error: "JWT signature verification failed"
- 401 errors on authenticated requests
- Login works but subsequent requests fail

**Cause**: Supabase URL or anon key mismatch between Vercel and Supabase

**Fix**:
1. **Check Vercel env vars**:
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Verify `VITE_SUPABASE_URL` matches Supabase project URL
   - Verify `VITE_SUPABASE_ANON_KEY` matches Supabase anon key

2. **Get correct values**:
   - Go to Supabase Dashboard → Settings → API
   - Copy **Project URL** → Use for `VITE_SUPABASE_URL`
   - Copy **anon/public key** → Use for `VITE_SUPABASE_ANON_KEY`

3. **Update and redeploy**:
   - Update env vars in Vercel Dashboard
   - **Redeploy**: `vercel --prod` or push to trigger new deployment

**Verification**:
- Visit production site
- Check console: Should see `[supabase] ✅ Connected to: https://...`
- Try login → Should work

---

### Quick Fix 2: Supabase URL Mismatch

**Symptoms**:
- Console error: "Failed to fetch" or CORS errors
- Network requests to Supabase fail
- App loads but can't connect to database

**Cause**: `VITE_SUPABASE_URL` in Vercel doesn't match actual Supabase project

**Fix**:
1. **Get correct URL**:
   - Supabase Dashboard → Settings → API → **Project URL**
   - Should be: `https://YOUR_PROJECT_REF.supabase.co`

2. **Update in Vercel**:
   - Vercel Dashboard → Settings → Environment Variables
   - Update `VITE_SUPABASE_URL` to correct value
   - **Important**: Must be production URL (not `localhost`)

3. **Redeploy**:
   ```bash
   vercel --prod
   ```

**Verification**:
```bash
# Check production site console
# Should see: [supabase] ✅ Connected to: https://YOUR_PROJECT.supabase.co
```

---

### Quick Fix 3: explore_feed_v2 Not Found

**Symptoms**:
- Explore page shows error: "Edge Function not found" or 404
- Console error: "Failed to send a request to the Edge Function"
- Network request to `explore_feed_v2` returns 404

**Cause**: Edge Function not deployed or wrong function name

**Fix**:
1. **Check if function exists**:
   ```bash
   supabase functions list
   # Should show: explore_feed_v2
   ```

2. **If missing, deploy**:
   ```bash
   supabase functions deploy explore_feed_v2
   ```

3. **Verify deployment**:
   ```bash
   curl -X GET https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
     -H "apikey: YOUR_ANON_KEY"
   # Expected: {"ok": true, "fn": "explore_feed_v2"}
   ```

4. **Check function URL in code**:
   - Verify frontend calls `/functions/v1/explore_feed_v2` (not `/explore_feed_v2`)
   - Check `src/pages/StudioExplore.tsx` or `src/pages/Timeline.tsx`

**Verification**:
- Visit `/timeline/explore` on production
- Should load content (or empty state)
- Network tab shows `explore_feed_v2` returns 200

---

### Quick Fix 4: Missing Database View/Table

**Symptoms**:
- Edge Function returns 500 error
- Console error: "relation 'explore_items_v2' does not exist"
- Admin Health shows database errors

**Cause**: Required migration not applied

**Fix**:
1. **Check what's missing**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT EXISTS (
     SELECT 1 FROM information_schema.views 
     WHERE table_schema = 'public' 
     AND table_name = 'explore_items_v2'
   ) as view_exists;
   ```

2. **Apply missing migration**:
   - Go to Supabase Dashboard → SQL Editor
   - Open `supabase/migrations/20250117025542_create_explore_items_v2_view.sql`
   - Copy contents → Paste in SQL Editor → Run

3. **Verify**:
   ```sql
   SELECT COUNT(*) FROM explore_items_v2;
   -- Should return count (may be 0)
   ```

**Verification**:
- Visit `/timeline/explore` on production
- Should load without errors

---

### Quick Fix 5: Cron Jobs Not Running

**Symptoms**:
- Admin Health shows cron jobs haven't run in > 2 hours
- RSS feeds not updating
- No new content in Explore

**Cause**: pg_cron schedules not configured or CRON_SECRET mismatch

**Fix**:
1. **Check pg_cron schedules**:
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE 'kivaw%';
   -- Should show 3 jobs: kivaw-hourly-rss, kivaw-six-hour-tmdb, kivaw-daily-books
   ```

2. **If missing, configure** (see `SUPABASE_CRON_SETUP.md`):
   ```sql
   -- Run in Supabase SQL Editor
   -- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET_HERE
   SELECT cron.schedule(
     'kivaw-hourly-rss',
     '0 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron_runner',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', 'YOUR_CRON_SECRET_HERE'
       ),
       body := jsonb_build_object('job', 'hourly')
     ) AS request_id;
     $$
   );
   ```

3. **Verify CRON_SECRET matches**:
   ```bash
   supabase secrets list
   # Should show: CRON_SECRET: [set]
   ```
   - Secret in Supabase must match secret in pg_cron SQL

4. **Test manually**:
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cron_runner \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: YOUR_CRON_SECRET" \
     -d '{"job": "hourly"}'
   # Expected: {"ok": true, "job": "hourly", ...}
   ```

**Verification**:
- Wait 1 hour
- Check Admin Health → Cron Jobs section
- Should show recent run for `cron_runner:hourly`

---

## Deployment Sequence (Recipe)

Follow these steps **in order** for a clean deployment:

### Phase 1: Pre-Deployment

```bash
# 1. Verify local build
npm run typecheck
npm run build

# 2. Verify Supabase link
supabase status

# 3. Verify secrets
supabase secrets list

# 4. Verify Vercel env vars (check dashboard)
# Go to: Vercel Dashboard → Settings → Environment Variables
```

---

### Phase 2: Database Migrations

**In Supabase SQL Editor**, run these migrations **in order**:

1. **`20250117025542_create_explore_items_v2_view.sql`**
   - Copy entire file contents → Paste in SQL Editor → Run
   - **Verify**: No errors, view created

2. **`20250127000000_fix_auth_rls_final.sql`**
   - Copy entire file contents → Paste in SQL Editor → Run
   - **Verify**: No errors, functions created

3. **`20250127000000_create_system_health.sql`**
   - Copy entire file contents → Paste in SQL Editor → Run
   - **Verify**: No errors, table created

4. **`20250128000000_create_system_health_events.sql`**
   - Copy entire file contents → Paste in SQL Editor → Run
   - **Verify**: No errors, table and view created

5. **`20250127000001_prune_stale_rss.sql`**
   - Copy entire file contents → Paste in SQL Editor → Run
   - **Verify**: No errors, function created

**After all migrations**, run verification queries (see Database Migrations section)

---

### Phase 3: Edge Functions

```bash
# 1. Deploy all functions
supabase functions deploy explore_feed_v2
supabase functions deploy social_feed
supabase functions deploy cron_runner
supabase functions deploy ingest_rss
supabase functions deploy sync-external-content
supabase functions deploy fetch-open-library
supabase functions deploy fetch-google-books
supabase functions deploy fetch-tmdb

# 2. Verify deployments
supabase functions list
# Should show all 8 functions

# 3. Test critical functions
curl -X GET https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "apikey: YOUR_ANON_KEY"
# Expected: {"ok": true, "fn": "explore_feed_v2"}
```

---

### Phase 4: Vercel Deployment

```bash
# 1. Verify env vars in Vercel Dashboard
# - VITE_SUPABASE_URL (production URL)
# - VITE_SUPABASE_ANON_KEY (production key)

# 2. Deploy
vercel --prod

# 3. Wait for deployment to complete
# Check Vercel Dashboard → Deployments → Build Logs
```

---

### Phase 5: Post-Deploy Verification

```bash
# 1. Visit production URL
# 2. Run smoke tests (see Post-Deploy Smoke Test section)
# 3. Check Admin Health tab (if admin)
# 4. Verify cron jobs are running (wait 1 hour, check Admin Health)
```

---

## Troubleshooting Reference

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing VITE_SUPABASE_URL" | Env var not set in Vercel | Add in Vercel Dashboard, redeploy |
| "JWT signature verification failed" | URL/key mismatch | Verify env vars match Supabase |
| "Edge Function not found" | Function not deployed | Deploy function: `supabase functions deploy <name>` |
| "relation 'explore_items_v2' does not exist" | Migration not applied | Run migration in Supabase SQL Editor |
| "Missing CRON_SECRET" | Secret not set | `supabase secrets set CRON_SECRET=...` |
| White screen on load | Build failed or env vars missing | Check Vercel build logs, verify env vars |

---

## Quick Reference

### Essential Commands

```bash
# Build locally
npm run build

# Deploy to Vercel
vercel --prod

# Deploy Edge Function
supabase functions deploy <function-name>

# List Edge Functions
supabase functions list

# List Secrets
supabase secrets list

# Set Secret
supabase secrets set KEY=value

# Check Supabase Status
supabase status
```

### Essential URLs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **Supabase SQL Editor**: https://app.supabase.com/project/YOUR_PROJECT/sql
- **Vercel Env Vars**: https://vercel.com/YOUR_PROJECT/settings/environment-variables

---

## Support

If deployment fails after following this guide:

1. **Check Vercel Build Logs** - Full error messages
2. **Check Supabase Logs** - Edge Function errors
3. **Check Browser Console** - Client-side errors
4. **Check Network Tab** - Failed API calls

**Information to collect**:
- Vercel deployment URL
- Error messages from console/logs
- Screenshot of Vercel env vars (hide values)
- Supabase project URL
- Edge Function names that are failing

---

## Deployment Checklists

### Migration Checklist

**Before deploying**, ensure these migrations are applied (check in Supabase SQL Editor):

- [ ] `20250117025542_create_explore_items_v2_view.sql` - Explore page view
- [ ] `20250127000000_fix_auth_rls_final.sql` - Admin access functions
- [ ] `20250127000000_create_system_health.sql` - Health monitoring table
- [ ] `20250128000000_create_system_health_events.sql` - Health events table
- [ ] `20250127000001_prune_stale_rss.sql` - RSS cleanup function

**Verification**: Run verification queries (see Database Migrations section)

---

### Edge Functions Checklist

**Before deploying**, ensure these functions are deployed:

- [ ] `explore_feed_v2` - Explore page content
- [ ] `social_feed` - Feed page content
- [ ] `cron_runner` - Scheduled jobs orchestrator
- [ ] `ingest_rss` - RSS ingestion
- [ ] `sync-external-content` - TMDB sync
- [ ] `fetch-open-library` - Open Library books
- [ ] `fetch-google-books` - Google Books
- [ ] `fetch-tmdb` - TMDB movies/TV

**Verification**: `supabase functions list` should show all 8 functions

---

### Environment Variables Checklist

**Before deploying**, ensure these are set:

**Vercel** (Dashboard → Settings → Environment Variables):
- [ ] `VITE_SUPABASE_URL` (production URL)
- [ ] `VITE_SUPABASE_ANON_KEY` (production key)

**Supabase** (CLI or Dashboard → Edge Functions → Secrets):
- [ ] `CRON_SECRET` (required)
- [ ] `TMDB_API_KEY` (optional)
- [ ] `GOOGLE_BOOKS_API_KEY` (optional)

**Verification**: 
- Vercel: Check dashboard
- Supabase: `supabase secrets list`

---

**Last Updated**: 2025-01-28  
**Version**: 1.0
