-- Debug script to check if profiles table exists and create it if needed
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check current database and schema
-- ============================================
SELECT 
  current_database() as database_name,
  current_user as current_user,
  current_schema() as current_schema,
  current_schemas(false) as search_path;

-- ============================================
-- STEP 2: Check if profiles table exists anywhere
-- ============================================
SELECT 
  table_schema, 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'profiles'
ORDER BY table_schema;

-- ============================================
-- STEP 3: Check all tables in public schema
-- ============================================
SELECT 
  table_schema, 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- STEP 4: Create profiles table if it doesn't exist
-- ============================================
-- Only run this if the table doesn't exist from STEP 2

-- Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_sign_in_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for new users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can read all profiles
-- This checks both admin_users table and is_admin column
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Policy: Allow insert for new users (via trigger)
CREATE POLICY "Allow insert for new users" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- STEP 5: Create triggers to sync with auth.users
-- ============================================

-- Function to create profile when user signs up
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

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update last_sign_in_at
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

-- Trigger for user sign-in
DROP TRIGGER IF EXISTS on_auth_user_signin ON auth.users;
CREATE TRIGGER on_auth_user_signin
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_signin();

-- ============================================
-- STEP 6: Backfill existing users
-- ============================================
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
-- STEP 7: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- ============================================
-- STEP 8: Set admin user
-- ============================================
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'kivawapp@proton.me';

-- ============================================
-- STEP 9: Verify the table was created
-- ============================================
SELECT 
  'profiles table created successfully' as status,
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE is_admin = true) as admin_count
FROM public.profiles;

-- Show admin users
SELECT id, email, is_admin, created_at 
FROM public.profiles 
WHERE is_admin = true;

