-- Ultimate fix: Use a separate mechanism to check admin status
-- This avoids recursion by not querying profiles in the policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Option 1: Create a simple admin_users table without RLS for checking admin status
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Disable RLS on admin_users (it's just for checking, not sensitive data)
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Insert your admin user (replace with your actual user ID)
-- First, get your user ID:
-- SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me';
-- Then insert:
-- INSERT INTO public.admin_users (user_id) 
-- SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me'
-- ON CONFLICT (user_id) DO NOTHING;

-- Now create the policy using admin_users table (no recursion!)
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT 
  USING (
    -- Users can read their own profile
    auth.uid() = id
    OR
    -- Admins can read all profiles (check admin_users table, not profiles)
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Sync admin_users with profiles.is_admin
-- Run this to sync existing admins:
INSERT INTO public.admin_users (user_id)
SELECT id FROM public.profiles WHERE is_admin = true
ON CONFLICT (user_id) DO NOTHING;

-- Create a trigger to keep admin_users in sync with profiles.is_admin
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_admin_users_trigger ON public.profiles;
CREATE TRIGGER sync_admin_users_trigger
  AFTER INSERT OR UPDATE OF is_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_users();

