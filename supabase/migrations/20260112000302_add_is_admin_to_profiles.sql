-- Add is_admin column to profiles table
-- This allows checking admin status via profiles.is_admin instead of just email allowlist

-- Add the is_admin column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- Set kivawapp@proton.me as admin (if that user exists)
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'kivawapp@proton.me';

-- Add comment
COMMENT ON COLUMN public.profiles.is_admin IS 'Whether this user has admin access to the admin dashboard';

