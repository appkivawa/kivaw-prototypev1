# Fix Admin Access - Step by Step Guide

## ✅ Step 1: Fix RLS Recursion (CRITICAL)

The `admin_allowlist` table has infinite recursion in its RLS policy. Fix this in Supabase SQL Editor:

```sql
-- Run this in Supabase SQL Editor (uses service role, bypasses RLS)
-- This disables RLS on admin_allowlist to prevent recursion
ALTER TABLE public.admin_allowlist DISABLE ROW LEVEL SECURITY;
```

**Why:** The RLS policy calls `is_admin()` which checks `admin_allowlist`, creating infinite recursion.

**Alternative:** If you want to keep RLS, use a simpler policy:
```sql
DROP POLICY IF EXISTS "Admins can read admin allowlist" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Admins can manage admin allowlist" ON public.admin_allowlist;

-- Simple policy: Users can only check if they themselves are in the allowlist
CREATE POLICY "Users can check own allowlist status" ON public.admin_allowlist
  FOR SELECT
  USING (auth.uid() = user_id);
```

## ✅ Step 2: Fix RPC Function Parameter

The `is_admin()` function expects `check_uid` parameter. Verify the function signature:

```sql
-- Check the function signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';
```

If it shows `check_uid`, the code is correct. If it shows `uid`, we need to update the function or the code.

## ✅ Step 3: Add Yourself to admin_allowlist (via SQL Editor)

Since RLS is now disabled (or fixed), you can add yourself:

```sql
-- Add yourself to admin_allowlist
INSERT INTO public.admin_allowlist (user_id)
SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me'
ON CONFLICT (user_id) DO NOTHING;

-- Verify it worked
SELECT * FROM admin_allowlist 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me');
```

## ✅ Step 4: Test Admin Access

1. **Clear browser cache/localStorage** (or hard refresh: Cmd+Shift+R)
2. **Go to `/admin-debug`** and verify:
   - Direct query works (no recursion error)
   - RPC `is_admin()` works
   - admin_allowlist check works
   - useRoles shows your admin role

3. **Go to `/admin`** - should work without bypasses

## ✅ Step 5: Remove Temporary Bypasses

Once admin access works properly:

### Remove from `src/auth/useRoles.ts`:
- Remove hardcoded email from `getDevAdminEmails()` function
- Keep the env var check, but remove the hardcoded fallback

### Remove from `src/admin/RequireAdmin.tsx`:
- Comment out or remove the emergency bypass

## ✅ Step 6: Verify Everything Works

1. **Test admin access** - should work via database roles/allowlist
2. **Test role-based access** - IT, social_media, operations roles
3. **Check console** - no more bypass warnings
4. **Test in production** - make sure bypasses don't work there

## Current Status

- ✅ Emergency bypass active (you're in admin)
- ⚠️ RLS recursion needs fixing
- ⚠️ Temporary bypasses need removal after fixing DB

## Next Actions

1. **Fix RLS recursion** (Step 1) - Run the SQL in Supabase
2. **Add yourself to admin_allowlist** (Step 3) - Run the SQL
3. **Test access** (Step 4) - Verify it works
4. **Remove bypasses** (Step 5) - Clean up code

