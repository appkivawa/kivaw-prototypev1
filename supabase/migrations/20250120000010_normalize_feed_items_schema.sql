-- Normalize feed_items schema to ensure required columns exist
-- Adds content_kind and provider columns, normalizes external_id to be nullable
-- Creates unique index for deduplication

-- Add content_kind column (if missing)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS content_kind TEXT NOT NULL DEFAULT 'rss';

-- Add provider column (if missing) - maps to source for existing data
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'rss';

-- Populate provider from source for existing rows (if provider is default but source exists)
DO $$
BEGIN
  -- Only update if provider is still default 'rss' and source has a different value
  UPDATE public.feed_items
  SET provider = source
  WHERE provider = 'rss' 
    AND source IS NOT NULL 
    AND source != 'rss';
END $$;

-- Make external_id nullable (if currently NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feed_items' 
    AND column_name = 'external_id'
    AND is_nullable = 'NO'
  ) THEN
    -- First, ensure no NULL external_ids exist (set a placeholder if needed)
    UPDATE public.feed_items
    SET external_id = COALESCE(external_id, 'temp_' || id::text)
    WHERE external_id IS NULL;
    
    -- Then make it nullable
    ALTER TABLE public.feed_items ALTER COLUMN external_id DROP NOT NULL;
    
    -- Restore NULLs where we used placeholder
    UPDATE public.feed_items
    SET external_id = NULL
    WHERE external_id LIKE 'temp_%';
  END IF;
END $$;

-- Ensure summary column exists (nullable)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Ensure image_url column exists (nullable)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure published_at column exists (nullable)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Ensure tags column exists (nullable TEXT[])
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Ensure topics column exists (nullable TEXT[])
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS topics TEXT[];

-- Ensure score column exists (nullable)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS score FLOAT8;

-- Ensure is_discoverable column exists (with default)
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT true;

-- Drop old unique index if it exists (we'll create better ones)
DROP INDEX IF EXISTS public.idx_feed_items_source_external_id;

-- Create unique index: prefer (provider, external_id) when external_id is present
-- This uses a partial unique index to ensure uniqueness for rows with external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_provider_external_id 
  ON public.feed_items(provider, external_id)
  WHERE external_id IS NOT NULL;

-- Create unique index: fallback to (provider, url) for rows without external_id
-- This uses a partial unique index to ensure uniqueness for rows without external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_provider_url 
  ON public.feed_items(provider, url)
  WHERE external_id IS NULL;

-- Add comments
COMMENT ON COLUMN public.feed_items.content_kind IS 'Content type: rss, article, video, etc.';
COMMENT ON COLUMN public.feed_items.provider IS 'Source provider: rss, youtube, reddit, podcast, etc.';
COMMENT ON COLUMN public.feed_items.external_id IS 'Unique identifier from the provider (nullable, used for deduplication when present)';

