-- Create app_settings table for admin-configurable settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read app_settings
DROP POLICY IF EXISTS "Admins can read app_settings" ON public.app_settings;
CREATE POLICY "Admins can read app_settings" ON public.app_settings
  FOR SELECT USING (
    public.is_admin(auth.uid())
  );

-- Policy: Only admins can insert/update app_settings
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings" ON public.app_settings
  FOR ALL USING (
    public.is_admin(auth.uid())
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

