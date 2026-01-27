-- ============================================================
-- BREAK GLASS RECOVERY PROCEDURE
-- ============================================================
-- Use this if you're locked out of admin access
-- Run in Supabase SQL Editor (uses service role, bypasses RLS)
-- ============================================================

-- Step 1: Find your user ID
-- Replace 'your-email@example.com' with your actual email
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Step 2: Add yourself to admin_allowlist (break-glass access)
-- Replace 'YOUR_USER_ID_HERE' with the ID from Step 1
INSERT INTO public.admin_allowlist (user_id, super_admin)
VALUES ('YOUR_USER_ID_HERE', true)
ON CONFLICT (user_id) 
DO UPDATE SET super_admin = true;

-- Step 3: Verify you're now an admin
SELECT 
  u.email,
  aa.user_id IS NOT NULL as in_allowlist,
  aa.super_admin,
  public.is_admin(u.id) as is_admin_check
FROM auth.users u
LEFT JOIN public.admin_allowlist aa ON u.id = aa.user_id
WHERE u.email = 'your-email@example.com';

-- Step 4: (Optional) Also assign admin role via user_roles
-- First, get the admin role ID
SELECT id, key, name FROM public.roles WHERE key = 'admin';

-- Then assign it (replace ROLE_ID and USER_ID)
INSERT INTO public.user_roles (user_id, role_id)
VALUES ('YOUR_USER_ID_HERE', 'ROLE_ID_HERE')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================
-- EMERGENCY: Remove all RLS temporarily (USE WITH CAUTION)
-- ============================================================
-- Only use this if absolutely necessary and you understand the security implications
-- 
-- ALTER TABLE public.admin_allowlist DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
--
-- After fixing, re-enable:
-- ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ============================================================
