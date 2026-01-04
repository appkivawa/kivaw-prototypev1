-- Complete setup script for profiles table and admin access
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create profiles table
-- ============================================

-- Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_sign_in_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can read all profiles (for admin dashboard)
-- Note: This uses admin_users table - if that doesn't exist, you may need to adjust
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Policy: Allow insert for new users (via trigger)
DROP POLICY IF EXISTS "Allow insert for new users" ON public.profiles;
CREATE POLICY "Allow insert for new users" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, last_sign_in_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at,
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      last_sign_in_at = EXCLUDED.last_sign_in_at,
      updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update last_sign_in_at when user signs in
CREATE OR REPLACE FUNCTION public.handle_user_signin()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in_at = NEW.last_sign_in_at,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update last_sign_in_at
DROP TRIGGER IF EXISTS on_auth_user_signin ON auth.users;
CREATE TRIGGER on_auth_user_signin
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_signin();

-- Backfill existing users (if any exist)
INSERT INTO public.profiles (id, email, created_at, last_sign_in_at)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    updated_at = now();

-- ============================================
-- STEP 2: Add is_admin column
-- ============================================

-- Add the is_admin column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- ============================================
-- STEP 3: Set admin user
-- ============================================

-- Set kivawapp@proton.me as admin (if that user exists)
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'kivawapp@proton.me';

-- ============================================
-- STEP 4: Create indexes and comments
-- ============================================

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Add comments
COMMENT ON TABLE public.profiles IS 'User profiles table for admin dashboard access. Mirrors auth.users data.';
COMMENT ON COLUMN public.profiles.is_admin IS 'Whether this user has admin access to the admin dashboard';

-- ============================================
-- Verification queries (optional - run to check)
-- ============================================

-- Check if profiles table exists and has data
-- SELECT COUNT(*) as total_profiles FROM public.profiles;

-- Check admin users
-- SELECT id, email, is_admin, created_at FROM public.profiles WHERE is_admin = true;

