-- ============================================================
-- Baseline: user_signals table (required for get_personal_feed / debug helpers)
-- Copied from migrations_old/20260112000324_create_user_signals.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.public_recommendations(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('save', 'pass', 'try')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recommendation_id, action)
);

CREATE INDEX IF NOT EXISTS idx_user_signals_user_id ON public.user_signals (user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_recommendation_id ON public.user_signals (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_action ON public.user_signals (action);
CREATE INDEX IF NOT EXISTS idx_user_signals_user_recommendation ON public.user_signals (user_id, recommendation_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_user_id_created_at ON public.user_signals (user_id, created_at DESC);
