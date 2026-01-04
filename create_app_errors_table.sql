-- Create app_errors table for storing application errors
-- Run this in Supabase SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS public.app_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  error_type TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  url TEXT,
  user_agent TEXT,
  metadata JSONB,
  resolved BOOLEAN DEFAULT false NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read app_errors" ON public.app_errors;
DROP POLICY IF EXISTS "Admins can manage app_errors" ON public.app_errors;
DROP POLICY IF EXISTS "Service can insert app_errors" ON public.app_errors;

-- Policy: Only admins can read app_errors (using admin_users table - no recursion)
CREATE POLICY "Admins can read app_errors" ON public.app_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can update/delete app_errors
CREATE POLICY "Admins can manage app_errors" ON public.app_errors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Allow service/anon to insert errors (for error logging)
CREATE POLICY "Service can insert app_errors" ON public.app_errors
  FOR INSERT WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON public.app_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_resolved ON public.app_errors(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_app_errors_error_type ON public.app_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_app_errors_user_id ON public.app_errors(user_id);

-- Verify the table was created
SELECT 
  'app_errors table created successfully' as status,
  COUNT(*) as total_errors,
  COUNT(*) FILTER (WHERE resolved = false) as unresolved_errors
FROM public.app_errors;

