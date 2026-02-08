-- ============================================================
-- DISABLE pg_cron JOBS (Phase 1 Consolidation) - SAFE / NO-OP IF MISSING
-- ============================================================
-- Goal: prevent double-ingestion by disabling any pg_cron jobs.
-- If pg_cron isn't installed (no schema "cron"), this migration does nothing.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Unschedule by jobid (most compatible)
    PERFORM cron.unschedule(j.jobid)
    FROM cron.job j
    WHERE j.jobname IN ('rss-ingest-hourly', 'ingestion-runner');
  END IF;
END
$$;

-- Verify any remaining jobs with those names (should be 0 rows)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- This SELECT is just for your manual inspection in SQL editor
    -- It will show rows if anything is still scheduled.
    NULL;
  END IF;
END
$$;

-- If cron schema exists, run this manually to confirm:
-- SELECT jobid, jobname, schedule, command
-- FROM cron.job
-- WHERE jobname IN ('rss-ingest-hourly', 'ingestion-runner');
