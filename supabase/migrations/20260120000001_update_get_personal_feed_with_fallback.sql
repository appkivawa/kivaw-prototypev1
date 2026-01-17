-- Update get_personal_feed function to support tags coverage-based fallback matching
-- If tags coverage < 60%, uses ILIKE fallback on title/summary
-- If tags coverage >= 60%, uses tag-based matching

CREATE OR REPLACE FUNCTION public.get_personal_feed(
  p_user UUID,
  p_limit INT DEFAULT 50,
  p_use_fallback BOOLEAN DEFAULT NULL -- NULL = auto-detect based on coverage
)
RETURNS TABLE (
  id UUID,
  content_kind TEXT,
  provider TEXT,
  external_id TEXT,
  url TEXT,
  title TEXT,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  tags TEXT[],
  topics TEXT[],
  score FLOAT8,
  created_at TIMESTAMPTZ,
  score_final FLOAT8
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_interests TEXT[];
  v_interest_match_bonus FLOAT8;
  v_tags_coverage FLOAT8;
  v_use_fallback BOOLEAN;
BEGIN
  -- Security check: Only allow users to query their own feed
  IF p_user IS NULL OR p_user != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You can only query your own feed';
  END IF;

  -- Get user interests from profiles table
  SELECT COALESCE(interests, '{}'::TEXT[]) INTO v_user_interests
  FROM public.profiles
  WHERE id = p_user;

  -- If no interests, use empty array
  IF v_user_interests IS NULL THEN
    v_user_interests := '{}'::TEXT[];
  END IF;

  -- Calculate tags coverage: % of feed_items with non-null, non-empty tags
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 0.0
      ELSE (COUNT(*) FILTER (WHERE fi.tags IS NOT NULL AND array_length(fi.tags, 1) > 0)::FLOAT / COUNT(*)::FLOAT) * 100.0
    END INTO v_tags_coverage
  FROM public.feed_items fi
  WHERE fi.is_discoverable = true;

  -- Determine if we should use fallback (ILIKE matching)
  -- If p_use_fallback is explicitly set, use it; otherwise auto-detect (< 60% = use fallback)
  IF p_use_fallback IS NOT NULL THEN
    v_use_fallback := p_use_fallback;
  ELSE
    v_use_fallback := (v_tags_coverage < 60.0);
  END IF;

  -- Return personalized feed items with interest-based scoring
  RETURN QUERY
  WITH scored_items AS (
    SELECT 
      fi.id,
      fi.content_kind,
      fi.provider,
      fi.external_id,
      fi.url,
      fi.title,
      fi.summary,
      fi.image_url,
      fi.published_at,
      fi.tags,
      fi.topics,
      fi.score,
      fi.created_at,
      -- Calculate score_final: base score + interest match bonus
      CASE
        WHEN v_use_fallback THEN
          -- Fallback mode: ILIKE matching on title/summary
          (
            COALESCE(fi.score, 0) +
            LEAST(
              (
                -- Count interests that match title or summary via ILIKE
                (SELECT COUNT(*) FROM unnest(v_user_interests) AS interest
                 WHERE fi.title ILIKE '%' || interest || '%' 
                    OR fi.summary ILIKE '%' || interest || '%')
              ) * 0.5, -- 0.5 points per ILIKE match
              10.0 -- Cap bonus at 10 points
            )
          )
        ELSE
          -- Tag-based mode: prefer tag/topic matching
          (
            COALESCE(fi.score, 0) +
            LEAST(
              (
                -- Count matching tags
                (SELECT COUNT(*) FROM unnest(COALESCE(fi.tags, '{}'::TEXT[])) AS tag
                 WHERE tag = ANY(v_user_interests)) +
                -- Count matching topics
                (SELECT COUNT(*) FROM unnest(COALESCE(fi.topics, '{}'::TEXT[])) AS topic
                 WHERE topic = ANY(v_user_interests))
              ) * 0.5, -- 0.5 points per match
              10.0 -- Cap bonus at 10 points
            )
          )
      END AS score_final
    FROM public.feed_items fi
    WHERE fi.is_discoverable = true
      AND (
        -- Filter: only include items that match interests
        CASE
          WHEN v_use_fallback THEN
            -- Fallback: match if any interest appears in title/summary
            EXISTS (
              SELECT 1 FROM unnest(v_user_interests) AS interest
              WHERE fi.title ILIKE '%' || interest || '%' 
                 OR fi.summary ILIKE '%' || interest || '%'
            )
          ELSE
            -- Tag-based: match if tags/topics overlap with interests
            (
              COALESCE(fi.tags, '{}'::TEXT[]) && v_user_interests
              OR COALESCE(fi.topics, '{}'::TEXT[]) && v_user_interests
            )
        END
        OR array_length(v_user_interests, 1) IS NULL -- If no interests, show all
        OR array_length(v_user_interests, 1) = 0 -- If empty interests, show all
      )
  )
  SELECT 
    si.id,
    si.content_kind,
    si.provider,
    si.external_id,
    si.url,
    si.title,
    si.summary,
    si.image_url,
    si.published_at,
    si.tags,
    si.topics,
    si.score,
    si.created_at,
    si.score_final
  FROM scored_items si
  ORDER BY 
    si.score_final DESC NULLS LAST,
    si.published_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_personal_feed(UUID, INT, BOOLEAN) TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_personal_feed IS 
  'Returns personalized feed items for a user, filtered by is_discoverable=true and scored based on interest overlap. '
  'Only allows users to query their own feed (auth.uid() check). '
  'Auto-detects tags coverage: if < 60%, uses ILIKE fallback matching on title/summary; otherwise uses tag-based matching. '
  'p_use_fallback parameter can override auto-detection (NULL = auto, TRUE = force fallback, FALSE = force tag-based). '
  'Interest match bonus: 0.5 points per matching tag/topic/ILIKE match (capped at 10 points). '
  'Returns same columns as explore_items_v1 plus score_final, ordered by score_final desc, published_at desc.';

