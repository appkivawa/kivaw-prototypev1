-- ============================================================
-- Publisher affinity personalization (V1)
-- Adds boost by preferred tags -> feed_url mapping
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feed_affinities (
  tag text NOT NULL,
  feed_url text NOT NULL,
  weight double precision NOT NULL DEFAULT 1,
  PRIMARY KEY (tag, feed_url)
);

CREATE INDEX IF NOT EXISTS idx_feed_affinities_tag ON public.feed_affinities (tag);
CREATE INDEX IF NOT EXISTS idx_feed_affinities_feed_url ON public.feed_affinities (feed_url);

COMMENT ON TABLE public.feed_affinities IS
  'Maps preference tags (mood/focus) to RSS feed_url for personalization scoring';

-- Seed affinities for feeds you already ingest (safe upserts)
INSERT INTO public.feed_affinities (tag, feed_url, weight) VALUES
  -- reflective / thoughtful
  ('reflect', 'https://www.newyorker.com/feed/culture', 2.0),
  ('reflect', 'https://www.ft.com/?format=rss', 1.5),
  ('reflect', 'https://spectrum.ieee.org/rss', 1.2),
  ('reflect', 'https://www.technologyreview.com/feed/', 1.2),
  ('reflect', 'https://www.notboring.co/feed', 1.0),

  -- faith / grounding (best effort; tune later)
  ('faith', 'https://www.newyorker.com/feed/culture', 0.8),
  ('faith', 'https://www.ft.com/?format=rss', 0.6),

  -- build / entrepreneurship
  ('build', 'https://blog.ycombinator.com/feed/', 2.0),
  ('build', 'https://techcrunch.com/feed/', 1.5),
  ('build', 'https://www.notboring.co/feed', 1.5),
  ('build', 'https://hnrss.org/frontpage', 1.0),

  -- tech / ai
  ('tech', 'https://feeds.arstechnica.com/arstechnica/index', 1.2),
  ('tech', 'https://www.wired.com/feed/rss', 1.2),
  ('ai', 'https://www.platformer.news/feed', 2.0),
  ('ai', 'https://feeds.arstechnica.com/arstechnica/index', 1.5),
  ('ai', 'https://www.wired.com/feed/rss', 1.0)
ON CONFLICT (tag, feed_url) DO NOTHING;

-- 4) Debug helper: which affinities would apply for the user
DO $$
BEGIN
  IF to_regclass('public.user_signals') IS NOT NULL
     AND to_regclass('public.public_recommendations') IS NOT NULL
     AND to_regclass('public.feed_affinities') IS NOT NULL
     AND to_regclass('public.tag_aliases') IS NOT NULL
  THEN
    EXECUTE $exec$
      CREATE OR REPLACE FUNCTION public.debug_publisher_boost(p_user_id uuid)
      RETURNS TABLE(tag text, feed_url text, weight double precision)
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        WITH raw_preferred AS (
          SELECT lower(trim(t)) AS tag
          FROM public.user_signals us
          JOIN public.public_recommendations pr ON pr.id = us.recommendation_id
          CROSS JOIN LATERAL unnest(
            COALESCE(pr.mood_tags, '{}'::text[]) || COALESCE(pr.focus_tags, '{}'::text[])
          ) AS t
          WHERE us.user_id = p_user_id
            AND trim(t) <> ''
        ),
        expanded AS (
          SELECT rp.tag AS tag
          FROM raw_preferred rp
          UNION
          SELECT lower(ta.to_tag)
          FROM raw_preferred rp
          JOIN public.tag_aliases ta ON lower(trim(ta.from_tag)) = rp.tag
        )
        SELECT fa.tag, fa.feed_url, fa.weight
        FROM public.feed_affinities fa
        WHERE fa.tag IN (SELECT tag FROM expanded)
        ORDER BY fa.weight DESC, fa.tag, fa.feed_url;
      $body$;
    $exec$;

    COMMENT ON FUNCTION public.debug_publisher_boost(uuid) IS
      'Returns (tag, feed_url, weight) for affinities that would apply to this user. Debug only.';

    GRANT EXECUTE ON FUNCTION public.debug_publisher_boost(uuid) TO authenticated, service_role;
  END IF;
END;
$$;

-- Update get_personal_feed to add publisher boost (only when all required tables exist)
DO $$
BEGIN
  IF to_regclass('public.feed_items') IS NOT NULL
     AND to_regclass('public.user_signals') IS NOT NULL
     AND to_regclass('public.public_recommendations') IS NOT NULL
     AND to_regclass('public.tag_aliases') IS NOT NULL
     AND to_regclass('public.feed_affinities') IS NOT NULL
  THEN
    DROP FUNCTION IF EXISTS public.get_personal_feed(uuid, int, int);
    EXECUTE $exec$
      CREATE OR REPLACE FUNCTION public.get_personal_feed(
        p_user uuid,
        p_limit int DEFAULT 50,
        p_offset int DEFAULT 0
      )
      RETURNS SETOF public.feed_items
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
        p_offset := GREATEST(COALESCE(p_offset, 0), 0);

        RETURN QUERY
        WITH
        raw_preferred AS (
          SELECT lower(trim(t)) AS tag
          FROM public.user_signals us
          JOIN public.public_recommendations pr ON pr.id = us.recommendation_id
          CROSS JOIN LATERAL unnest(
            COALESCE(pr.mood_tags, '{}'::text[]) || COALESCE(pr.focus_tags, '{}'::text[])
          ) AS t
          WHERE us.user_id = p_user
            AND trim(t) <> ''
        ),
        expanded AS (
          SELECT rp.tag AS tag, 1.0::double precision AS w
          FROM raw_preferred rp
          UNION ALL
          SELECT lower(ta.to_tag), ta.weight
          FROM raw_preferred rp
          JOIN public.tag_aliases ta ON lower(trim(ta.from_tag)) = rp.tag
        ),
        preferred_weights AS (
          SELECT tag, sum(w) AS weight
          FROM expanded
          GROUP BY tag
        ),
        scored AS (
          SELECT
            fi.*,
            coalesce(fi.metadata->>'feed_url', fi.source) AS feed_key,
            COALESCE(
              (SELECT sum(pw.weight)
               FROM preferred_weights pw
               WHERE EXISTS (
                 SELECT 1 FROM unnest(COALESCE(fi.tags, '{}'::text[])) AS ft
                 WHERE lower(trim(ft)) = pw.tag
               )),
              0
            ) AS tag_boost,
            COALESCE(
              (SELECT sum(fa.weight)
               FROM preferred_weights pw
               JOIN public.feed_affinities fa
                 ON fa.tag = pw.tag
                AND fa.feed_url = (fi.metadata->>'feed_url')
              ),
              0
            ) AS publisher_boost,
            (COALESCE(fi.score, 0)
              + COALESCE(
                  (SELECT sum(pw.weight)
                   FROM preferred_weights pw
                   WHERE EXISTS (
                     SELECT 1 FROM unnest(COALESCE(fi.tags, '{}'::text[])) AS ft
                     WHERE lower(trim(ft)) = pw.tag
                   )),
                  0
                )
              + COALESCE(
                  (SELECT sum(fa.weight)
                   FROM preferred_weights pw
                   JOIN public.feed_affinities fa
                     ON fa.tag = pw.tag
                    AND fa.feed_url = (fi.metadata->>'feed_url')
                  ),
                  0
                )
            ) AS score_final
          FROM public.feed_items fi
          WHERE COALESCE(fi.is_discoverable, true) = true
        ),
        ranked AS (
          SELECT
            s.id,
            row_number() OVER (
              PARTITION BY s.feed_key
              ORDER BY s.score_final DESC NULLS LAST,
                       coalesce(s.published_at, s.ingested_at, s.created_at) DESC NULLS LAST
            ) AS rn,
            s.score_final
          FROM scored s
        ),
        capped AS (
          SELECT r.id, r.score_final
          FROM ranked r
          WHERE r.rn <= 3
        )
        SELECT fi.*
        FROM public.feed_items fi
        JOIN capped c ON c.id = fi.id
        ORDER BY c.score_final DESC NULLS LAST,
                 coalesce(fi.published_at, fi.ingested_at, fi.created_at) DESC NULLS LAST
        OFFSET p_offset
        LIMIT p_limit;
      END;
      $body$;
    $exec$;
    COMMENT ON FUNCTION public.get_personal_feed(uuid, int, int) IS
      'V1 personalization: preferred tags + tag_aliases + feed_affinities; 3-per-feed diversity cap.';
    GRANT EXECUTE ON FUNCTION public.get_personal_feed(uuid, int, int) TO anon, authenticated;
  END IF;
END;
$$;
