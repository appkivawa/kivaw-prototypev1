-- Fix infinite recursion in admin_users RLS policies
-- The policies were checking admin_users table directly, which triggered RLS again
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the check

-- Create a function to check if a user is in admin_users (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_user_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if table exists first
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_users'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Direct query bypasses RLS due to SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_uid
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO anon;

-- Drop existing policies on admin_users
DROP POLICY IF EXISTS "Admins can read admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can update admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can delete admin_users" ON public.admin_users;

-- Recreate policies using the function (no recursion)
CREATE POLICY "Admins can read admin_users"
  ON public.admin_users
  FOR SELECT
  USING (public.is_user_admin(auth.uid()));

-- Policy: Allow service role to manage admin_users (for initial setup)
CREATE POLICY "Service role can manage admin_users"
  ON public.admin_users
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Allow authenticated users to check if they are admin (read only their own row)
CREATE POLICY "Users can check own admin status"
  ON public.admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Only admins can insert new admins
-- Note: First admin must be added via service role or Supabase dashboard
CREATE POLICY "Admins can insert admin_users"
  ON public.admin_users
  FOR INSERT
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Policy: Only admins can update admin_users
CREATE POLICY "Admins can update admin_users"
  ON public.admin_users
  FOR UPDATE
  USING (public.is_user_admin(auth.uid()));

-- Policy: Only admins can delete admin_users
CREATE POLICY "Admins can delete admin_users"
  ON public.admin_users
  FOR DELETE
  USING (public.is_user_admin(auth.uid()));

-- Add comment
COMMENT ON FUNCTION public.is_user_admin(UUID) IS 'Checks if a user is in admin_users table. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

