# Deploy explore_feed_v2 - Quick Steps

## ⚠️ Current Status
The Edge Function `explore_feed_v2` is not deployed. The Explore page cannot load content until it's deployed.

## 🚀 Quick Deploy (Choose One Method)

### Method 1: Supabase Dashboard (Easiest - No CLI needed)

1. **Open Dashboard:**
   - Go to: https://supabase.com/dashboard/project/pjuueamhdxqdrnxvavwd/edge-functions

2. **Create/Edit Function:**
   - Click **"Create function"** button (or find `explore_feed_v2` if it exists)
   - Function name: `explore_feed_v2`

3. **Copy Code:**
   - Open: `supabase/functions/explore_feed_v2/index.ts`
   - Copy **ALL** contents (lines 1-189)

4. **Paste & Deploy:**
   - Paste into the Supabase editor
   - Click **"Deploy"** button
   - Wait for deployment to complete (usually 30-60 seconds)

5. **Verify:**
   - Refresh your Explore page
   - Error should disappear
   - Content should load

### Method 2: Supabase CLI

```bash
# 1. Login (opens browser)
supabase login

# 2. Link project
supabase link --project-ref pjuueamhdxqdrnxvavwd

# 3. Deploy
supabase functions deploy explore_feed_v2
```

## ✅ After Deployment

Test the function:
```bash
curl https://pjuueamhdxqdrnxvavwd.supabase.co/functions/v1/explore_feed_v2
```

Expected: `{"ok":true,"fn":"explore_feed_v2","version":"2.0.0"}`

## 📋 Prerequisites

Before deploying, make sure:
- ✅ `explore_items_v2` view exists (run `CREATE_EXPLORE_ITEMS_V2.sql` in SQL Editor)
- ✅ Edge Function code is ready (`supabase/functions/explore_feed_v2/index.ts`)

## 🐛 Troubleshooting

- **"Function not found"**: Make sure you're deploying to the correct project
- **"Missing SUPABASE_URL"**: These are auto-provided, shouldn't happen
- **"explore_items_v2 not found"**: Run the SQL migration first
- **Still seeing error**: Clear browser cache and hard refresh (Cmd+Shift+R)
