-- ============================================================
-- CREATE ingestion_runs TABLE (Phase 1)
-- ============================================================
-- Stores detailed run history for RSS ingestion jobs
-- Used by Admin panel to show "Last run status" and "Run ingest now"

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run identification
  job_name TEXT NOT NULL, -- e.g., 'ingest_rss', 'cron_runner:hourly'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'fail')),
  error_message TEXT,
  
  -- Metrics
  duration_ms INTEGER,
  feeds_processed INTEGER DEFAULT 0,
  items_fetched INTEGER DEFAULT 0,
  items_upserted INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying latest runs
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_job_name_started 
  ON public.ingestion_runs(job_name, started_at DESC);

-- Index for querying latest run per job
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_latest 
  ON public.ingestion_runs(job_name, finished_at DESC NULLS LAST);

-- Enable RLS
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Service role can manage ingestion_runs" ON public.ingestion_runs;
DROP POLICY IF EXISTS "Authenticated users can read ingestion_runs" ON public.ingestion_runs;

-- ✅ Service role: allow Edge Functions / server using service key
-- In Supabase, service requests typically carry jwt claim role=service_role
CREATE POLICY "Service role can manage ingestion_runs"
  ON public.ingestion_runs
  FOR ALL
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- ✅ Authenticated users can read run status (admin UI / "last run" widgets)
CREATE POLICY "Authenticated users can read ingestion_runs"
  ON public.ingestion_runs
  FOR SELECT
  USING ( auth.role() = 'authenticated' );

-- (Optional) If you want anon users to read latest run status too, add:
-- CREATE POLICY "Anon users can read ingestion_runs"
--   ON public.ingestion_runs
--   FOR SELECT
--   USING ( auth.role() = 'anon' );

-- Create view for latest run per job
CREATE OR REPLACE VIEW public.ingestion_runs_latest AS
SELECT DISTINCT ON (job_name)
  id,
  job_name,
  started_at,
  finished_at,
  status,
  error_message,
  duration_ms,
  feeds_processed,
  items_fetched,
  items_upserted,
  items_skipped,
  metadata,
  created_at
FROM public.ingestion_runs
ORDER BY job_name, started_at DESC;

ALTER VIEW public.ingestion_runs_latest OWNER TO postgres;
GRANT SELECT ON public.ingestion_runs_latest TO authenticated;
GRANT SELECT ON public.ingestion_runs_latest TO service_role;

COMMENT ON TABLE public.ingestion_runs IS 'Detailed run history for RSS ingestion jobs';
COMMENT ON VIEW public.ingestion_runs_latest IS 'Latest ingestion run status per job';
