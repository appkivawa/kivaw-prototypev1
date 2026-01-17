-- ============================================================
-- ADD creator_posts TO explore_items_v2 VIEW
-- ============================================================
-- Extends explore_items_v2 to include published creator posts
-- Creator posts appear with kind="creator" and provider="kivaw"

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
-- ============================================================
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
  -- Exclude items that are already in public_recommendations
  SELECT 1
  FROM public.public_recommendations pr
  WHERE pr.source = c.provider
    AND (
      (pr.url IS NOT NULL AND c.url IS NOT NULL AND pr.url = c.url)
      OR (pr.title = c.title AND pr.source = c.provider)
    )
)

UNION ALL

-- ============================================================
-- SOURCE 4: creator_posts (published creator content)
-- ============================================================
SELECT 
  'creator_post:' || id::text AS id,
  'creator'::TEXT AS kind,
  'kivaw'::TEXT AS provider,
  NULL::TEXT AS external_id,
  NULL::TEXT AS url, -- Creator posts don't have external URLs
  title,
  NULL::TEXT AS byline, -- Could add creator name from profiles if needed
  media_url AS image_url,
  COALESCE(tags, ARRAY[]::TEXT[]) AS tags,
  COALESCE(published_at, created_at) AS created_at,
  jsonb_build_object(
    'body', body,
    'creator_user_id', creator_user_id,
    'post_id', id
  ) AS raw,
  NULL::numeric AS score -- Creator posts don't have scores (could add later)
FROM public.creator_posts
WHERE status = 'published'
  AND published_at IS NOT NULL;

-- ============================================================
-- UPDATE COMMENTS
-- ============================================================

COMMENT ON VIEW public.explore_items_v2 IS 
'Unified view of all discoverable content for Explore feed. Combines feed_items (RSS/news/social), public_recommendations (curated), external_content_cache (movies/books/TV), and creator_posts (published creator content). Output schema: id (text), kind (text), provider (text), external_id (text), url (text), title (text), byline (text), image_url (text), tags (text[]), created_at (timestamptz), raw (jsonb), score (numeric nullable).';

