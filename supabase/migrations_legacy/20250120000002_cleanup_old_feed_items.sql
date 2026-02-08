-- Create cleanup function to delete feed items older than 60 days
-- This function should be called periodically (e.g., via pg_cron or scheduled job)

CREATE OR REPLACE FUNCTION public.cleanup_old_feed_items()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  deleted BIGINT;
BEGIN
  -- Calculate cutoff date: 60 days ago
  cutoff_date := NOW() - INTERVAL '60 days';
  
  -- Delete items older than 60 days
  -- Use published_at if available, otherwise use ingested_at, otherwise use created_at
  DELETE FROM public.feed_items
  WHERE 
    COALESCE(published_at, ingested_at, created_at) < cutoff_date;
  
  GET DIAGNOSTICS deleted = ROW_COUNT;
  
  RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_old_feed_items() TO service_role;

-- Add comment
COMMENT ON FUNCTION public.cleanup_old_feed_items() IS 'Deletes feed items older than 60 days. Uses published_at, ingested_at, or created_at (in that order) to determine age.';

-- Optional: Schedule via pg_cron (if extension is enabled)
-- Uncomment and adjust schedule as needed:
-- SELECT cron.schedule(
--   'cleanup-old-feed-items',
--   '0 2 * * *', -- Run daily at 2 AM
--   $$SELECT public.cleanup_old_feed_items();$$
-- );





