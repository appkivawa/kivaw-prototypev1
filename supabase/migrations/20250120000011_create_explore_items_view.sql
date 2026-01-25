-- Create explore_items_v1 view for Explore feed queries
-- This view provides a normalized interface to discoverable feed items
-- with consistent column ordering and default sorting

CREATE OR REPLACE VIEW public.explore_items_v1 AS
SELECT 
  id,
  content_kind,
  provider,
  external_id,
  url,
  title,
  summary,
  image_url,
  published_at,
  tags,
  topics,
  score,
  created_at
FROM public.feed_items
WHERE is_discoverable = true
ORDER BY 
  score DESC NULLS LAST,
  published_at DESC NULLS LAST;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON public.explore_items_v1 TO authenticated;

-- Add comment
COMMENT ON VIEW public.explore_items_v1 IS 'Normalized view of discoverable feed items for Explore feed. Filtered by is_discoverable=true, ordered by score desc (nulls last), published_at desc (nulls last).';




