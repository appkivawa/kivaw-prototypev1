-- ============================================================
-- CREATE explore_items_v2 VIEW
-- ============================================================
-- 
-- VERIFICATION QUERIES (run after creating view):
-- 
-- 1. Check RSS freshness (should be within 7 days):
--    SELECT kind, MAX(published_at) as newest_published
--    FROM explore_items_v2
--    WHERE kind IN ('rss', 'atom', 'article', 'news')
--    GROUP BY kind;
--
-- 2. Check book publish years (should be >= 2000):
--    SELECT kind, provider, 
--           (raw->>'first_publish_year')::int as publish_year
--    FROM explore_items_v2
--    WHERE kind = 'read' AND provider = 'open_library'
--    ORDER BY publish_year DESC NULLS LAST
--    LIMIT 20;
--
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

-- Drop existing view if it exists (to allow column changes)
DROP VIEW IF EXISTS public.explore_items_v2 CASCADE;

CREATE VIEW public.explore_items_v2 AS
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
  summary,
  COALESCE(tags, ARRAY[]::TEXT[]) || COALESCE(topics, ARRAY[]::TEXT[]) AS tags,
  -- Use published_at if available, fallback to created_at
  COALESCE(published_at, created_at) AS created_at,
  COALESCE(metadata, '{}'::jsonb) AS raw,
  -- Add recency score boost for RSS items (0-5 points, heavily favor today's items)
  CASE 
    WHEN content_kind IN ('rss', 'atom', 'article', 'news') AND published_at IS NOT NULL THEN
      score + CASE
        -- Today's items get maximum boost (5 points)
        WHEN published_at >= date_trunc('day', NOW()) THEN 5.0
        -- Yesterday gets 3 points
        WHEN published_at >= date_trunc('day', NOW()) - INTERVAL '1 day' THEN 3.0
        -- Last 3 days get 2 points
        WHEN published_at >= date_trunc('day', NOW()) - INTERVAL '3 days' THEN 2.0
        -- Last 7 days get 1 point
        WHEN published_at >= date_trunc('day', NOW()) - INTERVAL '7 days' THEN 1.0
        ELSE 0.0
      END
    ELSE score
  END AS score
FROM public.feed_items
WHERE is_discoverable = true
  -- Exclude stale RSS items (older than 7 days)
  AND NOT (
    content_kind IN ('rss', 'atom', 'article', 'news')
    AND COALESCE(published_at, created_at) < NOW() - INTERVAL '7 days'
  )

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
  NULL::TEXT AS summary,
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
  -- Derive summary from raw for TMDB and books, fallback to description column
  CASE
    -- TMDB: use overview or description from raw
    WHEN c.provider = 'tmdb' THEN
      COALESCE(
        NULLIF(c.raw->>'overview', ''),
        NULLIF(c.raw->>'description', ''),
        c.description
      )
    -- Books (Open Library, Google Books): use description from raw (can be string or {value: string})
    WHEN c.type = 'read' THEN
      COALESCE(
        NULLIF(c.raw->>'description', ''),
        NULLIF(c.raw#>>'{description,value}', ''),
        NULLIF(c.raw->>'subtitle', ''),
        c.description
      )
    -- Fallback to description column
    ELSE c.description
  END AS summary,
  ARRAY[]::TEXT[] AS tags,
  c.fetched_at AS created_at,
  c.raw,
  -- Optional scoring bump for newer publish years (for books)
  CASE 
    WHEN c.type = 'read' AND c.raw->>'first_publish_year' IS NOT NULL THEN
      GREATEST(
        0.0,
        LEAST(
          2.0,
          (CAST(c.raw->>'first_publish_year' AS INTEGER) - 1990) / 10.0
        )
      )
    ELSE NULL
  END AS score
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
'Unified view of all discoverable content for Explore feed. Combines feed_items (RSS/news/social), public_recommendations (curated), and external_content_cache (movies/books/TV). Output schema: id (text), kind (text), provider (text), external_id (text), url (text), title (text), byline (text), image_url (text), summary (text), tags (text[]), created_at (timestamptz), raw (jsonb), score (numeric nullable). RSS items use published_at for created_at and get recency score boost. Books get score boost for newer publish years.';

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


