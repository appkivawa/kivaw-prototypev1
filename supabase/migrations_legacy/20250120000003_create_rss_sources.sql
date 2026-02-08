-- Create rss_sources table for default/global RSS feed sources
-- This table stores default RSS sources that are available to all users

CREATE TABLE IF NOT EXISTS public.rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g., 'tech', 'culture', 'finance', 'music'
  
  -- Metadata
  weight INTEGER DEFAULT 1 CHECK (weight >= 1 AND weight <= 5), -- Priority/weight (1-5), default 1
  language TEXT DEFAULT 'en',
  active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on URL to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_sources_url ON public.rss_sources(url);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rss_sources_category ON public.rss_sources(category);
CREATE INDEX IF NOT EXISTS idx_rss_sources_active ON public.rss_sources(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_rss_sources_weight ON public.rss_sources(weight DESC);

-- Enable Row Level Security
ALTER TABLE public.rss_sources ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read active RSS sources
DROP POLICY IF EXISTS "Users can read active RSS sources" ON public.rss_sources;
CREATE POLICY "Users can read active RSS sources" ON public.rss_sources
  FOR SELECT
  USING (active = true);

-- Policy: Allow service role to manage RSS sources
DROP POLICY IF EXISTS "Service role can manage RSS sources" ON public.rss_sources;
CREATE POLICY "Service role can manage RSS sources" ON public.rss_sources
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE public.rss_sources IS 'Default/global RSS feed sources available to all users';
COMMENT ON COLUMN public.rss_sources.category IS 'Category: tech, culture, finance, music, etc.';
COMMENT ON COLUMN public.rss_sources.weight IS 'Priority weight (1-5), higher = more important';
COMMENT ON COLUMN public.rss_sources.active IS 'Whether this source is currently active and should be ingested';

