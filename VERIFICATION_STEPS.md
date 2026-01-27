# Verification Steps

## Local Verification

### Step 1: Environment Setup
```bash
# 1. Copy env template
cp .env.example .env

# 2. Start Supabase (if using local)
supabase start

# 3. Get local values
supabase status
# Copy API URL and anon key to .env

# 4. Update .env file
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

### Step 2: Build Test
```bash
# Test TypeScript compilation
npm run typecheck

# Test production build
npm run build

# Should complete without errors
```

### Step 3: Dev Server Test
```bash
# Start dev server
npm run dev

# Expected console output:
# [env] ✅ Configuration loaded: { supabaseUrl: '...', ... }
# [supabase] ✅ Connected to: http://localhost:54321
```

### Step 4: Functional Tests

1. **Visit homepage**:
   - Open `http://localhost:5173/studio`
   - Should load without errors
   - Check browser console - no red errors

2. **Test login flow**:
   - Visit `http://localhost:5173/login`
   - Enter email
   - Click "Send magic link"
   - Should show success message
   - Check email for magic link
   - Click link → should redirect and create session

3. **Test protected routes**:
   - After login, visit `/timeline`
   - Should load feed/explore content
   - Visit `/collection`
   - Should load saved items

4. **Test Edge Functions** (if local Supabase running):
   - Visit `/timeline/explore`
   - Should show content from `explore_feed_v2`
   - Check browser console for any errors

### Step 5: Error Handling Test
```bash
# Temporarily break .env
mv .env .env.backup

# Start dev server
npm run dev

# Expected: Clear error message about missing env vars
# Should NOT show white screen or cryptic errors
```

---

## Production Verification

### Step 1: Pre-Deployment Checks
```bash
# 1. Verify build works
npm run build

# 2. Check TypeScript
npm run typecheck

# 3. Check linting (if configured)
npm run lint
```

### Step 2: Environment Variables Check

**In Vercel Dashboard**:
1. Go to Project → Settings → Environment Variables
2. Verify these exist for **Production**:
   - ✅ `VITE_SUPABASE_URL` (should be production URL, not localhost)
   - ✅ `VITE_SUPABASE_ANON_KEY` (should be production key)

**In Supabase Dashboard**:
1. Go to Project → Settings → API
2. Verify URL matches `VITE_SUPABASE_URL` in Vercel
3. Verify anon key matches `VITE_SUPABASE_ANON_KEY` in Vercel

### Step 3: Deploy
```bash
# Deploy to production
vercel --prod

# Or push to main branch (if auto-deploy enabled)
git push origin main
```

### Step 4: Post-Deployment Verification

1. **Check deployment status**:
   - Vercel Dashboard → Deployments
   - Latest deployment should be "Ready" (green)
   - Click deployment → Check "Build Logs" for errors

2. **Visit production URL**:
   - Open your Vercel URL
   - Should load without white screen
   - Open browser console (F12)
   - Should see: `[supabase] ✅ Connected to: https://...`
   - **No red errors**

3. **Test homepage**:
   - Visit `/studio`
   - Should load navigation and content
   - No console errors

4. **Test login**:
   - Visit `/login`
   - Enter email
   - Should send magic link
   - Click link → should redirect and work

5. **Test protected routes** (after login):
   - Visit `/timeline`
   - Should load feed
   - Visit `/collection`
   - Should load saved items

6. **Test Edge Functions**:
   - Visit `/timeline/explore`
   - Should show content
   - Check Network tab → `explore_feed_v2` should return 200
   - Response should have `items` array

### Step 5: Error Monitoring

**Check Vercel Logs**:
- Vercel Dashboard → Your Project → Logs
- Look for any errors or warnings

**Check Supabase Logs**:
- Supabase Dashboard → Logs → Edge Functions
- Look for errors in `explore_feed_v2`, `social_feed`, etc.

**Check Browser Console**:
- Open production site
- Check console for errors
- Check Network tab for failed requests

---

## Verification Checklist

### Local
- [ ] `.env` file exists and has correct values
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts without errors
- [ ] Console shows `[env] ✅ Configuration loaded`
- [ ] Console shows `[supabase] ✅ Connected to: ...`
- [ ] Login flow works
- [ ] Protected routes work after login
- [ ] Explore feed loads content

### Production
- [ ] Vercel env vars are set (check dashboard)
- [ ] `npm run build` succeeds locally
- [ ] Deployment succeeds in Vercel
- [ ] Production site loads without white screen
- [ ] Console shows `[supabase] ✅ Connected to: https://...`
- [ ] No console errors
- [ ] Login flow works
- [ ] Protected routes work after login
- [ ] Explore feed loads content
- [ ] Edge Functions return 200 status

---

## Common Issues

### Issue: "Missing VITE_SUPABASE_URL"

**Local**:
- Check `.env` file exists
- Verify `VITE_SUPABASE_URL` is set
- Restart dev server

**Production**:
- Check Vercel Dashboard → Environment Variables
- Verify `VITE_SUPABASE_URL` is set for Production
- Redeploy after adding

### Issue: Build Fails

**Check**:
- `npm run typecheck` output
- Vercel build logs
- Missing dependencies in `package.json`

**Fix**:
- Fix TypeScript errors
- Run `npm install` and commit `package-lock.json`
- Redeploy

### Issue: White Screen in Production

**Check**:
- Browser console for errors
- Vercel deployment status
- Environment variables in Vercel

**Fix**:
- See "Missing VITE_SUPABASE_URL" above
- Check for JavaScript errors in console
- Verify build succeeded

### Issue: Edge Functions Return 500

**Check**:
- Supabase Dashboard → Edge Functions → Logs
- Missing secrets: `supabase secrets list`

**Fix**:
- Set missing secrets: `supabase secrets set KEY=value`
- Redeploy Edge Functions if needed

---

**Last Updated**: 2025-01-27
