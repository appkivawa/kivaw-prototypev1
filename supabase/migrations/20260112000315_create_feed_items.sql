-- ============================================================
-- CREATE feed_items TABLE
-- ============================================================
-- This table stores aggregated feed items from various sources
-- (RSS, YouTube, Reddit, Podcast, Eventbrite, Spotify)
-- for the personalized social feed.

CREATE TABLE IF NOT EXISTS public.feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('rss', 'youtube', 'reddit', 'podcast', 'eventbrite', 'spotify')),
  external_id TEXT NOT NULL, -- Unique ID from the source (e.g., RSS GUID, YouTube video ID)
  url TEXT NOT NULL,
  
  -- Content
  title TEXT NOT NULL,
  summary TEXT,
  author TEXT,
  image_url TEXT,
  
  -- Metadata
  published_at TIMESTAMPTZ,
  tags TEXT[],
  topics TEXT[],
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on (source, external_id) for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_source_external_id 
  ON public.feed_items(source, external_id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feed_items_source ON public.feed_items(source);
CREATE INDEX IF NOT EXISTS idx_feed_items_published_at ON public.feed_items(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_feed_items_created_at ON public.feed_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_tags ON public.feed_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_feed_items_topics ON public.feed_items USING GIN(topics);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE RLS POLICIES
-- ============================================================

-- Allow authenticated users to read feed_items
DROP POLICY IF EXISTS "Authenticated users can read feed_items" ON public.feed_items;
CREATE POLICY "Authenticated users can read feed_items" ON public.feed_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role (Edge Functions) to insert/update/delete
-- This is handled by using service role key, which bypasses RLS
-- But we add this policy for clarity and future-proofing
DROP POLICY IF EXISTS "Service role can manage feed_items" ON public.feed_items;
CREATE POLICY "Service role can manage feed_items" ON public.feed_items
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.feed_items IS 'Aggregated feed items from various sources for personalized social feed';
COMMENT ON COLUMN public.feed_items.source IS 'Source type: rss, youtube, reddit, podcast, eventbrite, spotify';
COMMENT ON COLUMN public.feed_items.external_id IS 'Unique identifier from the source (e.g., RSS GUID, YouTube video ID)';
COMMENT ON COLUMN public.feed_items.metadata IS 'Additional source-specific metadata stored as JSON';
