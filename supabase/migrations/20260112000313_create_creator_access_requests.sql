-- ============================================================
-- Creator Access Requests Table
-- ============================================================
-- Allows creators to request access to the creator portal
-- ============================================================

-- Create the table
CREATE TABLE IF NOT EXISTS public.creator_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_creator_access_requests_status ON public.creator_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_creator_access_requests_email ON public.creator_access_requests(email);
CREATE INDEX IF NOT EXISTS idx_creator_access_requests_created_at ON public.creator_access_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.creator_access_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can create access requests" ON public.creator_access_requests;
DROP POLICY IF EXISTS "Employees can read access requests" ON public.creator_access_requests;
DROP POLICY IF EXISTS "Employees can update access requests" ON public.creator_access_requests;

-- Policy: Allow anonymous or authenticated users to insert (create requests)
CREATE POLICY "Anyone can create access requests" ON public.creator_access_requests
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only employees (ops/admin/super_admin) can read requests
-- Use is_admin() function to avoid recursion
CREATE POLICY "Employees can read access requests" ON public.creator_access_requests
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'ops')
    )
  );

-- Policy: Only employees can update requests (approve/reject)
-- Use is_admin() function to avoid recursion
CREATE POLICY "Employees can update access requests" ON public.creator_access_requests
  FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'ops')
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'ops')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_creator_access_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS update_creator_access_requests_updated_at_trigger ON public.creator_access_requests;
CREATE TRIGGER update_creator_access_requests_updated_at_trigger
  BEFORE UPDATE ON public.creator_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_creator_access_requests_updated_at();

-- Verify the table was created
SELECT
  'creator_access_requests table created successfully' as status,
  COUNT(*) as total_requests
FROM public.creator_access_requests;

