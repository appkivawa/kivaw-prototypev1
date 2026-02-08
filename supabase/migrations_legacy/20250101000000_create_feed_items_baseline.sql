-- ============================================================
-- Baseline: feed_items table (required for get_personal_feed)
-- Copied from migrations_old/20250116000000_create_feed_items.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NULL,
  source_item_id text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  summary text NULL,
  author text NULL,
  image_url text NULL,
  published_at timestamptz NULL,
  tags text[] NULL,
  topics text[] NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NULL,
  external_id text NULL,
  is_discoverable boolean NOT NULL DEFAULT true,
  score double precision NULL,
  content_kind text NOT NULL DEFAULT 'rss'::text,
  provider text NOT NULL DEFAULT 'rss'::text
);

CREATE UNIQUE INDEX IF NOT EXISTS feed_items_dedupe ON public.feed_items (source_type, source_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS feed_items_external_id_key ON public.feed_items (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS feed_items_ingested_at_idx ON public.feed_items (ingested_at DESC);
CREATE INDEX IF NOT EXISTS feed_items_published_at_idx ON public.feed_items (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS feed_items_source_type_idx ON public.feed_items (source_type);
CREATE INDEX IF NOT EXISTS idx_feed_items_created_at ON public.feed_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_tags ON public.feed_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_feed_items_topics ON public.feed_items USING GIN (topics);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_provider_external_id ON public.feed_items (provider, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_provider_url ON public.feed_items (provider, url) WHERE external_id IS NULL;
