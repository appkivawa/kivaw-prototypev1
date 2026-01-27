# Environment Variables Audit

## Client-Side Variables (VITE_*)

### Required
- **`VITE_SUPABASE_URL`**
  - **Files**: `src/lib/supabaseClient.ts`
  - **Usage**: Supabase client initialization
  - **Local**: `http://localhost:54321` (if using `supabase start`)
  - **Prod**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)

- **`VITE_SUPABASE_ANON_KEY`**
  - **Files**: `src/lib/supabaseClient.ts`
  - **Usage**: Supabase client initialization
  - **Local**: Anon key from local Supabase instance
  - **Prod**: Production anon key from Supabase dashboard

### Optional (Dev Only)
- **`VITE_DEV_ADMIN_EMAILS`**
  - **Files**: `src/auth/useRoles.ts`, `src/pages/AdminDebug.tsx`
  - **Usage**: Comma-separated list of emails that get admin access in dev mode
  - **Format**: `email1@example.com,email2@example.com`
  - **Note**: Only works when `import.meta.env.DEV === true`

## Edge Function Variables (Deno.env.get)

### Auto-Provided by Supabase
- **`SUPABASE_URL`**
  - **Files**: All Edge Functions
  - **Usage**: Supabase client initialization in Edge Functions
  - **Note**: Automatically injected by Supabase, should not need manual setup

- **`SUPABASE_ANON_KEY`**
  - **Files**: `supabase/functions/explore_feed_v2/index.ts`, `supabase/functions/social_feed/index.ts`
  - **Usage**: Supabase client with RLS
  - **Note**: Automatically injected by Supabase

- **`SUPABASE_SERVICE_ROLE_KEY`**
  - **Files**: `supabase/functions/ingest_rss/index.ts`, `supabase/functions/fetch-tmdb/index.ts`, `supabase/functions/fetch-open-library/index.ts`, `supabase/functions/sync-external-content/index.ts`, `supabase/functions/cron_runner/index.ts`
  - **Usage**: Supabase client with service role (bypasses RLS)
  - **Note**: Automatically injected by Supabase

### Manual Secrets (Set via `supabase secrets set`)
- **`CRON_SECRET`**
  - **Files**: `supabase/functions/cron_runner/index.ts`, `supabase/functions/ingest_rss/index.ts`, `supabase/functions/fetch-tmdb/index.ts`, `supabase/functions/fetch-open-library/index.ts`, `supabase/functions/fetch-google-books/index.ts`, `supabase/functions/sync-external-content/index.ts`
  - **Usage**: Authentication for internal cron job calls
  - **Set via**: `supabase secrets set CRON_SECRET=your-secret-here`

- **`TMDB_API_KEY`** (Optional)
  - **Files**: `supabase/functions/fetch-tmdb/index.ts`
  - **Usage**: TMDB API authentication
  - **Set via**: `supabase secrets set TMDB_API_KEY=your-key-here`

- **`GOOGLE_BOOKS_API_KEY`** (Optional)
  - **Files**: `supabase/functions/fetch-google-books/index.ts`
  - **Usage**: Google Books API authentication
  - **Set via**: `supabase secrets set GOOGLE_BOOKS_API_KEY=your-key-here`

## Server-Side Variables (process.env) - Legacy/Unused

### Files Using process.env (Should be refactored)
- **`pages/api/cron.ts`**: Uses `process.env.CRON_SECRET` (Next.js API route - may not be used)
- **`api/cron.ts`**: Uses `process.env.SUPABASE_URL`, `process.env.VITE_SUPABASE_URL`, `process.env.SUPABASE_ANON_KEY`, `process.env.VITE_SUPABASE_ANON_KEY` (Legacy API route)
- **`scripts/ingest-rss.ts`**: Uses `process.env.VITE_SUPABASE_URL`, `process.env.VITE_SUPABASE_ANON_KEY` (Node.js script - OK)
- **`scripts/dev-ingest-rss.ts`**: Uses `process.env.VITE_SUPABASE_URL`, `process.env.VITE_SUPABASE_ANON_KEY` (Node.js script - OK)

## Summary

### Client-Side (Vercel Environment Variables)
1. `VITE_SUPABASE_URL` - **REQUIRED**
2. `VITE_SUPABASE_ANON_KEY` - **REQUIRED**
3. `VITE_DEV_ADMIN_EMAILS` - **OPTIONAL** (dev only)

### Edge Functions (Supabase Secrets)
1. `CRON_SECRET` - **REQUIRED** (for cron jobs)
2. `TMDB_API_KEY` - **OPTIONAL**
3. `GOOGLE_BOOKS_API_KEY` - **OPTIONAL**

### Auto-Provided (No setup needed)
- `SUPABASE_URL` (Edge Functions)
- `SUPABASE_ANON_KEY` (Edge Functions)
- `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions)
