# Deployment Instructions

## Automatic Deployment (Recommended)

If your Vercel project is connected to your GitHub repository, it will **automatically deploy** when you push to `main`. 

Since we just pushed to GitHub, check your Vercel dashboard:
1. Go to https://vercel.com/dashboard
2. Find your `kivaw-web` project
3. Check the "Deployments" tab - you should see a new deployment in progress

## Manual Deployment

If you need to deploy manually, install Vercel CLI:

### Option 1: Install Vercel CLI globally (recommended)
```bash
npm install -g vercel
```

If you get permission errors, try:
```bash
sudo npm install -g vercel
```

### Option 2: Use npx (no installation needed)
```bash
npx vercel --prod
```

### Option 3: Install as dev dependency
```bash
npm install --save-dev vercel
```

Then run:
```bash
npx vercel --prod
```

## First Time Setup

If this is your first time deploying to Vercel:

1. **Login to Vercel:**
   ```bash
   npx vercel login
   ```

2. **Link your project:**
   ```bash
   npx vercel link
   ```
   This will connect your local project to your Vercel project.

3. **Deploy to production:**
   ```bash
   npx vercel --prod
   ```

## Environment Variables

Make sure your Vercel project has these environment variables set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

You can set them in:
- Vercel Dashboard → Your Project → Settings → Environment Variables

## Current Status

✅ Code is pushed to GitHub (`main` branch)
✅ Vercel should auto-deploy if connected
⏳ Check Vercel dashboard for deployment status





