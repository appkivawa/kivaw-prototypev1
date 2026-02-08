-- CREATE public.public_recommendations (baseline for explore_items_v2 and user_signals)

CREATE TABLE IF NOT EXISTS public.public_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  mood_tags TEXT[],
  focus_tags TEXT[],
  rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_recommendations_created_at
  ON public.public_recommendations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_recommendations_rank
  ON public.public_recommendations (rank DESC);
