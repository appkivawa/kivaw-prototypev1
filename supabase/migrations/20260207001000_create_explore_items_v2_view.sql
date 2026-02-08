-- ============================================================
-- CREATE explore_items_v2 VIEW (unified feed_items + public_recommendations + external_content_cache)
-- ============================================================

DROP VIEW IF EXISTS public.explore_items_v2 CASCADE;

CREATE VIEW public.explore_items_v2 AS
SELECT 
  'feed_items:' || id::text AS id,
  content_kind AS kind,
  COALESCE(provider, source) AS provider,
  external_id,
  url,
  title,
  COALESCE(author, NULL) AS byline,
  image_url,
  summary,
  COALESCE(tags, ARRAY[]::TEXT[]) || COALESCE(topics, ARRAY[]::TEXT[]) AS tags,
  COALESCE(published_at, created_at) AS created_at,
  COALESCE(metadata, '{}'::jsonb) AS raw,
  CASE 
    WHEN content_kind IN ('rss', 'atom', 'article', 'news') AND published_at IS NOT NULL THEN
      COALESCE(score, 0) + CASE
        WHEN published_at >= date_trunc('day', NOW()) THEN 5.0
        WHEN published_at >= date_trunc('day', NOW()) - INTERVAL '1 day' THEN 3.0
        WHEN published_at >= date_trunc('day', NOW()) - INTERVAL '3 days' THEN 2.0
        WHEN published_at >= date_trunc('day', NOW()) - INTERVAL '7 days' THEN 1.0
        ELSE 0.0
      END
    ELSE score
  END AS score
FROM public.feed_items
WHERE COALESCE(is_discoverable, true) = true
  AND NOT (
    content_kind IN ('rss', 'atom', 'article', 'news')
    AND COALESCE(published_at, created_at) < NOW() - INTERVAL '7 days'
  )

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
  NULL::TEXT AS summary,
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
  CASE
    WHEN c.provider = 'tmdb' THEN
      COALESCE(NULLIF(c.raw->>'overview', ''), NULLIF(c.raw->>'description', ''), c.description)
    WHEN c.type = 'read' THEN
      COALESCE(NULLIF(c.raw->>'description', ''), NULLIF(c.raw#>>'{description,value}', ''), NULLIF(c.raw->>'subtitle', ''), c.description)
    ELSE c.description
  END AS summary,
  ARRAY[]::TEXT[] AS tags,
  c.fetched_at AS created_at,
  c.raw,
  CASE 
    WHEN c.type = 'read' AND c.raw->>'first_publish_year' IS NOT NULL THEN
      GREATEST(0.0, LEAST(2.0, (CAST(c.raw->>'first_publish_year' AS INTEGER) - 1990) / 10.0))
    ELSE NULL
  END AS score
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

GRANT SELECT ON public.explore_items_v2 TO authenticated, anon;

COMMENT ON VIEW public.explore_items_v2 IS 
'Unified view for Explore feed: feed_items + public_recommendations + external_content_cache.';
