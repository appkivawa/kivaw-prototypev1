-- Check if roles table exists and has data
-- Run this in Supabase SQL Editor

-- 1. Check if roles table exists
SELECT 
  'roles table exists' as status,
  COUNT(*) as role_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'roles';

-- 2. List all roles
SELECT id, key, name, created_at 
FROM public.roles 
ORDER BY key;

-- 3. Check RLS policies on roles table
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'roles'
ORDER BY policyname;

-- 4. If roles table is empty, seed it:
INSERT INTO public.roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('it', 'IT Support'),
  ('social_media', 'Social Media Manager'),
  ('operations', 'Operations')
ON CONFLICT (key) DO NOTHING;

-- 5. Verify roles were inserted
SELECT id, key, name FROM public.roles ORDER BY key;

