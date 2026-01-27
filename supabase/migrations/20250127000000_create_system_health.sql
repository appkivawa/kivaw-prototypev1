-- ============================================================
-- CREATE system_health TABLE
-- ============================================================
-- Tracks health/heartbeat for cron jobs and system components
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_health (
  key TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ok BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_system_health_last_run_at ON public.system_health(last_run_at DESC);

-- Enable RLS (but allow service role to write)
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- Allow service role to read/write
CREATE POLICY "Service role can manage system_health"
  ON public.system_health
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to read (for admin dashboard)
CREATE POLICY "Authenticated users can read system_health"
  ON public.system_health
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.system_health IS 'System health/heartbeat tracking for cron jobs and components';
COMMENT ON COLUMN public.system_health.key IS 'Unique key identifying the job/component (e.g., cron_runner:hourly)';
COMMENT ON COLUMN public.system_health.last_run_at IS 'Timestamp of last run';
COMMENT ON COLUMN public.system_health.last_ok IS 'Whether the last run was successful';
COMMENT ON COLUMN public.system_health.last_error IS 'Error message if last run failed';
COMMENT ON COLUMN public.system_health.meta IS 'Additional metadata (counts, details, etc.)';
