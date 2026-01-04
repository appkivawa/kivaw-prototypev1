-- Create home_overrides table for manual admin controls
-- Run this in Supabase SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS public.home_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  override_type TEXT NOT NULL CHECK (override_type IN ('force_state', 'pin_content', 'suppress_category')),
  target_value TEXT NOT NULL, -- state name, content_id, or category name
  priority INTEGER DEFAULT 0, -- higher = more important
  active BOOLEAN DEFAULT true NOT NULL,
  expires_at TIMESTAMPTZ, -- NULL = never expires
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.home_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read home_overrides" ON public.home_overrides;
DROP POLICY IF EXISTS "Admins can manage home_overrides" ON public.home_overrides;

-- Policy: Only admins can read home_overrides (using admin_users table - no recursion)
CREATE POLICY "Admins can read home_overrides" ON public.home_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can manage home_overrides
CREATE POLICY "Admins can manage home_overrides" ON public.home_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_home_overrides_type ON public.home_overrides(override_type);
CREATE INDEX IF NOT EXISTS idx_home_overrides_active ON public.home_overrides(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_home_overrides_expires ON public.home_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- Verify the table was created
SELECT 
  'home_overrides table created successfully' as status,
  COUNT(*) as total_overrides
FROM public.home_overrides;

