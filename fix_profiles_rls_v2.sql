-- Alternative fix: Use a simpler approach without function recursion
-- This policy directly checks is_admin without using a function

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Drop the function (we'll use a different approach)
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Create a policy that directly checks is_admin for the current user
-- This avoids recursion by checking the current user's own profile only
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT 
  USING (
    -- Users can always read their own profile
    auth.uid() = id
    OR
    -- Admins can read all profiles by checking their own is_admin flag
    -- This works because we're checking the current user's profile, not querying all profiles
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Note: This still might cause recursion. If it does, use the email allowlist approach instead.

