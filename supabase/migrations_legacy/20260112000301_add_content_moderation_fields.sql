-- Add moderation fields to content_items table
-- These fields allow admins to hide content and mark items as reviewed

ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT false;

-- Create index for faster queries on hidden/reviewed status
CREATE INDEX IF NOT EXISTS idx_content_items_is_hidden ON public.content_items(is_hidden);
CREATE INDEX IF NOT EXISTS idx_content_items_is_reviewed ON public.content_items(is_reviewed);

-- Add comment for documentation
COMMENT ON COLUMN public.content_items.is_hidden IS 'If true, this content item is hidden from public view';
COMMENT ON COLUMN public.content_items.is_reviewed IS 'If true, this content item has been reviewed by an admin';

