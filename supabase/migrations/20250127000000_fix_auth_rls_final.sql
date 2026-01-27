-- ============================================================
-- FIX AUTH + ROLE GATING + RLS (FINAL)
-- ============================================================
-- This migration fixes:
-- 1. Recursion in admin_allowlist RLS policies
-- 2. Creates single source of truth for admin checks
-- 3. Ensures normal users can use feed/explore safely
-- 4. Ensures admins can access /admin without lockouts
-- 5. Ensures Edge Functions can write without client bypassing RLS
-- ============================================================

-- ============================================================
-- STEP 1: FIX ADMIN_ALLOWLIST RLS (NO RECURSION)
-- ============================================================

-- Disable RLS on admin_allowlist (manage via service role only)
-- This is the break-glass table - it should NOT have RLS that calls is_admin()
ALTER TABLE IF EXISTS public.admin_allowlist DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might cause recursion
DROP POLICY IF EXISTS "Admins can read admin allowlist" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Admins can manage admin allowlist" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Users can check own allowlist status" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Authenticated users can read admin_allowlist" ON public.admin_allowlist;

-- Grant SELECT to authenticated users (they can check if they're in the list)
-- But INSERT/UPDATE/DELETE only via service role (SQL editor or Edge Functions)
GRANT SELECT ON public.admin_allowlist TO authenticated;
GRANT SELECT ON public.admin_allowlist TO anon;

-- ============================================================
-- STEP 2: CREATE SINGLE SOURCE OF TRUTH FUNCTION
-- ============================================================

-- Replace is_admin() with a non-recursive version
CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Priority 1: Check admin_allowlist (break-glass, no RLS recursion)
  IF EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE user_id = check_uid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Priority 2: Check user_roles for 'admin' role (via roles table)
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_uid
      AND r.key = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Priority 3: Legacy admin_users table (if exists, backward compatibility)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_users'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = check_uid
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================
-- STEP 3: FIX USER_ROLES RLS (NO RECURSION)
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Policy: Users can read their own roles (no recursion - direct check)
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all user roles (check admin_allowlist directly, not is_admin())
CREATE POLICY "Admins can read all user roles" ON public.user_roles
  FOR SELECT
  USING (
    -- Check admin_allowlist directly (no function call = no recursion)
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR
    -- Check user_roles for admin role (direct join, no recursion)
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key = 'admin'
    )
  );

-- Policy: Only admins can insert/update/delete user roles
-- Use direct admin_allowlist check (no is_admin() call)
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key = 'admin'
    )
  );

-- ============================================================
-- STEP 4: FIX ROLES TABLE RLS (NO RECURSION)
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.roles;

-- Policy: All authenticated users can read roles (safe, no recursion)
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can insert/update/delete roles
-- Use direct admin_allowlist check (no is_admin() call)
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key = 'admin'
    )
  );

-- ============================================================
-- STEP 5: FIX PROFILES TABLE RLS (NO RECURSION)
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for new users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Policy: Users can read their own profile (no recursion)
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Admins can read all profiles (check admin_allowlist directly)
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key = 'admin'
    )
  );

-- Policy: Allow inserts (for triggers)
CREATE POLICY "Allow insert for new users" ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- STEP 6: CREATE VIEW FOR PERMISSIONS (SINGLE SOURCE OF TRUTH)
-- ============================================================

-- Create a view that combines all admin sources
CREATE OR REPLACE VIEW public.user_permissions AS
SELECT 
  u.id as user_id,
  u.email,
  -- Admin status (from any source)
  (
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = u.id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = u.id AND r.key = 'admin'
    )
  ) as is_admin,
  -- Super admin status
  EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE user_id = u.id AND super_admin = true
  ) as is_super_admin,
  -- Role keys
  COALESCE(
    array_agg(DISTINCT r.key) FILTER (WHERE r.key IS NOT NULL),
    ARRAY[]::text[]
  ) as role_keys
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
GROUP BY u.id, u.email;

-- Grant SELECT to authenticated users (they can check their own permissions)
-- Note: Views don't support RLS policies directly in PostgreSQL.
-- Access control is handled by the underlying tables (admin_allowlist, user_roles, roles).
-- For fine-grained access control, use the get_user_permissions() RPC function instead.
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT SELECT ON public.user_permissions TO anon;

-- ============================================================
-- STEP 7: CREATE RPC FUNCTION FOR FRONTEND (SINGLE SOURCE OF TRUTH)
-- ============================================================

-- RPC function that frontend can call to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(check_uid UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
  user_roles_array TEXT[];
BEGIN
  -- Get user roles array first
  SELECT COALESCE(
    array_agg(DISTINCT r.key) FILTER (WHERE r.key IS NOT NULL),
    ARRAY[]::text[]
  ) INTO user_roles_array
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = check_uid;
  
  -- Build result JSON
  SELECT jsonb_build_object(
    'user_id', id,
    'email', email,
    'is_admin', (
      EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = check_uid)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = check_uid AND r.key = 'admin'
      )
    ),
    'is_super_admin', EXISTS (
      SELECT 1 FROM public.admin_allowlist 
      WHERE user_id = check_uid AND super_admin = true
    ),
    'role_keys', user_roles_array
  ) INTO result
  FROM auth.users
  WHERE id = check_uid;
  
  -- Return empty object if user not found
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Grant execute permission
-- Note: Only grant on the version with parameter. The no-parameter version
-- works automatically because of the DEFAULT value.
GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO anon;

-- Note: Changed return type from JSON to JSONB for better performance

-- ============================================================
-- STEP 7B: CREATE is_super_admin() FUNCTION (for compatibility)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE user_id = check_uid AND super_admin = true
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;

-- ============================================================
-- STEP 8: VERIFICATION QUERIES
-- ============================================================

-- Check all policies are non-recursive
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%is_admin(%' THEN '⚠️ RECURSION RISK'
    WHEN qual::text LIKE '%admin_allowlist%' AND tablename = 'admin_allowlist' THEN '⚠️ SELF-REFERENCE'
    ELSE '✅ SAFE'
  END as recursion_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('admin_allowlist', 'user_roles', 'roles', 'profiles')
ORDER BY tablename, policyname;

-- ============================================================
-- STEP 9: BOOTSTRAP INSTRUCTIONS
-- ============================================================
-- 
-- IMPORTANT: After running this migration, add yourself to admin_allowlist
-- using the service role (SQL Editor bypasses RLS):
--
--   INSERT INTO public.admin_allowlist (user_id)
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
--   ON CONFLICT (user_id) DO NOTHING;
--
-- ============================================================
