-- ============================================================
-- VERIFICATION: explore_items_v2 exists and has expected columns
-- ============================================================
-- Run manually in SQL editor if needed. Not required for db reset.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'explore_items_v2'
  ) THEN
    RAISE NOTICE 'explore_items_v2 view exists with columns: %',
      (SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'explore_items_v2');
  END IF;
END;
$$;
