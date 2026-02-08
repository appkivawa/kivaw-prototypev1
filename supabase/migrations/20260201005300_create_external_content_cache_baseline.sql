-- CREATE external_content_cache (required by explore_items_v2 view SOURCE 3)

CREATE TABLE IF NOT EXISTS public.external_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('watch', 'read')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_external_content_cache_provider_type
  ON public.external_content_cache (provider, type);

CREATE INDEX IF NOT EXISTS idx_external_content_cache_fetched_at
  ON public.external_content_cache (fetched_at DESC);
