-- Create support_tickets table for user support requests
-- Simplified version using admin_users table (no recursion)

-- Create the table
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update support_tickets" ON public.support_tickets;

-- Policy: Users can create their own tickets
CREATE POLICY "Users can create support_tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own tickets
CREATE POLICY "Users can view own support_tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins can view all tickets (using admin_users table - no recursion)
CREATE POLICY "Admins can view all support_tickets" ON public.support_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can update all tickets (using admin_users table - no recursion)
CREATE POLICY "Admins can update support_tickets" ON public.support_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Verify the table was created
SELECT 
  'support_tickets table created successfully' as status,
  COUNT(*) as total_tickets
FROM public.support_tickets;

