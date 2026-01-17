# Quick Deployment Guide

## Favicon Updated ✅
The favicon has been updated to match your design: KIVAW with horizontal gradient (reddish-pink to orange-pink) on white background.

## Deploy to Vercel

### Step 1: Install Vercel CLI (if needed)
```bash
npm install -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
```bash
cd /Users/mauvekiara/kivaw-web
vercel --prod
```

### Step 4: Set Environment Variables
After deployment, go to your Vercel project dashboard:
1. Navigate to Settings → Environment Variables
2. Add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
3. Redeploy if needed

## Alternative: Deploy via GitHub

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Update favicon and deploy"
   git push
   ```

2. **Import to Vercel:**
   - Go to vercel.com
   - Click "Add New Project"
   - Import your repository
   - Add environment variables
   - Deploy

## Build Configuration
- ✅ `vercel.json` configured for React Router
- ✅ Build script: `vite build` (no TypeScript checking during build)
- ✅ Favicon: `/favicon.svg` (updated with gradient KIVAW)

## Post-Deployment Checklist
- [ ] Verify favicon appears in browser tab
- [ ] Test homepage in light and dark modes
- [ ] Test all navigation links
- [ ] Verify Supabase connection works
- [ ] Test "How does this work?" button
- [ ] Test detail panel opens correctly







