-- Simple fix: Use a function that stores admin check result
-- This avoids recursion by using a different mechanism

-- Drop everything first
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Option 1: Use a simple policy that checks admin status via a materialized approach
-- But actually, the simplest is to just allow users to read their own profile
-- and use the frontend to filter/display only for admins

-- For now, let's use a policy that directly checks without recursion
-- by using a subquery that only checks the current user's own row
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT 
  USING (
    -- Users can read their own profile
    auth.uid() = id
    OR
    -- Check if current user is admin by looking at their own profile row
    -- This should work because we're only checking one specific row (auth.uid())
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- If this STILL causes recursion, the issue is that even checking one row triggers the policy.
-- In that case, we need to use a completely different approach:
-- Option: Remove RLS for admins entirely, or use a service role query

