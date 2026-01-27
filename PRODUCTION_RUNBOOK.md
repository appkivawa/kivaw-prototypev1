# Production Runbook: "If Prod Breaks, Check These 3 Things First"

## 🚨 Quick Diagnosis

If production is broken, check these **3 things in order**:

---

## 1️⃣ Environment Variables (Most Common)

### Symptoms
- White screen on load
- Console error: "Missing VITE_SUPABASE_URL" or "Missing VITE_SUPABASE_ANON_KEY"
- App loads but can't connect to Supabase

### How to Check
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Verify these exist for **Production** environment:
   - ✅ `VITE_SUPABASE_URL` 
   - ✅ `VITE_SUPABASE_ANON_KEY`

### How to Fix
1. **If missing**: Add them (get values from Supabase Dashboard → Settings → API)
2. **If wrong**: Update to correct production values
3. **After fixing**: **Redeploy** (Vercel won't auto-redeploy on env var changes)
   ```bash
   vercel --prod
   ```

### Verification
- Visit your production URL
- Open browser console
- Should see: `[supabase] ✅ Connected to: https://...`
- No red errors

---

## 2️⃣ Build Errors

### Symptoms
- Deployment fails in Vercel
- Build logs show TypeScript errors
- Build logs show missing module errors

### How to Check
1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Click on latest failed deployment
3. Check **Build Logs** tab

### How to Fix

**TypeScript Errors**:
```bash
# Test locally first
npm run typecheck

# Fix errors, then deploy
vercel --prod
```

**Missing Dependencies**:
```bash
# Ensure package.json is up to date
npm install

# Commit and push
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

**Environment Variable Errors During Build**:
- See #1 above - env vars must be set before build

### Verification
```bash
# Test build locally
npm run build

# Should complete without errors
```

---

## 3️⃣ Edge Function Secrets

### Symptoms
- Explore feed is empty
- RSS ingestion not working
- Cron jobs failing
- Edge Function returns 500 errors

### How to Check
1. **Check Supabase Dashboard** → **Edge Functions** → **Logs**
2. Look for errors like: "Missing CRON_SECRET" or "Missing SUPABASE_SERVICE_ROLE_KEY"

### How to Fix

**Missing CRON_SECRET**:
```bash
# Generate a random secret
openssl rand -hex 32

# Set it
supabase secrets set CRON_SECRET=your-generated-secret-here

# Verify
supabase secrets list
```

**Missing Service Role Key**:
- This is **auto-provided** by Supabase
- If missing, check your Supabase project settings
- Should NOT be set manually

### Verification
```bash
# Test Edge Function directly
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/explore_feed_v2 \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'

# Should return JSON with items array
```

---

## 🔍 Additional Checks (If Above Don't Work)

### Check 4: Supabase Project Status
- Go to Supabase Dashboard
- Check if project is paused or has billing issues
- Verify project URL matches `VITE_SUPABASE_URL` in Vercel

### Check 5: CORS Issues
- Check browser console for CORS errors
- Verify Supabase project allows your Vercel domain
- Check Edge Function CORS headers

### Check 6: Database Migrations
- Check if recent migrations were applied
- Verify `explore_items_v2` view exists
- Check RLS policies are correct

---

## 📋 Pre-Deployment Checklist

Before deploying, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds locally
- [ ] `.env.example` is up to date
- [ ] Vercel env vars are set (check dashboard)
- [ ] Supabase secrets are set (`supabase secrets list`)
- [ ] Test login flow locally
- [ ] Test Edge Functions locally (if possible)

---

## 🆘 Emergency Rollback

If production is completely broken:

1. **Revert to last working deployment**:
   - Vercel Dashboard → Deployments
   - Find last working deployment
   - Click "..." → "Promote to Production"

2. **Or rollback code**:
   ```bash
   git revert HEAD
   git push
   ```

3. **Check environment variables** (see #1 above)

---

## 📞 Getting Help

If none of the above work:

1. **Check Vercel Build Logs** - Full error messages
2. **Check Supabase Logs** - Edge Function errors
3. **Check Browser Console** - Client-side errors
4. **Check Network Tab** - Failed API calls

**Information to collect**:
- Vercel deployment URL
- Error messages from console
- Screenshot of Vercel env vars (hide values)
- Supabase project URL

---

**Last Updated**: 2025-01-27
