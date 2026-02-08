-- ============================================================
-- Provider Integrations and Content Caching Tables
-- ============================================================
-- This migration creates:
-- 1. provider_settings - Configuration for external providers
-- 2. external_content_cache - Cached content from external providers
-- 3. content_tags - Tags linking cached content to modes/focus
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

-- Seed initial provider settings
INSERT INTO public.provider_settings (provider, enabled, config) VALUES
  ('tmdb', TRUE, '{}'::jsonb),
  ('google_books', TRUE, '{}'::jsonb),
  ('spotify', TRUE, '{}'::jsonb),
  ('eventbrite', TRUE, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

-- ============================================================
-- STEP 2: CREATE external_content_cache TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.external_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('watch', 'read', 'listen', 'event')),
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
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage provider settings" ON public.provider_settings
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- external_content_cache: Authenticated users can read, only server can write
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.external_content_cache;
DROP POLICY IF EXISTS "Service role can write cache" ON public.external_content_cache;

-- Policy: Authenticated users can read cached content
CREATE POLICY "Authenticated users can read cache" ON public.external_content_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only service role can write (enforced via service role key, not RLS)
-- Note: RLS policies don't apply to service role, so we don't need a write policy
-- But we'll add one that blocks client writes explicitly
-- For INSERT policies, must use WITH CHECK, not USING
DROP POLICY IF EXISTS "Service role can write cache" ON public.external_content_cache;
CREATE POLICY "Service role can write cache" ON public.external_content_cache
  FOR INSERT
  WITH CHECK (false); -- Block all client inserts (service role bypasses RLS)

CREATE POLICY "Service role can update cache" ON public.external_content_cache
  FOR UPDATE
  USING (false); -- Block all client updates (service role bypasses RLS)

CREATE POLICY "Service role can delete cache" ON public.external_content_cache
  FOR DELETE
  USING (false); -- Block all client deletes (service role bypasses RLS)

-- content_tags: Authenticated users can read, only server can write
DROP POLICY IF EXISTS "Authenticated users can read content tags" ON public.content_tags;
DROP POLICY IF EXISTS "Service role can write content tags" ON public.content_tags;

-- Policy: Authenticated users can read tags
CREATE POLICY "Authenticated users can read content tags" ON public.content_tags
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Block client writes (service role bypasses RLS)
-- For INSERT policies, must use WITH CHECK, not USING
CREATE POLICY "Service role can write content tags" ON public.content_tags
  FOR INSERT
  WITH CHECK (false); -- Block all client inserts

CREATE POLICY "Service role can update content tags" ON public.content_tags
  FOR UPDATE
  USING (false); -- Block all client updates

CREATE POLICY "Service role can delete content tags" ON public.content_tags
  FOR DELETE
  USING (false); -- Block all client deletes

-- ============================================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================================

-- Verify provider_settings were created
SELECT
  'provider_settings' as table_name,
  COUNT(*) as row_count
FROM public.provider_settings;

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
  AND table_name IN ('provider_settings', 'external_content_cache', 'content_tags');

-- ============================================================
-- HELPER QUERIES
-- ============================================================

-- Query: Get all enabled providers
-- SELECT provider, enabled, config FROM public.provider_settings WHERE enabled = TRUE;

-- Query: Get cached content by provider and type
-- SELECT * FROM public.external_content_cache 
-- WHERE provider = 'tmdb' AND type = 'watch' 
-- ORDER BY fetched_at DESC;

-- Query: Get cached content with tags
-- SELECT 
--   c.*,
--   array_agg(DISTINCT t.mode || ':' || t.focus) as tags
-- FROM public.external_content_cache c
-- LEFT JOIN public.content_tags t ON t.cache_id = c.id
-- WHERE c.provider = 'tmdb'
-- GROUP BY c.id;

-- Query: Find content by mode and focus
-- SELECT DISTINCT c.*
-- FROM public.external_content_cache c
-- JOIN public.content_tags t ON t.cache_id = c.id
-- WHERE t.mode = 'destructive' AND t.focus = 'release';

-- ============================================================
-- NOTES
-- ============================================================
-- - provider_settings: Managed by admins only
-- - external_content_cache: Readable by authenticated users, writable only via service role
-- - content_tags: Readable by authenticated users, writable only via service role
-- - Service role bypasses RLS, so Edge Functions can write to cache tables
-- - Client-side code should only read from cache, never write
-- ============================================================


