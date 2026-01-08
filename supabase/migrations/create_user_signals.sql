-- ============================================================
-- CREATE user_signals TABLE
-- ============================================================
-- Tracks user interactions with recommendations (save, pass, try)

CREATE TABLE IF NOT EXISTS public.user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES public.public_recommendations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('save', 'pass', 'try')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, recommendation_id, action)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_signals_user_id ON public.user_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_recommendation_id ON public.user_signals(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_action ON public.user_signals(action);
CREATE INDEX IF NOT EXISTS idx_user_signals_user_recommendation ON public.user_signals(user_id, recommendation_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE RLS POLICIES
-- ============================================================

-- Users can SELECT their own signals
DROP POLICY IF EXISTS "Users can read their own signals" ON public.user_signals;
CREATE POLICY "Users can read their own signals" ON public.user_signals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can INSERT their own signals
DROP POLICY IF EXISTS "Users can insert their own signals" ON public.user_signals;
CREATE POLICY "Users can insert their own signals" ON public.user_signals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own signals
DROP POLICY IF EXISTS "Users can delete their own signals" ON public.user_signals;
CREATE POLICY "Users can delete their own signals" ON public.user_signals
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, DELETE ON public.user_signals TO authenticated;
GRANT ALL ON public.user_signals TO service_role;



