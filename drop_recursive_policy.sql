-- Drop the problematic recursive policy
-- Run this in Supabase SQL Editor

-- Drop the specific policy that's causing recursion
DROP POLICY IF EXISTS "Admins can read profiles" ON public.profiles;

-- Verify it's gone
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

-- If the safe policy doesn't exist, create it
-- (This uses admin_users table which has no RLS, so no recursion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can read all profiles'
  ) THEN
    -- Ensure admin_users table exists
    CREATE TABLE IF NOT EXISTS public.admin_users (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    
    -- Disable RLS on admin_users
    ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
    
    -- Sync existing admins
    INSERT INTO public.admin_users (user_id)
    SELECT id FROM public.profiles WHERE is_admin = true
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create the safe policy
    CREATE POLICY "Admins can read all profiles" ON public.profiles
      FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM public.admin_users
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Final verification
SELECT 
  'Policy check complete' as status,
  COUNT(*) FILTER (WHERE qual::text LIKE '%profiles%' AND qual::text NOT LIKE '%admin_users%') as recursive_policies,
  COUNT(*) FILTER (WHERE policyname = 'Admins can read all profiles') as safe_admin_policy
FROM pg_policies
WHERE tablename = 'profiles';

