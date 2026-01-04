-- Add missing columns to content_items table for admin operations
-- Run this in Supabase SQL Editor

-- Add is_hidden column (for hiding content from public view)
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false NOT NULL;

-- Add is_reviewed column (for moderation queue)
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT false NOT NULL;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_content_items_is_hidden ON public.content_items(is_hidden) WHERE is_hidden = true;
CREATE INDEX IF NOT EXISTS idx_content_items_is_reviewed ON public.content_items(is_reviewed) WHERE is_reviewed = false;

-- Add comments
COMMENT ON COLUMN public.content_items.is_hidden IS 'Whether this content item is hidden from public view';
COMMENT ON COLUMN public.content_items.is_reviewed IS 'Whether this content item has been reviewed by an admin';

-- Verify the columns were added
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_items'
  AND column_name IN ('is_hidden', 'is_reviewed');

