# Configuration Guide

This document describes all environment variables and configuration needed for Kivaw Web.

## Quick Start

1. **Copy `.env.example` to `.env`**:
   ```bash
   cp .env.example .env
   ```

2. **Fill in required values** (see below)

3. **For production**: Set the same variables in Vercel Dashboard

---

## Client-Side Environment Variables (Vercel)

These variables are used by the Vite build process and are embedded in the client bundle.

### Required

#### `VITE_SUPABASE_URL`
- **Description**: Your Supabase project URL
- **Local**: `http://localhost:54321` (if using `supabase start`)
- **Production**: `https://YOUR_PROJECT_REF.supabase.co`
- **Where to get**: 
  - Local: Run `supabase status` after `supabase start`
  - Production: Supabase Dashboard → Settings → API → Project URL
- **Vercel Setup**: 
  1. Go to Project → Settings → Environment Variables
  2. Add `VITE_SUPABASE_URL` with your production URL
  3. Select "Production" environment
  4. Redeploy

#### `VITE_SUPABASE_ANON_KEY`
- **Description**: Supabase anonymous/public key (safe for client-side)
- **Local**: Get from `supabase status` after `supabase start`
- **Production**: Supabase Dashboard → Settings → API → anon/public key
- **Vercel Setup**: Same as above, add `VITE_SUPABASE_ANON_KEY`

### Optional (Development Only)

#### `VITE_DEV_ADMIN_EMAILS`
- **Description**: Comma-separated list of emails that get admin access in dev mode
- **Format**: `email1@example.com,email2@example.com`
- **Note**: Only works when `npm run dev` (not in production builds)
- **Use Case**: Quick admin access during local development
- **Vercel Setup**: Not needed (dev-only)

---

## Edge Function Secrets (Supabase)

These are set via Supabase CLI and are NOT client-side variables.

### Required

#### `CRON_SECRET`
- **Description**: Secret key for authenticating internal cron job calls
- **Set via**: 
  ```bash
  supabase secrets set CRON_SECRET=your-random-secret-here
  ```
- **Used by**: 
  - `cron_runner` (orchestrates scheduled jobs)
  - `ingest_rss` (RSS ingestion)
  - `fetch-tmdb`, `fetch-open-library`, `fetch-google-books` (content fetching)
  - `sync-external-content` (content sync)
- **Generate**: Use a random string (e.g., `openssl rand -hex 32`)

### Optional

#### `TMDB_API_KEY`
- **Description**: The Movie Database API key for fetching movie/TV content
- **Get from**: https://www.themoviedb.org/settings/api
- **Set via**: 
  ```bash
  supabase secrets set TMDB_API_KEY=your-tmdb-key-here
  ```
- **Note**: Free tier available

#### `GOOGLE_BOOKS_API_KEY`
- **Description**: Google Books API key (optional, API works without key but has rate limits)
- **Get from**: https://console.cloud.google.com/apis/credentials
- **Set via**: 
  ```bash
  supabase secrets set GOOGLE_BOOKS_API_KEY=your-google-books-key-here
  ```
- **Note**: Optional - API works without key but with lower rate limits

### Auto-Provided (No Setup Needed)

These are automatically injected by Supabase and should NOT be set manually:

- `SUPABASE_URL` - Auto-provided to Edge Functions
- `SUPABASE_ANON_KEY` - Auto-provided to Edge Functions  
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided to Edge Functions

---

## Local Development Setup

1. **Install Supabase CLI** (if not installed):
   ```bash
   npm install -g supabase
   ```

2. **Start local Supabase**:
   ```bash
   supabase start
   ```

3. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

4. **Get local values**:
   ```bash
   supabase status
   ```
   This shows:
   - `API URL` → Use for `VITE_SUPABASE_URL`
   - `anon key` → Use for `VITE_SUPABASE_ANON_KEY`

5. **Update `.env`**:
   ```env
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=your-local-anon-key-here
   ```

6. **Start dev server**:
   ```bash
   npm run dev
   ```

---

## Production Setup (Vercel)

### Step 1: Set Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | Your production anon key | Production |

5. **Important**: Select "Production" environment (or "Production, Preview, Development" if you want it everywhere)

### Step 2: Set Edge Function Secrets

```bash
# In your project directory
supabase secrets set CRON_SECRET=your-random-secret-here

# Optional
supabase secrets set TMDB_API_KEY=your-tmdb-key-here
supabase secrets set GOOGLE_BOOKS_API_KEY=your-google-books-key-here
```

### Step 3: Redeploy

After adding environment variables, trigger a new deployment:

```bash
vercel --prod
```

Or push to your main branch (if auto-deploy is enabled).

---

## Verification

### Local Verification

1. **Check environment variables are loaded**:
   ```bash
   npm run dev
   ```
   Look for console log: `[env] ✅ Configuration loaded`

2. **Test login flow**:
   - Visit `http://localhost:5173/login`
   - Enter email
   - Should redirect to callback and create session

3. **Check for errors**:
   - Open browser console
   - Should see `[supabase] ✅ Connected to: http://localhost:54321`
   - No red errors about missing env vars

### Production Verification

1. **Check build passes**:
   ```bash
   npm run build
   ```
   Should complete without errors about missing env vars

2. **Deploy and check**:
   - Visit your Vercel URL
   - Open browser console
   - Should see `[supabase] ✅ Connected to: https://...`
   - No errors about missing configuration

3. **Test login**:
   - Visit `/login`
   - Should work without errors

---

## Troubleshooting

### "Missing VITE_SUPABASE_URL"

**Local**:
- Check `.env` file exists
- Verify `VITE_SUPABASE_URL` is set
- Restart dev server after adding to `.env`

**Production**:
- Go to Vercel Dashboard → Settings → Environment Variables
- Verify `VITE_SUPABASE_URL` is set for Production environment
- Redeploy after adding

### "Missing VITE_SUPABASE_ANON_KEY"

Same steps as above, but for `VITE_SUPABASE_ANON_KEY`

### Edge Function Errors: "Missing SUPABASE_URL"

- These are auto-provided by Supabase
- If you see this error, check your Edge Function deployment
- Verify you're using `Deno.env.get("SUPABASE_URL")` (not `process.env`)

### Edge Function Errors: "Missing CRON_SECRET"

- Set via: `supabase secrets set CRON_SECRET=your-secret`
- Verify: `supabase secrets list` should show `CRON_SECRET`

---

## Security Notes

1. **Never commit `.env`** - It's in `.gitignore`
2. **Never commit secrets** - Edge Function secrets are stored in Supabase, not in code
3. **`VITE_*` variables are public** - They're embedded in the client bundle
4. **Use `SUPABASE_SERVICE_ROLE_KEY` carefully** - Only in Edge Functions, never in client code
5. **Rotate secrets periodically** - Especially `CRON_SECRET` if compromised

---

## File Reference

- **`.env.example`** - Template for local development
- **`src/lib/env.ts`** - Runtime validation and access
- **`src/lib/supabaseClient.ts`** - Uses validated env vars
- **`supabase/functions/*/index.ts`** - Edge Functions use `Deno.env.get()`

---

## Quick Reference

### Local Development
```bash
# 1. Start Supabase
supabase start

# 2. Copy env template
cp .env.example .env

# 3. Get values
supabase status

# 4. Update .env with values

# 5. Start dev server
npm run dev
```

### Production Deployment
```bash
# 1. Set Vercel env vars (via dashboard)

# 2. Set Supabase secrets
supabase secrets set CRON_SECRET=...

# 3. Deploy
vercel --prod
```

---

**Last Updated**: 2025-01-27
