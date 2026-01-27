# Environment Setup Guide

## Quick Setup

### Step 1: Create `.env.example` (if it doesn't exist)

Run this in your terminal:

```bash
cat > .env.example << 'EOF'
# .env.example
# This file is for local development environment variables.
# DO NOT COMMIT SENSITIVE PRODUCTION SECRETS TO GIT.

# --- Frontend (Vite) Environment Variables ---
# These are exposed to the client-side code.
# For production, set these in your Vercel project settings.

# Supabase Project URL (e.g., https://your-project-ref.supabase.co)
# For local Supabase, use: http://localhost:54321
# Get from: `supabase status` (local) or Supabase Dashboard → Settings → API (production)
VITE_SUPABASE_URL="http://localhost:54321"

# Supabase Anon Key (public key)
# For local Supabase, get from: `supabase status`
# For production, get from: Supabase Dashboard → Settings → API → anon/public key
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Optional: Comma-separated list of emails for dev admin access override
# This is a development failsafe and should NOT be used in production.
# Example: VITE_DEV_ADMIN_EMAILS="admin@example.com,dev@example.com"
VITE_DEV_ADMIN_EMAILS=""
EOF
```

### Step 2: Copy `.env.example` to `.env`

```bash
cp .env.example .env
```

### Step 3: Get Your Local Supabase Values

If you're using local Supabase:

```bash
supabase status
```

This will show:
- `API URL` → Use for `VITE_SUPABASE_URL`
- `anon key` → Use for `VITE_SUPABASE_ANON_KEY`

### Step 4: Update `.env` with Your Values

Edit `.env` and replace the placeholder values:

```bash
# For local development
VITE_SUPABASE_URL="http://localhost:54321"
VITE_SUPABASE_ANON_KEY="your-actual-anon-key-from-supabase-status"
```

### Step 5: Build (Run Without Comments!)

**Important**: Don't include shell comments in the command line. Run:

```bash
npm run build
```

**NOT**:
```bash
npm run build  # Should pass  # ❌ This causes issues
```

### Step 6: Verify Build

After build succeeds, you should see:
```
✓ built in X.XXs
```

### Step 7: Run Dev Server

```bash
npm run dev
```

You should see:
```
[env] ✅ Configuration loaded
```

---

## Troubleshooting

### Build Error: "Could not resolve entry module '#/index.html'"

**Cause**: Shell comment in command line was parsed incorrectly.

**Fix**: Run commands without comments:
```bash
npm run build
```

### Build Error: "EPERM: operation not permitted, open '.env'"

**Cause**: Sandbox/permission restrictions.

**Fix**: Run the build command directly in your terminal (not through automated tools).

### Missing `.env.example`

**Fix**: Create it using the command in Step 1 above.

---

## Production Setup

For production (Vercel), set these in Vercel Dashboard → Settings → Environment Variables:

- `VITE_SUPABASE_URL` = Your production Supabase URL
- `VITE_SUPABASE_ANON_KEY` = Your production anon key

See `CONFIGURATION.md` for detailed instructions.
