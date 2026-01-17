-- Create job_runs table for tracking cron job execution status
-- This table tracks when jobs last ran, their status, and any errors/results

CREATE TABLE IF NOT EXISTS public.job_runs (
  job_name TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped', 'running')),
  error_message TEXT,
  result_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add missing columns if they don't exist (for tables created before this migration)
DO $$
BEGIN
  -- Add status column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_runs' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.job_runs 
    ADD COLUMN status TEXT NOT NULL DEFAULT 'skipped' 
    CHECK (status IN ('success', 'error', 'skipped', 'running'));
    
    -- Remove the default after adding the column
    ALTER TABLE public.job_runs ALTER COLUMN status DROP DEFAULT;
  END IF;
  
  -- Add error_message column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_runs' 
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.job_runs 
    ADD COLUMN error_message TEXT;
  END IF;
  
  -- Add result_summary column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_runs' 
    AND column_name = 'result_summary'
  ) THEN
    ALTER TABLE public.job_runs 
    ADD COLUMN result_summary JSONB;
  END IF;
  
  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_runs' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.job_runs 
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
  
  -- Add updated_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_runs' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.job_runs 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Create index on last_run_at for quick lookups
CREATE INDEX IF NOT EXISTS idx_job_runs_last_run_at ON public.job_runs(last_run_at DESC);

-- Create index on status for filtering (only if status column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_runs' 
    AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_job_runs_status ON public.job_runs(status);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage job_runs (for edge functions)
DROP POLICY IF EXISTS "Service role can manage job_runs" ON public.job_runs;
CREATE POLICY "Service role can manage job_runs" ON public.job_runs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admins can read job_runs (for monitoring)
DROP POLICY IF EXISTS "Admins can read job_runs" ON public.job_runs;
CREATE POLICY "Admins can read job_runs" ON public.job_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Insert initial rows for known jobs (if they don't exist)
INSERT INTO public.job_runs (job_name, status, last_run_at)
VALUES
  ('rss_ingest', 'skipped', NULL),
  ('movies_ingest', 'skipped', NULL)
ON CONFLICT (job_name) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.job_runs IS 'Tracks execution status and timing for cron jobs (RSS ingest, movies ingest, etc.)';
COMMENT ON COLUMN public.job_runs.job_name IS 'Unique identifier for the job (e.g., rss_ingest, movies_ingest)';
COMMENT ON COLUMN public.job_runs.last_run_at IS 'Timestamp of the last job execution';
COMMENT ON COLUMN public.job_runs.status IS 'Current status: success, error, skipped, or running';
COMMENT ON COLUMN public.job_runs.error_message IS 'Error message if status is error';
COMMENT ON COLUMN public.job_runs.result_summary IS 'JSON summary of job results (e.g., items ingested, feeds processed)';

