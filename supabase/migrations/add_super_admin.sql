-- ============================================================
-- Add Super Admin System
-- ============================================================
-- This adds a super_admin flag to admin_allowlist
-- Super admins have ultimate power, above regular admins
-- ============================================================

-- Add super_admin column to admin_allowlist
ALTER TABLE public.admin_allowlist
ADD COLUMN IF NOT EXISTS super_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_super_admin 
ON public.admin_allowlist(super_admin) 
WHERE super_admin = TRUE;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_is_super_admin_func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE user_id = check_uid
      AND super_admin = TRUE
  );
END;
$_is_super_admin_func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Update is_admin() to also check for super_admin
-- (Super admins are also admins, but with extra powers)
CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_is_admin_func$
BEGIN
  -- Check admin_allowlist first (break-glass access)
  -- Super admins are also admins
  IF EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE user_id = check_uid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has 'admin' role
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_uid
      AND r.key = 'admin'
  ) THEN
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

-- ============================================================
-- Make you the super admin
-- ============================================================
-- Replace 'kivawapp@proton.me' with your actual email
UPDATE public.admin_allowlist
SET super_admin = TRUE
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me'
);

-- Verify you're now super admin
SELECT 
  u.email,
  aa.super_admin,
  public.is_super_admin(aa.user_id) as is_super_admin_check,
  public.is_admin(aa.user_id) as is_admin_check
FROM public.admin_allowlist aa
JOIN auth.users u ON aa.user_id = u.id
WHERE u.email = 'kivawapp@proton.me';

-- ============================================================
-- Notes
-- ============================================================
-- Super admins can:
-- - Do everything regular admins can do
-- - Bypass any additional restrictions
-- - Manage other admins (including removing super_admin status)
-- - Access all tables and functions
--
-- Regular admins can:
-- - Manage users and roles
-- - Access admin dashboard
-- - But cannot manage super admins
-- ============================================================

