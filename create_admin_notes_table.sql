-- Create admin_notes table for internal admin notes
-- Run this in Supabase SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_type TEXT NOT NULL CHECK (note_type IN ('content_item', 'state', 'experiment', 'user')),
  target_id TEXT NOT NULL, -- content_id, state name, experiment_id, or user_id
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read admin_notes" ON public.admin_notes;
DROP POLICY IF EXISTS "Admins can manage admin_notes" ON public.admin_notes;

-- Policy: Only admins can read admin_notes (using admin_users table - no recursion)
CREATE POLICY "Admins can read admin_notes" ON public.admin_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can manage admin_notes
CREATE POLICY "Admins can manage admin_notes" ON public.admin_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_notes_type ON public.admin_notes(note_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_at ON public.admin_notes(created_at DESC);

-- Verify the table was created
SELECT 
  'admin_notes table created successfully' as status,
  COUNT(*) as total_notes
FROM public.admin_notes;

