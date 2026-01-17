-- ============================================================
-- VERIFICATION QUERIES FOR explore_items_v2 VIEW
-- ============================================================
-- Run these queries after creating the view to verify it works correctly
-- ============================================================

-- ============================================================
-- 1. Basic count check - verify view returns data
-- ============================================================
SELECT 
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE id LIKE 'feed_items:%') AS feed_items_count,
  COUNT(*) FILTER (WHERE id LIKE 'recommendation:%') AS recommendations_count,
  COUNT(*) FILTER (WHERE id LIKE 'cache:%') AS cache_count
FROM public.explore_items_v2;

-- ============================================================
-- 2. Sample mixed content - see items from all sources
-- ============================================================
SELECT 
  id,
  kind,
  provider,
  external_id,
  title,
  byline,
  tags,
  score,
  CASE 
    WHEN id LIKE 'feed_items:%' THEN 'feed_items'
    WHEN id LIKE 'recommendation:%' THEN 'public_recommendations'
    WHEN id LIKE 'cache:%' THEN 'external_content_cache'
  END AS source_table,
  created_at
FROM public.explore_items_v2
ORDER BY 
  CASE 
    WHEN id LIKE 'feed_items:%' THEN 1
    WHEN id LIKE 'recommendation:%' THEN 2
    WHEN id LIKE 'cache:%' THEN 3
  END,
  score DESC NULLS LAST,
  created_at DESC NULLS LAST
LIMIT 20;

-- ============================================================
-- 3. Verify deduplication - check no external_content_cache 
--    items appear that are already in public_recommendations
-- ============================================================
-- This query should return 0 rows if deduplication works correctly
SELECT 
  c.id AS cache_id,
  c.title AS cache_title,
  c.provider AS cache_provider,
  pr.id AS recommendation_id,
  pr.title AS recommendation_title,
  pr.source AS recommendation_source
FROM public.external_content_cache c
INNER JOIN public.public_recommendations pr ON 
  (pr.url IS NOT NULL AND c.url IS NOT NULL AND pr.url = c.url)
  OR (pr.title = c.title AND pr.source = c.provider)
WHERE EXISTS (
  SELECT 1 FROM public.explore_items_v2 v
  WHERE v.id = 'cache:' || c.id::text
);

-- ============================================================
-- 4. Group by kind - see distribution of content types
-- ============================================================
SELECT 
  kind,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE id LIKE 'feed_items:%') AS from_feed_items,
  COUNT(*) FILTER (WHERE id LIKE 'recommendation:%') AS from_recommendations,
  COUNT(*) FILTER (WHERE id LIKE 'cache:%') AS from_cache
FROM public.explore_items_v2
GROUP BY kind
ORDER BY count DESC;

-- ============================================================
-- 5. Group by provider - see distribution of providers
-- ============================================================
SELECT 
  provider,
  COUNT(*) AS count,
  array_agg(DISTINCT kind) AS kinds,
  COUNT(*) FILTER (WHERE id LIKE 'feed_items:%') AS from_feed_items,
  COUNT(*) FILTER (WHERE id LIKE 'recommendation:%') AS from_recommendations,
  COUNT(*) FILTER (WHERE id LIKE 'cache:%') AS from_cache
FROM public.explore_items_v2
GROUP BY provider
ORDER BY count DESC;

-- ============================================================
-- 6. Check score distribution - verify scoring works
-- ============================================================
SELECT 
  CASE 
    WHEN id LIKE 'feed_items:%' THEN 'feed_items'
    WHEN id LIKE 'recommendation:%' THEN 'public_recommendations'
    WHEN id LIKE 'cache:%' THEN 'external_content_cache'
  END AS source_table,
  COUNT(*) AS total,
  COUNT(score) AS has_score,
  COUNT(*) FILTER (WHERE score IS NULL) AS null_score,
  MIN(score) AS min_score,
  MAX(score) AS max_score,
  AVG(score) AS avg_score
FROM public.explore_items_v2
GROUP BY 
  CASE 
    WHEN id LIKE 'feed_items:%' THEN 'feed_items'
    WHEN id LIKE 'recommendation:%' THEN 'public_recommendations'
    WHEN id LIKE 'cache:%' THEN 'external_content_cache'
  END;

-- ============================================================
-- 7. Sample items with tags - verify tag merging works
-- ============================================================
SELECT 
  id,
  kind,
  provider,
  title,
  tags,
  array_length(tags, 1) AS tag_count
FROM public.explore_items_v2
WHERE array_length(tags, 1) > 0
ORDER BY array_length(tags, 1) DESC
LIMIT 10;

-- ============================================================
-- 8. Verify schema - check all required columns exist
-- ============================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'explore_items_v2'
ORDER BY ordinal_position;

-- ============================================================
-- EXPECTED OUTPUT:
-- ============================================================
-- 1. Total items > 0, with counts from all 3 sources
-- 2. Sample shows mixed content with different id prefixes
-- 3. Deduplication query returns 0 rows (no duplicates)
-- 4. Kind distribution shows: rss, article, video, podcast, watch, read, etc.
-- 5. Provider distribution shows: rss, youtube, reddit, tmdb, open_library, etc.
-- 6. Score distribution: feed_items may have scores, recommendations have ranks, cache is NULL
-- 7. Tags are merged correctly (feed_items tags+topics, recommendations mood_tags+focus_tags)
-- 8. Schema has all required columns: id, kind, provider, external_id, url, title, byline, image_url, tags, created_at, raw, score
-- ============================================================

