-- Add last_state column to profiles table for storing user's last chosen state
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_state TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_state ON public.profiles(last_state);

-- Add comment
COMMENT ON COLUMN public.profiles.last_state IS 'Last state/mood chosen by the user (blank, destructive, expansive, minimize)';

