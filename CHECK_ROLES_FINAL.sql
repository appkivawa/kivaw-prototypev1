-- ============================================================
-- CHECK ROLES AND PERMISSIONS (FINAL VERSION)
-- ============================================================
-- Run this in Supabase SQL Editor to verify auth + RLS setup
-- ============================================================

-- ============================================================
-- 1. CHECK TABLES EXIST
-- ============================================================
SELECT 
  'Tables Check' as check_type,
  tablename,
  CASE 
    WHEN tablename IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_allowlist', 'roles', 'user_roles', 'profiles')
ORDER BY tablename;

-- ============================================================
-- 2. CHECK RLS IS ENABLED
-- ============================================================
SELECT 
  'RLS Status' as check_type,
  tablename,
  CASE 
    WHEN rowsecurity = true THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('admin_allowlist', 'roles', 'user_roles', 'profiles')
ORDER BY tablename;

-- ============================================================
-- 3. CHECK ADMIN_ALLOWLIST RLS (SHOULD BE DISABLED)
-- ============================================================
SELECT 
  'admin_allowlist RLS' as check_type,
  CASE 
    WHEN rowsecurity = false THEN '✅ DISABLED (CORRECT - no recursion)'
    ELSE '⚠️ ENABLED (may cause recursion)'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'admin_allowlist';

-- ============================================================
-- 4. CHECK POLICIES FOR RECURSION RISKS
-- ============================================================
SELECT 
  'Policy Recursion Check' as check_type,
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
-- 5. LIST ALL ROLES
-- ============================================================
SELECT 
  'Roles' as check_type,
  id,
  key,
  name,
  created_at
FROM public.roles
ORDER BY key;

-- ============================================================
-- 6. LIST ALL ADMINS (FROM ALL SOURCES)
-- ============================================================
SELECT 
  'Admins' as check_type,
  u.email,
  u.id as user_id,
  CASE 
    WHEN aa.user_id IS NOT NULL THEN '✅ allowlist'
    ELSE '❌ not in allowlist'
  END as in_allowlist,
  CASE 
    WHEN aa.super_admin = true THEN '✅ super_admin'
    ELSE '❌ not super_admin'
  END as super_admin_status,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = u.id AND r.key = 'admin'
    ) THEN '✅ has admin role'
    ELSE '❌ no admin role'
  END as has_admin_role,
  public.is_admin(u.id) as is_admin_function_result
FROM auth.users u
LEFT JOIN public.admin_allowlist aa ON u.id = aa.user_id
WHERE aa.user_id IS NOT NULL
   OR EXISTS (
     SELECT 1
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = u.id AND r.key = 'admin'
   )
ORDER BY u.email;

-- ============================================================
-- 7. CHECK USER ROLES (SAMPLE)
-- ============================================================
SELECT 
  'User Roles' as check_type,
  u.email,
  r.key as role_key,
  r.name as role_name,
  ur.created_at as assigned_at
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
ORDER BY u.email, r.key
LIMIT 20;

-- ============================================================
-- 8. TEST is_admin() FUNCTION
-- ============================================================
-- Replace 'your-email@example.com' with your email
SELECT 
  'is_admin() Test' as check_type,
  u.email,
  public.is_admin(u.id) as is_admin_result
FROM auth.users u
WHERE u.email = 'your-email@example.com';

-- ============================================================
-- 9. TEST get_user_permissions() FUNCTION
-- ============================================================
-- Replace 'your-email@example.com' with your email
SELECT 
  'get_user_permissions() Test' as check_type,
  public.get_user_permissions(u.id) as permissions_json
FROM auth.users u
WHERE u.email = 'your-email@example.com';

-- ============================================================
-- 10. CHECK FUNCTIONS EXIST
-- ============================================================
SELECT 
  'Functions Check' as check_type,
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'has_role', 'get_user_permissions')
ORDER BY routine_name;

-- ============================================================
-- EXPECTED OUTPUT SUMMARY
-- ============================================================
-- ✅ All tables should exist
-- ✅ RLS should be ENABLED on roles, user_roles, profiles
-- ✅ RLS should be DISABLED on admin_allowlist (no recursion)
-- ✅ All policies should show "✅ SAFE" (no recursion risks)
-- ✅ At least one admin should exist (you)
-- ✅ is_admin() function should return true for your user
-- ✅ get_user_permissions() should return JSON with your permissions
-- ============================================================
