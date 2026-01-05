# Fix Infinite Recursion in admin_allowlist RLS Policy

## Problem

The `admin_allowlist` table has an RLS policy that causes infinite recursion:
```
"infinite recursion detected in policy for relation \"admin_allowlist\""
```

This happens because the policy calls `is_admin()` which checks `admin_allowlist`, creating a circular dependency.

## Solution

Update the RLS policy for `admin_allowlist` to avoid recursion. The policy should NOT call `is_admin()` when checking access to `admin_allowlist` itself.

### Option 1: Use Service Role for admin_allowlist Management (Recommended)

Remove RLS from `admin_allowlist` entirely and manage it only via service role (SQL editor or Edge Functions):

```sql
-- Disable RLS on admin_allowlist (manage via service role only)
ALTER TABLE public.admin_allowlist DISABLE ROW LEVEL SECURITY;

-- Or keep RLS but use a simpler policy that doesn't call is_admin()
DROP POLICY IF EXISTS "Admins can read admin allowlist" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Admins can manage admin allowlist" ON public.admin_allowlist;

-- Simple policy: Only allow reading if user is in the allowlist themselves
CREATE POLICY "Users can check own allowlist status" ON public.admin_allowlist
  FOR SELECT
  USING (auth.uid() = user_id);

-- For INSERT/DELETE, disable RLS or use service role only
-- (These operations should only happen via SQL editor or Edge Functions)
```

### Option 2: Fix the is_admin() Function

Update `is_admin()` to check `admin_allowlist` last and avoid recursion:

```sql
CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check user_roles for admin role FIRST (no recursion)
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_uid AND r.key = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check admin_allowlist LAST (but this will cause recursion if used in policy)
  -- Better to check this via service role only
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = check_uid) THEN
    RETURN TRUE;
  END IF;
  
  -- Legacy: Check admin_users if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = check_uid) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;
```

### Option 3: Temporary Workaround (Quick Fix)

For immediate access, add yourself to `admin_allowlist` using the service role in SQL Editor:

```sql
-- Run this in Supabase SQL Editor (uses service role, bypasses RLS)
INSERT INTO public.admin_allowlist (user_id)
SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me'
ON CONFLICT (user_id) DO NOTHING;
```

Then fix the RLS policy to prevent recursion.

## Recommended Fix

**Best approach:** Disable RLS on `admin_allowlist` and manage it only via service role:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE public.admin_allowlist DISABLE ROW LEVEL SECURITY;
```

This prevents the recursion issue entirely. The `admin_allowlist` should be managed via:
- SQL Editor (service role)
- Edge Functions (service role)
- Not via client-side queries

The `is_admin()` function can still check `admin_allowlist`, but the table itself won't have RLS policies that cause recursion.

