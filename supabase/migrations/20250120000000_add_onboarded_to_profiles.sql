-- Add onboarded column and interests array to profiles table
-- This migration adds support for user onboarding

-- Add onboarded column (defaults to false)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;

-- Update existing NULL values to false, then set NOT NULL
UPDATE public.profiles SET onboarded = false WHERE onboarded IS NULL;
ALTER TABLE public.profiles ALTER COLUMN onboarded SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN onboarded SET DEFAULT false;

-- Add interests column (array of text, default to empty array)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}'::text[];

-- Update existing NULL values to empty array, then set NOT NULL
UPDATE public.profiles SET interests = '{}'::text[] WHERE interests IS NULL;
ALTER TABLE public.profiles ALTER COLUMN interests SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN interests SET DEFAULT '{}'::text[];

-- Update the trigger function to set onboarded=false and interests='{}' for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, last_sign_in_at, onboarded, interests)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at,
    NEW.last_sign_in_at,
    false,
    '{}'::text[]
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      last_sign_in_at = EXCLUDED.last_sign_in_at,
      updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON COLUMN public.profiles.onboarded IS 'Whether the user has completed onboarding';
COMMENT ON COLUMN public.profiles.interests IS 'Array of interest tags selected during onboarding';

