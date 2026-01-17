-- ============================================================
-- CREATE explore_items_v2 VIEW
-- ============================================================
-- Unified view combining:
--  1. feed_items (discoverable RSS/news/social/podcast/video/music items)
--  2. public_recommendations (admin-published curated items from external_content_cache)
--  3. external_content_cache (watch/read items NOT already in public_recommendations)
--
-- MAPPING RULES:
-- ============================================================
--
-- FROM feed_items:
--   - id: 'feed_items:' || id::text (prefix for uniqueness)
--   - kind: content_kind (e.g., 'rss', 'article', 'video', 'podcast', 'music')
--   - provider: provider column (maps to source: rss, youtube, reddit, etc.)
--   - external_id: external_id (nullable)
--   - tags: COALESCE(tags, ARRAY[]::TEXT[]) || COALESCE(topics, ARRAY[]::TEXT[])
--   - byline: author (nullable)
--   - score: score (nullable, from ranking algorithm)
--   - raw: metadata JSONB (contains raw source data)
--   - created_at: created_at
--   - Only includes: WHERE is_discoverable = true
--
-- FROM public_recommendations:
--   - id: 'recommendation:' || id::text (prefix for uniqueness)
--   - kind: type (e.g., 'watch', 'read', 'event', 'listen')
--   - provider: source (e.g., 'tmdb', 'open_library')
--   - external_id: NULL (public_recommendations doesn't track provider_id)
--   - tags: COALESCE(mood_tags, ARRAY[]::TEXT[]) || COALESCE(focus_tags, ARRAY[]::TEXT[])
--   - byline: NULL (no author field)
--   - score: rank::numeric (admin-assigned rank, higher = better)
--   - raw: NULL (no raw data stored)
--   - created_at: created_at
--
-- FROM external_content_cache:
--   - id: 'cache:' || id::text (prefix for uniqueness)
--   - kind: type (e.g., 'watch', 'read')
--   - provider: provider (e.g., 'tmdb', 'open_library')
--   - external_id: provider_id
--   - tags: ARRAY[]::TEXT[] (external_content_cache doesn't have tags, use content_tags table if needed)
--   - byline: NULL (no author field)
--   - score: NULL (no score assigned)
--   - raw: raw JSONB (full provider response)
--   - created_at: fetched_at
--   - Only includes: WHERE NOT EXISTS (SELECT 1 FROM public_recommendations WHERE ...)
--     This prevents duplicates if item is already in public_recommendations
--
-- DEDUPLICATION STRATEGY:
--   - feed_items: Unique by (provider, external_id) or (provider, url)
--   - public_recommendations: Unique by id (primary key)
--   - external_content_cache: Unique by (provider, provider_id), but excluded if in public_recommendations
--   - No cross-source deduplication (same content from different sources appears separately)
--
-- ORDERING (client can override):
--   - Default: score DESC NULLS LAST, created_at DESC
--   - public_recommendations get priority (rank as score)
--   - feed_items next (score from algorithm)
--   - external_content_cache last (no score)
--
-- ============================================================

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
  -- Match by: provider + provider_id (if public_recommendations had provider_id)
  -- OR: Match by title + source (best effort deduplication)
  -- NOTE: This is approximate - exact deduplication would require cached_content_id join
  SELECT 1
  FROM public.public_recommendations pr
  WHERE pr.source = c.provider
    AND (
      -- Best effort: match by title similarity or URL
      (pr.url IS NOT NULL AND c.url IS NOT NULL AND pr.url = c.url)
      OR (pr.title = c.title AND pr.source = c.provider)
    )
);

-- ============================================================
-- GRANTS
-- ============================================================

-- Grant SELECT to authenticated users (same as explore_items_v1)
GRANT SELECT ON public.explore_items_v2 TO authenticated;

-- Grant SELECT to anonymous users (for public Explore page)
GRANT SELECT ON public.explore_items_v2 TO anon;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON VIEW public.explore_items_v2 IS 
'Unified view of all discoverable content for Explore feed. Combines feed_items (RSS/news/social), public_recommendations (curated), and external_content_cache (movies/books/TV). Output schema: id (text), kind (text), provider (text), external_id (text), url (text), title (text), byline (text), image_url (text), tags (text[]), created_at (timestamptz), raw (jsonb), score (numeric nullable).';

-- ============================================================
-- INDEXES (on underlying tables, not on view)
-- ============================================================
-- Note: Views cannot be indexed directly. Ensure these indexes exist on source tables:
--
-- feed_items:
--   - idx_feed_items_is_discoverable (already exists)
--   - idx_feed_items_discoverable_score_published (already exists)
--
-- public_recommendations:
--   - idx_public_recommendations_rank_published (already exists)
--
-- external_content_cache:
--   - idx_external_content_cache_provider_type (already exists)
--   - idx_external_content_cache_fetched_at (already exists)
--
-- If these indexes are missing, add them in a separate migration.
-- ============================================================

