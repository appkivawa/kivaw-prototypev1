-- ============================================================
-- CREATE explore_items_v2 VIEW
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This creates the unified view that the explore_feed_v2 Edge Function queries

CREATE OR REPLACE VIEW public.explore_items_v2 AS
SELECT 
  'feed_items:' || id::text AS id,
  content_kind AS kind,
  COALESCE(provider, source) AS provider,
  external_id,
  url,
  title,
  COALESCE(author, NULL) AS byline,
  image_url,
  COALESCE(tags, ARRAY[]::TEXT[]) || COALESCE(topics, ARRAY[]::TEXT[]) AS tags,
  created_at,
  COALESCE(metadata, '{}'::jsonb) AS raw,
  score
FROM public.feed_items
WHERE is_discoverable = true

UNION ALL

SELECT 
  'recommendation:' || id::text AS id,
  type AS kind,
  source AS provider,
  NULL::TEXT AS external_id,
  url,
  title,
  NULL::TEXT AS byline,
  image_url,
  COALESCE(mood_tags, ARRAY[]::TEXT[]) || COALESCE(focus_tags, ARRAY[]::TEXT[]) AS tags,
  created_at,
  NULL::jsonb AS raw,
  rank::numeric AS score
FROM public.public_recommendations

UNION ALL

SELECT 
  'cache:' || c.id::text AS id,
  c.type AS kind,
  c.provider,
  c.provider_id AS external_id,
  c.url,
  c.title,
  NULL::TEXT AS byline,
  c.image_url,
  ARRAY[]::TEXT[] AS tags,
  c.fetched_at AS created_at,
  c.raw,
  NULL::numeric AS score
FROM public.external_content_cache c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.public_recommendations pr
  WHERE pr.source = c.provider
    AND (
      (pr.url IS NOT NULL AND c.url IS NOT NULL AND pr.url = c.url)
      OR (pr.title = c.title AND pr.source = c.provider)
    )
);

GRANT SELECT ON public.explore_items_v2 TO authenticated;
GRANT SELECT ON public.explore_items_v2 TO anon;

COMMENT ON VIEW public.explore_items_v2 IS 
'Unified view of all discoverable content for Explore feed. Combines feed_items (RSS/news/social), public_recommendations (curated), and external_content_cache (movies/books/TV).';


