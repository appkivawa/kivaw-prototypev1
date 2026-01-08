-- ============================================================
-- Tag Overrides Table
-- ============================================================
-- This table allows admins to manually override automatic tags
-- for specific content items from external providers.
-- ============================================================

-- Create tag_overrides table
CREATE TABLE IF NOT EXISTS public.tag_overrides (
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  focus TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (provider, provider_id, mode, focus)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tag_overrides_provider_id ON public.tag_overrides(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_tag_overrides_mode_focus ON public.tag_overrides(mode, focus);

-- Enable Row Level Security
ALTER TABLE public.tag_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read tag overrides" ON public.tag_overrides;
DROP POLICY IF EXISTS "Admins can manage tag overrides" ON public.tag_overrides;

-- Policy: Only admins can read tag overrides
CREATE POLICY "Admins can read tag overrides" ON public.tag_overrides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'super_admin')
    )
  );

-- Policy: Only admins can manage tag overrides
CREATE POLICY "Admins can manage tag overrides" ON public.tag_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'super_admin')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_tag_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_tag_overrides_updated_at ON public.tag_overrides;
CREATE TRIGGER trigger_update_tag_overrides_updated_at
  BEFORE UPDATE ON public.tag_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tag_overrides_updated_at();

-- ============================================================
-- Verification
-- ============================================================
SELECT 'tag_overrides table created successfully' as status;


