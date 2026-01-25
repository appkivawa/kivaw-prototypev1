# Deployment Steps

## 1. Database Migrations

Run the new SQL migrations in Supabase:

### Option A: Supabase SQL Editor (Recommended)
1. Go to your Supabase Dashboard → SQL Editor
2. Run these migrations in order:
   - `supabase/migrations/create_public_recommendations.sql`
   - `supabase/migrations/create_user_signals.sql`

### Option B: Supabase CLI
```bash
cd /Users/mauvekiara/kivaw-web
supabase db push
```

## 2. Build Frontend

```bash
cd /Users/mauvekiara/kivaw-web
npm run build
```

## 3. Deploy to Vercel

If using Vercel (based on vercel.json):

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel --prod
```

Or push to your connected Git repository (Vercel will auto-deploy).

## 4. Verify

After deployment:
1. Check `/explore` page loads correctly
2. Check `/for-you` page requires auth and shows recommendations
3. Test Save/Pass/Try actions on recommendation cards
4. Verify user_signals table is being populated










