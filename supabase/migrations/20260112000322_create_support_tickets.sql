-- Create support_tickets table for user support requests
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create their own tickets
DROP POLICY IF EXISTS "Users can create support_tickets" ON public.support_tickets;
CREATE POLICY "Users can create support_tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own tickets
DROP POLICY IF EXISTS "Users can view own support_tickets" ON public.support_tickets;
CREATE POLICY "Users can view own support_tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins can view all tickets
-- Use is_admin() function which checks admin_allowlist and roles/user_roles
-- For support role, we check has_role() directly
DROP POLICY IF EXISTS "Admins can view all support_tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all support_tickets" ON public.support_tickets
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'support')
  );

-- Policy: Admins can update all tickets
DROP POLICY IF EXISTS "Admins can update support_tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support_tickets" ON public.support_tickets
  FOR UPDATE USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'support')
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_tickets_updated_at();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

