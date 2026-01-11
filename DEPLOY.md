# Deployment Guide - KIVAW Web

## Option 1: Deploy to Vercel (Recommended)

### Prerequisites
1. Install Vercel CLI (if not installed):
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

### Deploy Steps

1. **Build and deploy:**
   ```bash
   vercel --prod
   ```

2. **Or deploy without build (Vercel will build for you):**
   ```bash
   vercel
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - Go to your project settings in Vercel
   - Navigate to "Environment Variables"
   - Add:
     - `VITE_SUPABASE_URL` = your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

### Alternative: Skip Type Checking During Build

If TypeScript errors are blocking deployment, temporarily modify `package.json`:

```json
{
  "scripts": {
    "build": "vite build --mode production"
  }
}
```

And update `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Skip type checking during build for faster deploys
    // Type checking still happens in dev via tsc
  }
})
```

## Option 2: Deploy via Vercel Dashboard

1. Push code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy automatically on push

## Option 3: Build Locally and Deploy

1. Build the project:
   ```bash
   npm run build
   ```
   This creates a `dist/` folder

2. Deploy the `dist/` folder to any static hosting:
   - Netlify
   - Cloudflare Pages
   - AWS S3 + CloudFront
   - GitHub Pages

## Current Build Issues

There are some TypeScript warnings in existing admin/auth files. These are mostly:
- Unused variable warnings (TS6133) - won't block deployment
- Type mismatches in admin components - may need fixes

To deploy now:
- **Option A**: Use `vite build` without TypeScript check (see above)
- **Option B**: Fix the TypeScript errors first
- **Option C**: Deploy via Vercel dashboard (handles builds better)

## Environment Variables Needed

Make sure these are set in your deployment platform:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Post-Deployment Checklist

- [ ] Verify environment variables are set
- [ ] Test authentication flow
- [ ] Test recommendation engine (`/match` route)
- [ ] Test saved activities (`/saved-activities` route)
- [ ] Verify Supabase connection works in production




