-- Create admin_audit_log table for tracking admin actions
-- Simplified version using admin_users table (no recursion)

-- Create the table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read admin_audit_log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert admin_audit_log" ON public.admin_audit_log;

-- Policy: Only admins can read audit logs (using admin_users table - no recursion)
CREATE POLICY "Admins can read admin_audit_log" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can insert audit logs (using admin_users table - no recursion)
CREATE POLICY "Admins can insert admin_audit_log" ON public.admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id ON public.admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_id ON public.admin_audit_log(target_id);

-- Create function to log admin actions
-- This can be called from edge functions or triggers
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_actor_user_id UUID,
  p_action TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_log (actor_user_id, action, target_id, metadata)
  VALUES (p_actor_user_id, p_action, p_target_id, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Verify the table was created
SELECT 
  'admin_audit_log table created successfully' as status,
  COUNT(*) as total_logs
FROM public.admin_audit_log;

