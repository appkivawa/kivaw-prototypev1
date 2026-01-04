-- Create app_settings table for admin-configurable settings
-- Simplified version using admin_users table (no recursion)

-- Create the table
CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;

-- Policy: Only admins can read app_settings (using admin_users table - no recursion)
CREATE POLICY "Admins can read app_settings" ON public.app_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can insert/update app_settings (using admin_users table - no recursion)
CREATE POLICY "Admins can manage app_settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('maintenance_mode', 'false'::jsonb, 'Enable maintenance mode to disable public access'),
  ('home_trending_enabled', 'true'::jsonb, 'Enable trending items on home page'),
  ('max_waves', '100'::jsonb, 'Maximum number of waves to display')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_updated_at();

-- Verify the table was created
SELECT 
  'app_settings table created successfully' as status,
  COUNT(*) as total_settings
FROM public.app_settings;

