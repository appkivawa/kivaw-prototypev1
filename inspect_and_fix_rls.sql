-- Comprehensive RLS Policy Inspection and Fix
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Inspect Current Policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- STEP 2: Check for Recursive Patterns
-- ============================================
-- Look for policies that reference 'profiles' in their USING/WITH CHECK clauses
SELECT 
  policyname,
  qual,
  CASE 
    WHEN qual::text LIKE '%profiles%' THEN '⚠️ POTENTIAL RECURSION'
    ELSE '✓ Safe'
  END as recursion_risk
FROM pg_policies
WHERE tablename = 'profiles'
  AND qual IS NOT NULL;

-- ============================================
-- STEP 3: Drop All Existing Policies (Clean Slate)
-- ============================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read profiles" ON public.profiles;  -- Drop the problematic one
DROP POLICY IF EXISTS "Allow insert for new users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Drop any functions that might cause issues
DROP FUNCTION IF EXISTS public.is_admin_user();

-- ============================================
-- STEP 4: Create Simple, Non-Recursive Policies
-- ============================================

-- Policy 1: Users can read their own profile (no recursion - direct check)
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Policy 2: Admins can read all profiles
-- Use a separate admin_users table to avoid recursion
-- First, ensure admin_users table exists
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Disable RLS on admin_users (it's just a lookup table)
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Sync existing admins
INSERT INTO public.admin_users (user_id)
SELECT id FROM public.profiles WHERE is_admin = true
ON CONFLICT (user_id) DO NOTHING;

-- Now create the admin policy using admin_users (no recursion!)
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy 3: Allow inserts (for triggers)
CREATE POLICY "Allow insert for new users" ON public.profiles
  FOR INSERT 
  WITH CHECK (true);

-- Policy 4: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 5: Create Trigger to Keep admin_users in Sync
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_admin_users()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_admin = true THEN
    INSERT INTO public.admin_users (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.admin_users WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_admin_users_trigger ON public.profiles;
CREATE TRIGGER sync_admin_users_trigger
  AFTER INSERT OR UPDATE OF is_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_users();

-- ============================================
-- STEP 6: Verify Policies Are Set Up Correctly
-- ============================================
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%profiles%' AND qual::text NOT LIKE '%admin_users%' THEN '⚠️ WARNING: May cause recursion'
    ELSE '✓ Safe'
  END as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- STEP 7: Test the Setup
-- ============================================
-- Check if admin_users table has your admin
SELECT 
  au.user_id,
  p.email,
  p.is_admin
FROM public.admin_users au
LEFT JOIN public.profiles p ON p.id = au.user_id;

-- Verify your admin status
SELECT 
  id,
  email,
  is_admin,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = id) THEN '✓ In admin_users'
    ELSE '✗ Not in admin_users'
  END as admin_users_status
FROM public.profiles
WHERE email = 'kivawapp@proton.me';

