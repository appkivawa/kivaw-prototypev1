# Deploy social_feed Edge Function

The `social_feed` Edge Function has been fixed but needs to be deployed to Supabase.

## Quick Deploy

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy social_feed
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **social_feed**
3. Click **Deploy** or **Redeploy**
4. Wait for deployment to complete

### Option 3: Using GitHub Integration

If your Supabase project is connected to GitHub:
1. Push your changes to GitHub (already done)
2. Supabase will automatically deploy the function
3. Check the **Edge Functions** tab in your dashboard

## Verify Deployment

After deploying, test the function:

```bash
# Test locally (if using Supabase CLI)
supabase functions serve social_feed

# Or test via curl
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/social_feed \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

## What Was Fixed

1. ✅ Removed `Promise.race` timeout logic that caused type errors
2. ✅ Simplified error handling to use direct Supabase queries
3. ✅ Ensured all error paths return proper JSON responses
4. ✅ Added comprehensive error logging

## Troubleshooting

### Error: "no-status" or "non-2xx status code"

**Cause**: Function not deployed or crashed before returning response

**Solution**:
1. Deploy the function using one of the methods above
2. Check Edge Function logs in Supabase dashboard
3. Verify the function file exists at `supabase/functions/social_feed/index.ts`

### Error: "Missing required environment variables"

**Cause**: `SUPABASE_URL` or `SUPABASE_ANON_KEY` not available

**Solution**: These are auto-provided by Supabase. If you see this error:
1. Check that you're deploying to the correct project
2. Verify the function is deployed (not just local)
3. Check Supabase dashboard → Edge Functions → social_feed → Settings

### Error: CORS issues

**Cause**: Origin not allowed

**Solution**: 
1. Set `ALLOWED_ORIGINS` secret in Supabase dashboard
2. Or leave unset to allow all origins (development only)

## Files Changed

- `supabase/functions/social_feed/index.ts` - Fixed timeout logic and error handling
