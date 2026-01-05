# Deploy Edge Functions

## Issue
The Edge Functions were trying to import from `_shared/` which Deno doesn't support. I've inlined all shared code into each function.

## Fixed Functions
1. ✅ `admin-list-users/index.ts` - Inlined shared code, fixed RPC parameter
2. ✅ `admin-invite-user/index.ts` - Inlined shared code, fixed RPC parameter
3. ✅ `admin-set-user-roles/index.ts` - Inlined shared code, fixed RPC parameter

## Deploy Steps

### Option 1: Using Supabase CLI (Recommended)
```bash
# Make sure you're in the project root
cd /Users/mauvekiara/kivaw-web

# Deploy all functions
supabase functions deploy admin-list-users
supabase functions deploy admin-invite-user
supabase functions deploy admin-set-user-roles
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. For each function:
   - Click **Create function** or **Edit** if it exists
   - Copy the entire contents of the function file
   - Paste into the editor
   - Click **Deploy**

## Required Secrets
Make sure these are set in Supabase Dashboard → Settings → Edge Functions → Secrets:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (never expose to client)

## Test After Deployment
1. Go to `/admin` in your app
2. Click on the **Users** tab
3. Should load users without errors

## What Was Fixed
- ✅ Inlined all shared code (no more `_shared/` imports)
- ✅ Fixed RPC parameter: `check_uid` instead of `uid`
- ✅ Fixed role query: uses explicit foreign key join
- ✅ All functions now self-contained

