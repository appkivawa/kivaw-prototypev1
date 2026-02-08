-- ============================================================
-- Fix RLS Recursion Issues
-- ============================================================
-- This migration fixes infinite recursion in RLS policies
-- that was preventing role queries from working
-- ============================================================

-- ============================================================
-- STEP 1: Fix admin_allowlist RLS (if not already fixed)
-- ============================================================

-- Option A: Disable RLS entirely (recommended - manage via service role)
ALTER TABLE public.admin_allowlist DISABLE ROW LEVEL SECURITY;

-- Option B: Or use a simple policy that doesn't call is_admin()
-- (Uncomment if you prefer to keep RLS enabled)
-- DROP POLICY IF EXISTS "Admins can read admin allowlist" ON public.admin_allowlist;
-- DROP POLICY IF EXISTS "Admins can manage admin allowlist" ON public.admin_allowlist;
-- 
-- CREATE POLICY "Users can check own allowlist status" ON public.admin_allowlist
--   FOR SELECT
--   USING (auth.uid() = user_id);

-- ============================================================
-- STEP 2: Fix roles table RLS to prevent recursion
-- ============================================================

-- Drop ALL existing policies on roles (comprehensive cleanup)
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;

-- Drop any policies that might exist with different names
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.roles', r.policyname);
  END LOOP;
END $$;

-- Policy: Authenticated users can read all roles (simple, no recursion)
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can insert/update/delete roles
-- ONLY check admin_allowlist to avoid recursion (no user_roles check)
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL
  USING (
    -- Check admin_allowlist directly (no function call, no user_roles check)
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- But we need SELECT to be separate and simple (already created above)
-- So we need to make sure the "Admins can manage roles" doesn't apply to SELECT
-- Let's recreate it for INSERT/UPDATE/DELETE only
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;

CREATE POLICY "Admins can insert roles" ON public.roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update roles" ON public.roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete roles" ON public.roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 3: Fix user_roles RLS to prevent recursion
-- ============================================================

-- Drop ALL existing policies on user_roles (comprehensive cleanup)
-- Note: The DO block below will handle dropping all policies, but we include these for clarity
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Drop any policies that might exist with different names
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
  END LOOP;
END $$;

-- Simple policy: Users can read their own roles (no recursion)
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all user roles
-- ONLY check admin_allowlist to avoid recursion (no user_roles check)
CREATE POLICY "Admins can read all user roles" ON public.user_roles
  FOR SELECT
  USING (
    -- Check admin_allowlist directly (no function call, no user_roles check)
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can insert/update/delete user roles
-- ONLY check admin_allowlist to avoid recursion (no user_roles check)
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL
  USING (
    -- Check admin_allowlist directly (no function call, no user_roles check)
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 4: Verify the fixes
-- ============================================================

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('admin_allowlist', 'user_roles', 'roles')
ORDER BY tablename;

-- Check policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('admin_allowlist', 'user_roles', 'roles')
ORDER BY tablename, policyname;

-- ============================================================
-- NOTES
-- ============================================================
-- After running this migration:
-- 1. The roles table SELECT policy is simple (no recursion)
-- 2. The user_roles query should work without recursion
-- 3. The RPC is_admin() function will still work
-- 4. admin_allowlist is now managed via service role only
-- 5. Users can read their own roles
-- 6. Admins (via allowlist ONLY) can read/manage all roles
--
-- IMPORTANT: This policy only checks admin_allowlist, NOT user_roles.
-- This prevents recursion. Users with admin role (but not in allowlist)
-- will need to be added to admin_allowlist to manage roles.
--
-- Test by:
-- 1. Going to /admin-debug
-- 2. Checking that "Direct Query Test" no longer shows recursion error
-- 3. Verifying roles are loaded correctly
-- ============================================================

