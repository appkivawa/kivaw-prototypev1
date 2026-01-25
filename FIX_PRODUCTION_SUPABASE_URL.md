# Fix Production Supabase URL

Your production site (`kivaw.com`) is trying to connect to localhost Supabase (`http://127.0.0.1:54321`), which won't work. You need to update your Vercel environment variables.

## The Problem

The console shows:
```
[supabase] connected: http://127.0.0.1:54321
```

But you're on `kivaw.com` (production). This means your Vercel environment variables are set to localhost instead of your production Supabase URL.

## Solution: Update Vercel Environment Variables

### Step 1: Get Your Production Supabase URL

1. Go to https://supabase.com/dashboard
2. Select your **production** project (not local)
3. Go to **Project Settings** → **API**
4. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 2: Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your `kivaw-web` project
3. Go to **Settings** → **Environment Variables**
4. Find `VITE_SUPABASE_URL` and update it to:
   ```
   https://xxxxx.supabase.co
   ```
   (Replace `xxxxx` with your actual project ID)

5. Verify `VITE_SUPABASE_ANON_KEY` is set to your production anon key

6. **Important**: Make sure these are set for **Production** environment (not Preview or Development)

### Step 3: Redeploy

After updating environment variables:

1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a new deployment

### Step 4: Verify

After redeployment:

1. Go to `https://kivaw.com`
2. Open browser console (F12)
3. You should see:
   ```
   [supabase] connected: https://xxxxx.supabase.co
   ```
   (Not `http://127.0.0.1:54321`)

4. Try logging in again
5. The magic link should now work correctly

## Quick Checklist

- [ ] Got production Supabase URL from dashboard
- [ ] Updated `VITE_SUPABASE_URL` in Vercel to production URL
- [ ] Verified `VITE_SUPABASE_ANON_KEY` is production key
- [ ] Environment variables are set for **Production** environment
- [ ] Redeployed the site
- [ ] Verified console shows production Supabase URL
- [ ] Tested login flow

## Why This Happened

When you first set up the project, you probably:
1. Copied environment variables from `.env.local` (which has localhost)
2. Set them in Vercel without changing to production values

Local development uses:
- `VITE_SUPABASE_URL=http://localhost:54321` (or `http://127.0.0.1:54321`)

Production should use:
- `VITE_SUPABASE_URL=https://xxxxx.supabase.co`

## Separate Environments

You should have:
- **Local dev**: `.env.local` with localhost Supabase
- **Vercel Production**: Environment variables with production Supabase
- **Vercel Preview**: Can use production or separate Supabase project

## Still Not Working?

If after updating you still see localhost:

1. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear site data in DevTools

2. **Check Vercel deployment logs:**
   - Go to Vercel → Deployments → Latest → Logs
   - Verify the build used the correct environment variables

3. **Verify environment variable scope:**
   - In Vercel, make sure variables are set for **Production**
   - Not just Preview or Development

4. **Check for multiple projects:**
   - Make sure you're updating the correct Vercel project
   - Verify the domain matches (`kivaw.com`)




