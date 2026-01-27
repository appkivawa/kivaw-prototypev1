-- ============================================================
-- CREATE system_health_events TABLE
-- ============================================================
-- Detailed event history for all cron jobs and ingest functions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'fail')),
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_health_events_job_name ON public.system_health_events(job_name);
CREATE INDEX IF NOT EXISTS idx_system_health_events_ran_at ON public.system_health_events(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_events_status ON public.system_health_events(status);
CREATE INDEX IF NOT EXISTS idx_system_health_events_job_ran_at ON public.system_health_events(job_name, ran_at DESC);

-- Enable RLS
ALTER TABLE public.system_health_events ENABLE ROW LEVEL SECURITY;

-- Service role can manage (for edge functions)
CREATE POLICY "Service role can manage system_health_events"
  ON public.system_health_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read (for admin dashboard)
CREATE POLICY "Authenticated users can read system_health_events"
  ON public.system_health_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE public.system_health_events IS 'Detailed event history for cron jobs and ingest functions';
COMMENT ON COLUMN public.system_health_events.job_name IS 'Name of the job/function (e.g., ingest_rss, cron_runner:hourly)';
COMMENT ON COLUMN public.system_health_events.ran_at IS 'When the job ran';
COMMENT ON COLUMN public.system_health_events.status IS 'ok or fail';
COMMENT ON COLUMN public.system_health_events.duration_ms IS 'How long the job took in milliseconds';
COMMENT ON COLUMN public.system_health_events.error_message IS 'Error message if status is fail';
COMMENT ON COLUMN public.system_health_events.metadata IS 'Additional metadata (counts, details, etc.)';

-- ============================================================
-- CREATE system_health_latest VIEW
-- ============================================================
-- Shows the latest status per job for easy querying
-- ============================================================

CREATE OR REPLACE VIEW public.system_health_latest AS
SELECT DISTINCT ON (job_name)
  id,
  job_name,
  ran_at,
  status,
  duration_ms,
  error_message,
  metadata,
  created_at
FROM public.system_health_events
ORDER BY job_name, ran_at DESC;

COMMENT ON VIEW public.system_health_latest IS 'Latest health event per job for quick status checks';

-- ============================================================
-- HELPER FUNCTION: log_health_event
-- ============================================================
-- Convenience function for edge functions to log events
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_health_event(
  p_job_name TEXT,
  p_status TEXT,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.system_health_events (
    job_name,
    ran_at,
    status,
    duration_ms,
    error_message,
    metadata
  )
  VALUES (
    p_job_name,
    NOW(),
    p_status,
    p_duration_ms,
    p_error_message,
    p_metadata
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_health_event IS 'Helper function for edge functions to log health events';

-- Grant execute to service role (edge functions use service role)
GRANT EXECUTE ON FUNCTION public.log_health_event TO service_role;
GRANT EXECUTE ON FUNCTION public.log_health_event TO authenticated;
