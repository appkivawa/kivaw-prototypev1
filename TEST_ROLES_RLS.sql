-- Test if you can read roles as an authenticated user
-- This simulates what the app does

-- 1. Check your current user ID
SELECT auth.uid() as current_user_id;

-- 2. Check if you're in admin_allowlist
SELECT EXISTS (
  SELECT 1 FROM public.admin_allowlist 
  WHERE user_id = auth.uid()
) as is_in_allowlist;

-- 3. Try to read roles (this is what the app does)
SELECT id, key, name FROM public.roles ORDER BY key;

-- 4. Check RLS policies on roles table
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'roles'
ORDER BY policyname;

-- 5. If the SELECT query above fails, check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'roles';

