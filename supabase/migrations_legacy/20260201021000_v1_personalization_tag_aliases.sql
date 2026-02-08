-- ============================================================
-- V1 Personalization: tag_aliases + preferred tags from
-- user_signals -> public_recommendations (mood_tags/focus_tags)
-- ============================================================

-- 1. CREATE TABLE tag_aliases (from_tag -> to_tag with weight)
CREATE TABLE IF NOT EXISTS public.tag_aliases (
  from_tag text NOT NULL,
  to_tag text NOT NULL,
  weight double precision NOT NULL DEFAULT 1,
  PRIMARY KEY (from_tag, to_tag)
);

CREATE INDEX IF NOT EXISTS idx_tag_aliases_from ON public.tag_aliases(lower(from_tag));
CREATE INDEX IF NOT EXISTS idx_tag_aliases_to ON public.tag_aliases(lower(to_tag));

COMMENT ON TABLE public.tag_aliases IS 'Maps recommendation mood/focus tags to feed_items tags for personalization scoring';

-- 2. Seed starter mappings (lowercased)
INSERT INTO public.tag_aliases (from_tag, to_tag, weight) VALUES
  ('reflect', 'philosophy', 1),
  ('reflect', 'psychology', 1),
  ('faith', 'christianity', 1),
  ('faith', 'theology', 1),
  ('minimize', 'productivity', 1),
  ('minimize', 'simplicity', 1),
  ('build', 'startups', 1),
  ('build', 'entrepreneurship', 1),
  ('tech', 'technology', 1),
  ('ai', 'ai', 1),
  ('money', 'finance', 1),
  ('health', 'wellness', 1),
  ('art', 'culture', 1),
  ('news', 'politics', 1),
  ('learn', 'education', 1)
ON CONFLICT (from_tag, to_tag) DO NOTHING;

-- Ensure user_signals exists (baseline may not include it yet)
CREATE TABLE IF NOT EXISTS public.user_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recommendation_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional but recommended: FK + index
DO $$
BEGIN
  IF to_regclass('public.public_recommendations') IS NOT NULL THEN
    ALTER TABLE public.user_signals
      ADD CONSTRAINT user_signals_recommendation_id_fkey
      FOREIGN KEY (recommendation_id)
      REFERENCES public.public_recommendations(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists
  NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_signals_user_id_created_at
  ON public.user_signals (user_id, created_at DESC);

-- 3. get_personal_feed: only create when public.feed_items exists (RETURNS SETOF public.feed_items resolved at EXECUTE time)
DO $$
BEGIN
  IF to_regclass('public.feed_items') IS NOT NULL THEN
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
            fi.id,
            fi.source_type,
            fi.source_id,
            fi.source_item_id,
            fi.url,
            fi.title,
            fi.summary,
            fi.author,
            fi.image_url,
            fi.published_at,
            fi.tags,
            fi.topics,
            fi.raw,
            fi.metadata,
            fi.ingested_at,
            fi.created_at,
            fi.source,
            fi.external_id,
            fi.is_discoverable,
            fi.score,
            fi.content_kind,
            fi.provider,
            (COALESCE(fi.score, 0) + COALESCE(
              (SELECT sum(pw.weight)
               FROM preferred_weights pw
               WHERE EXISTS (
                 SELECT 1 FROM unnest(COALESCE(fi.tags, '{}'::text[])) AS ft
                 WHERE lower(trim(ft)) = pw.tag
               )),
              0
            )) AS score_final,
            coalesce(fi.metadata->>'feed_url', fi.source) AS feed_key
          FROM public.feed_items fi
          WHERE COALESCE(fi.is_discoverable, true) = true
        ),
        ranked AS (
          SELECT
            s.*,
            row_number() OVER (PARTITION BY s.feed_key ORDER BY s.score_final DESC NULLS LAST, s.published_at DESC NULLS LAST) AS rn
          FROM scored s
        ),
        capped AS (
          SELECT ranked.id
          FROM ranked
          WHERE ranked.rn <= 3
        )
        SELECT fi.*
        FROM public.feed_items fi
        JOIN capped c ON c.id = fi.id
        JOIN ranked r ON r.id = fi.id
        ORDER BY r.score_final DESC NULLS LAST, r.published_at DESC NULLS LAST
        OFFSET p_offset
        LIMIT p_limit;
      END;
      $body$;
    $exec$;
    COMMENT ON FUNCTION public.get_personal_feed(uuid, int, int) IS
      'V1 personalization: preferred tags from user_signals->public_recommendations (mood_tags/focus_tags), expanded via tag_aliases; boosts feed_items when tags overlap; 3-per-feed diversity cap by metadata->feed_url/source.';
    GRANT EXECUTE ON FUNCTION public.get_personal_feed(uuid, int, int) TO anon, authenticated;
  END IF;
END;
$$;

-- 4. Debug helper: only create when user_signals and public_recommendations exist
DO $$
BEGIN
  IF to_regclass('public.user_signals') IS NOT NULL AND to_regclass('public.public_recommendations') IS NOT NULL THEN
    EXECUTE $exec$
      CREATE OR REPLACE FUNCTION public.debug_preferred_tags(p_user_id uuid)
      RETURNS TABLE(tag text, weight double precision)
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
          SELECT rp.tag AS tag, 1.0::double precision AS w
          FROM raw_preferred rp
          UNION ALL
          SELECT lower(ta.to_tag), ta.weight
          FROM raw_preferred rp
          JOIN public.tag_aliases ta ON lower(trim(ta.from_tag)) = rp.tag
        )
        SELECT tag, sum(w)::double precision AS weight
        FROM expanded
        GROUP BY tag
        ORDER BY weight DESC;
      $body$;
    $exec$;
    COMMENT ON FUNCTION public.debug_preferred_tags(uuid) IS 'Returns expanded preferred tags and weights for a user (from user_signals->public_recommendations + tag_aliases). Debug only.';
    GRANT EXECUTE ON FUNCTION public.debug_preferred_tags(uuid) TO authenticated, service_role;
  END IF;
END;
$$;
