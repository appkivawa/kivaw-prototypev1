-- Final fix for infinite recursion: Use a function that truly bypasses RLS
-- Run this in Supabase SQL Editor

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Create a function that bypasses RLS by using SECURITY DEFINER with proper settings
-- The key is to ensure the function owner has the right privileges
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  result boolean;
BEGIN
  -- Use a direct query that bypasses RLS because we're SECURITY DEFINER
  -- and the function owner (postgres) has full access
  SELECT COALESCE(is_admin, false) INTO result
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(result, false);
EXCEPTION
  WHEN OTHERS THEN
    -- If anything goes wrong, return false
    RETURN false;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Now create the policy - this should work because the function bypasses RLS
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT 
  USING (
    -- Users can always read their own profile
    auth.uid() = id
    OR
    -- Admins can read all profiles
    public.is_admin_user() = true
  );

-- If the above still causes recursion, use this alternative approach instead:
-- Comment out the policy above and uncomment this one:

/*
-- Alternative: Simple policy that only allows reading own profile
-- Admins will need to use a different method (like an edge function or service role)
CREATE POLICY "Users can read own profile only" ON public.profiles
  FOR SELECT 
  USING (auth.uid() = id);
*/

