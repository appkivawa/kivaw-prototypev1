-- Verify the RLS policy and function are set up correctly
-- Run this in Supabase SQL Editor

-- Check if the function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin_user';

-- Check if the policy exists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname = 'Admins can read all profiles';

-- Test the function with a specific user ID (replace with your actual user ID)
-- First, get your user ID from auth.users:
SELECT id, email FROM auth.users WHERE email = 'kivawapp@proton.me';

-- Then test the function (replace 'YOUR_USER_ID_HERE' with the actual UUID):
-- SELECT public.is_admin_user() as is_admin_check;

-- Check if your user is marked as admin
SELECT 
  id,
  email,
  is_admin,
  created_at
FROM public.profiles
WHERE email = 'kivawapp@proton.me';

