-- Add ingested_at column to feed_items table for tracking when items were ingested
-- This is used as a fallback when published_at is missing

ALTER TABLE public.feed_items
ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_feed_items_ingested_at ON public.feed_items(ingested_at DESC);

-- Update existing rows to set ingested_at = created_at if null
UPDATE public.feed_items
SET ingested_at = created_at
WHERE ingested_at IS NULL;

-- Add comment
COMMENT ON COLUMN public.feed_items.ingested_at IS 'Timestamp when the item was ingested. Used as fallback when published_at is missing.';

