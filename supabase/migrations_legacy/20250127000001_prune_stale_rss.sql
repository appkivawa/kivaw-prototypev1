-- ============================================================
-- RSS PRUNE FUNCTION
-- ============================================================
-- Marks RSS items older than 14 days as undiscoverable
-- Safe to call from cron_runner or pg_cron
-- ============================================================

CREATE OR REPLACE FUNCTION public.prune_stale_rss(days_old INTEGER DEFAULT 14)
RETURNS TABLE(pruned_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mark RSS items older than specified days as undiscoverable
  UPDATE public.feed_items
  SET is_discoverable = FALSE
  WHERE content_kind IN ('rss', 'atom', 'article', 'news')
    AND is_discoverable = TRUE
    AND COALESCE(published_at, created_at) < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count;
END;
$$;

COMMENT ON FUNCTION public.prune_stale_rss IS 'Marks RSS items older than specified days as undiscoverable. Default: 14 days.';
