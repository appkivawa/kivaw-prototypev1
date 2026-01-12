-- ============================================================
-- Fix Roles Table RLS Recursion (FINAL FIX)
-- ============================================================
-- The roles table SELECT policy should be simple and not cause recursion
-- ============================================================

-- Drop ALL existing policies on roles table
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

-- Simple SELECT policy: All authenticated users can read roles
-- This is safe - no recursion because it doesn't check admin status
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT policy: Only admins (via admin_allowlist) can insert
CREATE POLICY "Admins can insert roles" ON public.roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy: Only admins (via admin_allowlist) can update
CREATE POLICY "Admins can update roles" ON public.roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- DELETE policy: Only admins (via admin_allowlist) can delete
CREATE POLICY "Admins can delete roles" ON public.roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );

-- Verify policies
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'roles'
ORDER BY policyname;

-- Test: Try to read roles (should work now)
SELECT id, key, name FROM public.roles ORDER BY key;


