-- system_health: Edge Functions / cron job health (upsert by key)

CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  last_ok boolean default true not null,
  last_error text null,
  meta jsonb default '{}'::jsonb not null,
  last_run_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

CREATE UNIQUE INDEX IF NOT EXISTS system_health_key_key ON public.system_health (key);
CREATE INDEX IF NOT EXISTS idx_system_health_updated_at ON public.system_health (updated_at DESC);

CREATE OR REPLACE FUNCTION public.system_health_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_health_updated_at ON public.system_health;
CREATE TRIGGER system_health_updated_at
  BEFORE UPDATE ON public.system_health
  FOR EACH ROW EXECUTE PROCEDURE public.system_health_updated_at();

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage system_health" ON public.system_health;
CREATE POLICY "Service role can manage system_health"
  ON public.system_health FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can read system_health" ON public.system_health;
CREATE POLICY "Authenticated users can read system_health"
  ON public.system_health FOR SELECT
  USING (auth.role() = 'authenticated');
