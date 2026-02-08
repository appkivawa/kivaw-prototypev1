-- Add is_discoverable, score, topics, and tags columns to feed_items table
-- These columns support the Explore feed filtering and ranking

-- Add is_discoverable column (default true for existing items)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT true;

-- Add score column (nullable, will be set by ingest functions)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS score FLOAT8;

-- Ensure topics and tags columns exist (they may already exist from previous migration)
-- These are already TEXT[] in the original table creation, but ensure they're nullable
-- Note: These columns already exist as TEXT[] in the original table, so we just ensure they're nullable
DO $$
BEGIN
  -- Only alter if column exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feed_items' 
    AND column_name = 'topics'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.feed_items ALTER COLUMN topics DROP NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feed_items' 
    AND column_name = 'tags'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.feed_items ALTER COLUMN tags DROP NOT NULL;
  END IF;
END $$;

-- Create index on is_discoverable for efficient filtering
CREATE INDEX IF NOT EXISTS idx_feed_items_is_discoverable 
  ON public.feed_items(is_discoverable) 
  WHERE is_discoverable = true;

-- Create index on score for efficient ordering
CREATE INDEX IF NOT EXISTS idx_feed_items_score 
  ON public.feed_items(score DESC NULLS LAST);

-- Create composite index for common Explore query pattern
CREATE INDEX IF NOT EXISTS idx_feed_items_discoverable_score_published 
  ON public.feed_items(is_discoverable, score DESC NULLS LAST, published_at DESC NULLS LAST)
  WHERE is_discoverable = true;

-- Comments
COMMENT ON COLUMN public.feed_items.is_discoverable IS 'Whether this item should appear in Explore feed. Default true.';
COMMENT ON COLUMN public.feed_items.score IS 'Relevance score for ranking in Explore feed. Higher is better. Null items sort last.';
COMMENT ON COLUMN public.feed_items.topics IS 'Array of topic tags for categorization and filtering';
COMMENT ON COLUMN public.feed_items.tags IS 'Array of content tags for categorization and filtering';

