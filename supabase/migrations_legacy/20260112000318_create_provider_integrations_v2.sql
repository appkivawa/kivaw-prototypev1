-- ============================================================
-- Provider Integrations and Content Caching Tables (v2)
-- ============================================================
-- This migration creates:
-- 1. provider_settings - Configuration for external providers
-- 2. external_content_cache - Cached content from external providers
-- 3. content_tags - Tags linking cached content to modes/focus
-- ============================================================
-- Run this migration in Supabase SQL Editor or via Supabase CLI
-- ============================================================

-- ============================================================
-- STEP 1: CREATE provider_settings TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.provider_settings (
  provider TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for enabled providers
CREATE INDEX IF NOT EXISTS idx_provider_settings_enabled ON public.provider_settings(enabled) WHERE enabled = TRUE;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_provider_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_provider_settings_updated_at_trigger ON public.provider_settings;
CREATE TRIGGER update_provider_settings_updated_at_trigger
  BEFORE UPDATE ON public.provider_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_provider_settings_updated_at();

-- Seed initial provider settings (tmdb and google_books only)
INSERT INTO public.provider_settings (provider, enabled, config) VALUES
  ('tmdb', TRUE, '{}'::jsonb),
  ('google_books', TRUE, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

-- ============================================================
-- STEP 2: CREATE external_content_cache TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.external_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('watch', 'read')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  url TEXT,
  raw JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_content_cache_provider ON public.external_content_cache(provider);
CREATE INDEX IF NOT EXISTS idx_external_content_cache_type ON public.external_content_cache(type);
CREATE INDEX IF NOT EXISTS idx_external_content_cache_fetched_at ON public.external_content_cache(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_content_cache_provider_type ON public.external_content_cache(provider, type);

-- ============================================================
-- STEP 3: CREATE content_tags TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_tags (
  cache_id UUID NOT NULL REFERENCES public.external_content_cache(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  focus TEXT NOT NULL,
  PRIMARY KEY (cache_id, mode, focus)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_tags_cache_id ON public.content_tags(cache_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_mode_focus ON public.content_tags(mode, focus);

-- ============================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_content_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: CREATE RLS POLICIES
-- ============================================================

-- provider_settings: Only admins can read/write
DROP POLICY IF EXISTS "Admins can read provider settings" ON public.provider_settings;
DROP POLICY IF EXISTS "Admins can manage provider settings" ON public.provider_settings;

CREATE POLICY "Admins can read provider settings" ON public.provider_settings
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

CREATE POLICY "Admins can manage provider settings" ON public.provider_settings
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

-- external_content_cache: Authenticated users can read, no client writes
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.external_content_cache;
DROP POLICY IF EXISTS "Block client writes to cache" ON public.external_content_cache;

-- Policy: Authenticated users can read cached content
CREATE POLICY "Authenticated users can read cache" ON public.external_content_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Block all client writes (Edge Functions use service role which bypasses RLS)
CREATE POLICY "Block client writes to cache" ON public.external_content_cache
  FOR ALL
  USING (false); -- Blocks INSERT, UPDATE, DELETE from client

-- content_tags: Authenticated users can read, no client writes
DROP POLICY IF EXISTS "Authenticated users can read content tags" ON public.content_tags;
DROP POLICY IF EXISTS "Block client writes to content tags" ON public.content_tags;

-- Policy: Authenticated users can read tags
CREATE POLICY "Authenticated users can read content tags" ON public.content_tags
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Block all client writes (Edge Functions use service role which bypasses RLS)
CREATE POLICY "Block client writes to content tags" ON public.content_tags
  FOR ALL
  USING (false); -- Blocks INSERT, UPDATE, DELETE from client

-- ============================================================
-- STEP 6: VERIFICATION
-- ============================================================

-- Verify tables were created
SELECT
  table_name,
  CASE
    WHEN table_name = 'provider_settings' THEN (SELECT COUNT(*) FROM public.provider_settings)
    WHEN table_name = 'external_content_cache' THEN (SELECT COUNT(*) FROM public.external_content_cache)
    WHEN table_name = 'content_tags' THEN (SELECT COUNT(*) FROM public.content_tags)
  END as row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('provider_settings', 'external_content_cache', 'content_tags')
ORDER BY table_name;

-- Verify provider_settings were seeded
SELECT provider, enabled, updated_at
FROM public.provider_settings
ORDER BY provider;

-- ============================================================
-- NOTES
-- ============================================================
-- - provider_settings: Managed by admins only (via Edge Functions)
-- - external_content_cache: Readable by authenticated users, writable only via service role (Edge Functions)
-- - content_tags: Readable by authenticated users, writable only via service role (Edge Functions)
-- - Service role bypasses RLS, so Edge Functions can write to cache tables
-- - Client-side code should only read from cache, never write
-- - Type constraint: only 'watch' and 'read' are allowed
-- - Mode/Focus values: Use capitalized names (Reset, Beauty, Logic, Faith, Reflect, Comfort, Watch, Read)
-- ============================================================


