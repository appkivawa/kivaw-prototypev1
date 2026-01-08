-- ============================================================
-- Master Admin Allowlist + Full RBAC System Migration
-- ============================================================
-- This migration creates:
-- 1. admin_allowlist (break-glass admin access)
-- 2. roles table (role definitions)
-- 3. user_roles table (user-role assignments)
-- 4. Helper functions: has_role() and is_admin()
-- 5. RLS policies for all tables
--
-- IMPORTANT: After running this migration, you MUST add yourself
-- to admin_allowlist manually (see bootstrap instructions at bottom)
-- ============================================================

-- ============================================================
-- STEP 1: CREATE TABLES
-- ============================================================

-- 1.1 ADMIN_ALLOWLIST TABLE (break-glass admin access)
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 1.2 ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 1.3 USER_ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

-- ============================================================
-- STEP 2: SEED ROLES
-- ============================================================

INSERT INTO public.roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('it', 'IT Support'),
  ('social_media', 'Social Media Manager'),
  ('operations', 'Operations')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_key ON public.roles(key);

-- ============================================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================================

-- 4.1 has_role(uid, role_key) - Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(check_uid UUID, role_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_has_role_func$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_uid
      AND r.key = role_key
  );
END;
$_has_role_func$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO authenticated;

-- 4.2 is_admin(uid) - Check if user is admin (allowlist OR admin role)
CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_is_admin_func$
BEGIN
  -- Check admin_allowlist first (break-glass access)
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = check_uid) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has 'admin' role
  IF public.has_role(check_uid, 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Legacy: Check admin_users table if it exists (backward compatibility)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_users'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = check_uid) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$_is_admin_func$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: CREATE RLS POLICIES
-- ============================================================

-- 6.1 ROLES TABLE POLICIES
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;

-- Policy: Authenticated users can read all roles
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can insert/update/delete roles
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- 6.2 USER_ROLES TABLE POLICIES
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Policy: Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all user roles
CREATE POLICY "Admins can read all user roles" ON public.user_roles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policy: Only admins can insert/update/delete user roles
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- 6.3 ADMIN_ALLOWLIST TABLE POLICIES
DROP POLICY IF EXISTS "Admins can read admin allowlist" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Admins can manage admin allowlist" ON public.admin_allowlist;

-- Policy: Only admins can read admin allowlist
-- (Users can check if they themselves are admins via is_admin() function)
CREATE POLICY "Admins can read admin allowlist" ON public.admin_allowlist
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policy: Only admins can insert/delete from admin allowlist
-- Note: This creates a chicken-and-egg problem for the first admin.
-- Solution: Use service role key in SQL editor to bootstrap first admin.
CREATE POLICY "Admins can manage admin allowlist" ON public.admin_allowlist
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- STEP 7: BOOTSTRAP INSTRUCTIONS
-- ============================================================
-- 
-- IMPORTANT: After running this migration, you MUST add yourself
-- to admin_allowlist to avoid being locked out.
--
-- Option 1: Using Supabase SQL Editor (Service Role - bypasses RLS)
-- ============================================================
-- Run this query in Supabase SQL Editor (which uses service role):
--
--   INSERT INTO public.admin_allowlist (user_id)
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com';
--
-- Replace 'your-email@example.com' with your actual email address.
--
-- Option 2: Using Supabase CLI (Service Role)
-- ============================================================
-- If you have Supabase CLI set up:
--
--   supabase db execute --sql "
--     INSERT INTO public.admin_allowlist (user_id)
--     SELECT id FROM auth.users WHERE email = 'your-email@example.com';
--   "
--
-- Option 3: Using psql with service role connection
-- ============================================================
-- Connect to your Supabase database with service role credentials
-- and run the INSERT statement from Option 1.
--
-- ============================================================
-- VERIFICATION QUERIES (optional - can be removed)
-- ============================================================
-- After adding yourself to admin_allowlist, verify:
--
--   -- Check if you're an admin
--   SELECT public.is_admin();
--
--   -- List all admins
--   SELECT 
--     u.email,
--     u.id,
--     CASE 
--       WHEN aa.user_id IS NOT NULL THEN 'allowlist'
--       WHEN public.has_role(u.id, 'admin') THEN 'role'
--       ELSE 'none'
--     END as admin_source
--   FROM auth.users u
--   LEFT JOIN public.admin_allowlist aa ON u.id = aa.user_id
--   WHERE public.is_admin(u.id) = true;
--
--   -- List all roles
--   SELECT key, name FROM public.roles ORDER BY key;
--
-- ============================================================
-- END OF MIGRATION
-- ============================================================


