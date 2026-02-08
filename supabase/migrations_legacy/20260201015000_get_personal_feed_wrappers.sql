-- ============================================================
-- Wrappers for get_personal_feed (self = auth.uid(), any = dev/testing)
-- Only create when public.feed_items exists AND get_personal_feed exists.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.feed_items') IS NOT NULL
     AND to_regprocedure('public.get_personal_feed(uuid,int,int)') IS NOT NULL
  THEN
    EXECUTE $exec$
      CREATE OR REPLACE FUNCTION public.get_personal_feed_self(p_limit int, p_offset int)
      RETURNS SETOF public.feed_items
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT * FROM public.get_personal_feed(auth.uid(), p_limit, p_offset);
      $body$;
    $exec$;

    EXECUTE $exec$
      CREATE OR REPLACE FUNCTION public.get_personal_feed_any(p_limit int, p_offset int)
      RETURNS SETOF public.feed_items
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT *
        FROM public.get_personal_feed(
          (SELECT us.user_id
           FROM public.user_signals us
           ORDER BY us.created_at DESC
           LIMIT 1),
          p_limit,
          p_offset
        );
      $body$;
    $exec$;

    GRANT EXECUTE ON FUNCTION public.get_personal_feed_self(int,int) TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_personal_feed_any(int,int) TO anon, authenticated;
  END IF;
END;
$$;
