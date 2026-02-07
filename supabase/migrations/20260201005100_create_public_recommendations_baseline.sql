-- ============================================================
-- Baseline: public_recommendations table (required for get_personal_feed / user_signals)
-- Copied from migrations_old/20250116000010_create_public_recommendations.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.public_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  source text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  image_url text NULL,
  mood_tags text[] NULL,
  focus_tags text[] NULL,
  rank integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_recommendations_created_at ON public.public_recommendations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_recommendations_rank ON public.public_recommendations (rank DESC);
