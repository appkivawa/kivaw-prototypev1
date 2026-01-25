-- Create ingestion_runs table for tracking ingestion job execution
-- This table tracks when ingestion jobs run, their status, and detailed results
-- Used for observability and "Last updated" labels in UI

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL, -- 'rss_ingest', 'sync_external_content', 'cron_runner' (orchestrator)
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ, -- NULL if still running or failed before completion
  details JSONB DEFAULT '{}'::jsonb, -- Job-specific details (items ingested, errors, etc.)
  error_message TEXT, -- Error message if status is 'error'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_job_name ON public.ingestion_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON public.ingestion_runs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started_at ON public.ingestion_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_finished_at ON public.ingestion_runs(finished_at DESC NULLS LAST);

-- Index for "last successful run" queries (most common)
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_job_success ON public.ingestion_runs(job_name, status, finished_at DESC NULLS LAST)
  WHERE status = 'success';

-- Enable Row Level Security
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage ingestion_runs (for edge functions)
DROP POLICY IF EXISTS "Service role can manage ingestion_runs" ON public.ingestion_runs;
CREATE POLICY "Service role can manage ingestion_runs" ON public.ingestion_runs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Authenticated users can read ingestion_runs (for "Last updated" display)
DROP POLICY IF EXISTS "Authenticated users can read ingestion_runs" ON public.ingestion_runs;
CREATE POLICY "Authenticated users can read ingestion_runs" ON public.ingestion_runs
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy: Admins can read ingestion_runs (for monitoring)
DROP POLICY IF EXISTS "Admins can read ingestion_runs" ON public.ingestion_runs;
CREATE POLICY "Admins can read ingestion_runs" ON public.ingestion_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Helper function: Get last successful run for a job
CREATE OR REPLACE FUNCTION public.get_last_successful_ingestion(job_name_param TEXT)
RETURNS TABLE (
  job_name TEXT,
  finished_at TIMESTAMPTZ,
  details JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    i.job_name,
    i.finished_at,
    i.details
  FROM public.ingestion_runs i
  WHERE i.job_name = job_name_param
    AND i.status = 'success'
    AND i.finished_at IS NOT NULL
  ORDER BY i.finished_at DESC
  LIMIT 1;
$$;

-- Helper function: Get last successful run across all jobs (for orchestrator)
CREATE OR REPLACE FUNCTION public.get_last_successful_ingestion_all()
RETURNS TABLE (
  job_name TEXT,
  finished_at TIMESTAMPTZ,
  details JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (i.job_name)
    i.job_name,
    i.finished_at,
    i.details
  FROM public.ingestion_runs i
  WHERE i.status = 'success'
    AND i.finished_at IS NOT NULL
  ORDER BY i.job_name, i.finished_at DESC;
$$;

-- Add comments
COMMENT ON TABLE public.ingestion_runs IS 'Tracks execution status and timing for ingestion jobs (RSS ingest, external content sync, etc.)';
COMMENT ON COLUMN public.ingestion_runs.job_name IS 'Unique identifier for the job (e.g., rss_ingest, sync_external_content, cron_runner)';
COMMENT ON COLUMN public.ingestion_runs.status IS 'Current status: success, error, or running';
COMMENT ON COLUMN public.ingestion_runs.started_at IS 'Timestamp when the job started';
COMMENT ON COLUMN public.ingestion_runs.finished_at IS 'Timestamp when the job finished (NULL if still running or failed)';
COMMENT ON COLUMN public.ingestion_runs.details IS 'JSON summary of job results (e.g., items ingested, feeds processed, errors)';
COMMENT ON COLUMN public.ingestion_runs.error_message IS 'Error message if status is error';
COMMENT ON FUNCTION public.get_last_successful_ingestion(TEXT) IS 'Get the last successful run for a specific job';
COMMENT ON FUNCTION public.get_last_successful_ingestion_all() IS 'Get the last successful run for all jobs';


