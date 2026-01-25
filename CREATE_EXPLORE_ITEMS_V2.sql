-- ============================================================
-- CREATE explore_items_v2 VIEW (Complete version with normalized kinds)
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This creates the unified view that the explore_feed_v2 Edge Function queries
-- Normalizes external_content_cache types to standard kinds: 'watch', 'read', 'listen'
-- Note: creator_posts UNION is commented out - uncomment when creator_posts table exists

CREATE OR REPLACE VIEW public.explore_items_v2 AS
-- ============================================================
-- SOURCE 1: feed_items (RSS, news, social, podcasts, videos, music)
-- ============================================================
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

-- ============================================================
-- SOURCE 2: public_recommendations (admin-published curated items)
-- ============================================================
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

-- ============================================================
-- SOURCE 3: external_content_cache (only items NOT in public_recommendations)
-- Normalizes type to standard kinds: 'watch', 'read', 'listen'
-- ============================================================
SELECT 
  'cache:' || c.id::text AS id,
  CASE 
    WHEN LOWER(c.type) IN ('movie', 'tv', 'show', 'video', 'youtube', 'tmdb_movie', 'tmdb_tv', 'tmdb') THEN 'watch'
    WHEN LOWER(c.type) IN ('book', 'openlibrary_book', 'open_library', 'reading', 'google_books') THEN 'read'
    WHEN LOWER(c.type) IN ('podcast', 'episode', 'audio', 'spotify') THEN 'listen'
    ELSE c.type
  END AS kind,
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
  -- Exclude items that are already in public_recommendations
  SELECT 1
  FROM public.public_recommendations pr
  WHERE pr.source = c.provider
    AND (
      (pr.url IS NOT NULL AND c.url IS NOT NULL AND pr.url = c.url)
      OR (pr.title = c.title AND pr.source = c.provider)
    )
);

-- ============================================================
-- SECURITY AND GRANTS
-- ============================================================

ALTER VIEW public.explore_items_v2 SET (security_invoker = true);

GRANT SELECT ON public.explore_items_v2 TO authenticated;
GRANT SELECT ON public.explore_items_v2 TO anon;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON VIEW public.explore_items_v2 IS 
'Unified view of all discoverable content for Explore feed. Combines feed_items (RSS/news/social), public_recommendations (curated), and external_content_cache (movies/books/TV with normalized kinds: watch/read/listen). Output schema: id (text), kind (text), provider (text), external_id (text), url (text), title (text), byline (text), image_url (text), tags (text[]), created_at (timestamptz), raw (jsonb), score (numeric nullable).';

-- ============================================================
-- OPTIONAL: Add creator_posts when table exists
-- ============================================================
-- Uncomment the following when creator_posts table is created:
--
-- CREATE OR REPLACE VIEW public.explore_items_v2 AS
-- SELECT 
--   'feed_items:' || id::text AS id,
--   content_kind AS kind,
--   COALESCE(provider, source) AS provider,
--   external_id,
--   url,
--   title,
--   COALESCE(author, NULL) AS byline,
--   image_url,
--   COALESCE(tags, ARRAY[]::TEXT[]) || COALESCE(topics, ARRAY[]::TEXT[]) AS tags,
--   created_at,
--   COALESCE(metadata, '{}'::jsonb) AS raw,
--   score
-- FROM public.feed_items
-- WHERE is_discoverable = true
-- UNION ALL
-- SELECT 
--   'recommendation:' || id::text AS id,
--   type AS kind,
--   source AS provider,
--   NULL::TEXT AS external_id,
--   url,
--   title,
--   NULL::TEXT AS byline,
--   image_url,
--   COALESCE(mood_tags, ARRAY[]::TEXT[]) || COALESCE(focus_tags, ARRAY[]::TEXT[]) AS tags,
--   created_at,
--   NULL::jsonb AS raw,
--   rank::numeric AS score
-- FROM public.public_recommendations
-- UNION ALL
-- SELECT 
--   'cache:' || c.id::text AS id,
--   CASE 
--     WHEN LOWER(c.type) IN ('movie', 'tv', 'show', 'video', 'youtube', 'tmdb_movie', 'tmdb_tv', 'tmdb') THEN 'watch'
--     WHEN LOWER(c.type) IN ('book', 'openlibrary_book', 'open_library', 'reading', 'google_books') THEN 'read'
--     WHEN LOWER(c.type) IN ('podcast', 'episode', 'audio', 'spotify') THEN 'listen'
--     ELSE c.type
--   END AS kind,
--   c.provider,
--   c.provider_id AS external_id,
--   c.url,
--   c.title,
--   NULL::TEXT AS byline,
--   c.image_url,
--   ARRAY[]::TEXT[] AS tags,
--   c.fetched_at AS created_at,
--   c.raw,
--   NULL::numeric AS score
-- FROM public.external_content_cache c
-- WHERE NOT EXISTS (
--   SELECT 1
--   FROM public.public_recommendations pr
--   WHERE pr.source = c.provider
--     AND (
--       (pr.url IS NOT NULL AND c.url IS NOT NULL AND pr.url = c.url)
--       OR (pr.title = c.title AND pr.source = c.provider)
--     )
-- )
-- UNION ALL
-- SELECT 
--   'creator_post:' || id::text AS id,
--   'creator'::TEXT AS kind,
--   'kivaw'::TEXT AS provider,
--   NULL::TEXT AS external_id,
--   NULL::TEXT AS url,
--   title,
--   NULL::TEXT AS byline,
--   media_url AS image_url,
--   COALESCE(tags, ARRAY[]::TEXT[]) AS tags,
--   COALESCE(published_at, created_at) AS created_at,
--   jsonb_build_object(
--     'body', body,
--     'creator_user_id', creator_user_id,
--     'post_id', id
--   ) AS raw,
--   NULL::numeric AS score
-- FROM public.creator_posts
-- WHERE status = 'published'
--   AND published_at IS NOT NULL;
