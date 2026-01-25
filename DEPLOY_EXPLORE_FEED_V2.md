# Deploy explore_feed_v2 Edge Function

## Prerequisites

1. ✅ Edge Function code is ready: `supabase/functions/explore_feed_v2/index.ts`
2. ✅ Shared CORS helper exists: `supabase/functions/_shared/cors.ts`
3. ⚠️ `explore_items_v2` view must exist (run `CREATE_EXPLORE_ITEMS_V2.sql` first)

## Deployment Steps

### Option 1: Supabase CLI (Recommended)

```bash
# 1. Login to Supabase
supabase login

# 2. Link to your project
supabase link --project-ref pjuueamhdxqdrnxvavwd

# 3. Deploy the function
supabase functions deploy explore_feed_v2
```

### Option 2: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/pjuueamhdxqdrnxvavwd
2. Navigate to **Edge Functions** in the left sidebar
3. Click **Create function** (or find `explore_feed_v2` if it exists)
4. Set function name: `explore_feed_v2`
5. Copy the entire contents from `supabase/functions/explore_feed_v2/index.ts`
6. Paste into the editor
7. Click **Deploy**

## Verification

After deployment, test the function:

```bash
# Smoke test (should return {"ok":true,"fn":"explore_feed_v2","version":"2.0.0"})
curl https://pjuueamhdxqdrnxvavwd.supabase.co/functions/v1/explore_feed_v2

# Test with actual query (movies and books)
curl -X POST https://pjuueamhdxqdrnxvavwd.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 10, "kinds": ["watch", "read"]}'
```

## Function Features

- ✅ Filters by `kinds` (watch, read, listen, etc.)
- ✅ Filters by `providers` (tmdb, open_library, etc.)
- ✅ Default limit: 20 items (clamped 1-50)
- ✅ Cursor-based pagination
- ✅ Orders by: score DESC, created_at DESC
- ✅ CORS enabled for cross-origin requests
- ✅ Anon access supported

## Troubleshooting

- **"Missing SUPABASE_URL or SUPABASE_ANON_KEY"**: These are auto-provided by Supabase, shouldn't happen
- **"Could not find the table 'public.explore_items_v2'"**: Run `CREATE_EXPLORE_ITEMS_V2.sql` first
- **CORS errors**: Function includes CORS headers, check browser console
- **401 Unauthorized**: Make sure you're passing the anon key in Authorization header


