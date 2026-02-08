-- CREATE user_signals TABLE (baseline for personalization / get_personal_feed)

CREATE TABLE IF NOT EXISTS public.user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recommendation_id UUID NOT NULL REFERENCES public.public_recommendations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, recommendation_id, action)
);

CREATE INDEX IF NOT EXISTS idx_user_signals_user_id ON public.user_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_recommendation_id ON public.user_signals(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_user_id_created_at ON public.user_signals (user_id, created_at DESC);
