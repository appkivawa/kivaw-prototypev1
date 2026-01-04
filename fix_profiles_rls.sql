-- Fix infinite recursion in profiles RLS policy
-- Run this in Supabase SQL Editor

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Create a helper function to check if current user is admin
-- This function uses SECURITY DEFINER and SET search_path to bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  admin_status boolean;
BEGIN
  -- Direct query with explicit schema to bypass RLS
  SELECT COALESCE(is_admin, false) INTO admin_status
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(admin_status, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Create a new policy that uses the function (no recursion!)
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT 
  USING (
    -- Users can always read their own profile
    auth.uid() = id
    OR
    -- Admins can read all profiles (using function to avoid recursion)
    public.is_admin_user() = true
  );

-- Verify the function works
SELECT 
  auth.uid() as current_user_id,
  public.is_admin_user() as is_admin;

