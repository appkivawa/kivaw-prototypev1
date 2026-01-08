-- ============================================================
-- RECOMMENDATION ENGINE SCHEMA
-- ============================================================
-- Creates tables for unified content, user preferences, interactions,
-- and internal actions (Move/Create/Reset)
-- ============================================================

-- ============================================================
-- 1. CONTENT_ITEMS TABLE
-- ============================================================
-- Unified content across all sources (TMDB, Open Library, manual entries)

CREATE TABLE IF NOT EXISTS public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('watch', 'read', 'listen', 'move', 'create', 'reset')),
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  source TEXT NOT NULL, -- 'tmdb', 'open_library', 'manual', 'internal'
  source_id TEXT, -- Original ID from external source
  
  -- Normalized attributes
  tags TEXT[] DEFAULT '{}', -- e.g., ['comfort', 'reflection', 'faith']
  genres TEXT[] DEFAULT '{}', -- e.g., ['drama', 'comedy', 'fiction']
  intensity NUMERIC(3,2) DEFAULT 0.5 CHECK (intensity >= 0 AND intensity <= 1),
  cognitive_load NUMERIC(3,2) DEFAULT 0.5 CHECK (cognitive_load >= 0 AND cognitive_load <= 1),
  novelty NUMERIC(3,2) DEFAULT 0.5 CHECK (novelty >= 0 AND novelty <= 1),
  duration_min INTEGER, -- Runtime in minutes (null for non-time-bound items)
  popularity NUMERIC(3,2) DEFAULT 0.5 CHECK (popularity >= 0 AND popularity <= 1),
  rating NUMERIC(3,2), -- 0-1 normalized rating (null if unavailable)
  
  -- Metadata
  image_url TEXT,
  raw_data JSONB, -- Original API response or manual entry data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for content_items
CREATE INDEX IF NOT EXISTS idx_content_items_type ON public.content_items(type);
CREATE INDEX IF NOT EXISTS idx_content_items_source ON public.content_items(source);
CREATE INDEX IF NOT EXISTS idx_content_items_tags ON public.content_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_content_items_genres ON public.content_items USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_content_items_intensity ON public.content_items(intensity);
CREATE INDEX IF NOT EXISTS idx_content_items_duration ON public.content_items(duration_min) WHERE duration_min IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_items_rating ON public.content_items(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_items_source_id ON public.content_items(source, source_id) WHERE source_id IS NOT NULL;

-- ============================================================
-- 2. USER_PREFERENCES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tag preferences
  liked_tags TEXT[] DEFAULT '{}',
  disliked_tags TEXT[] DEFAULT '{}',
  
  -- Genre preferences
  liked_genres TEXT[] DEFAULT '{}',
  disliked_genres TEXT[] DEFAULT '{}',
  
  -- Tolerance levels (0-1)
  intensity_tolerance NUMERIC(3,2) DEFAULT 0.5 CHECK (intensity_tolerance >= 0 AND intensity_tolerance <= 1),
  novelty_tolerance NUMERIC(3,2) DEFAULT 0.5 CHECK (novelty_tolerance >= 0 AND novelty_tolerance <= 1),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INTERACTION_EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'save', 'skip', 'dismiss')),
  state TEXT CHECK (state IN ('blank', 'destructive', 'expansive', 'minimize')),
  focus TEXT CHECK (focus IN ('music', 'watch', 'read', 'move', 'create', 'reset')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for interaction_events
CREATE INDEX IF NOT EXISTS idx_interaction_events_user_id ON public.interaction_events(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_content_id ON public.interaction_events(content_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_action ON public.interaction_events(action);
CREATE INDEX IF NOT EXISTS idx_interaction_events_user_action ON public.interaction_events(user_id, action);
CREATE INDEX IF NOT EXISTS idx_interaction_events_created_at ON public.interaction_events(created_at DESC);

-- ============================================================
-- 4. INTERNAL_ACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.internal_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('move', 'create', 'reset')),
  title TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER, -- Optional time estimate
  energy_min INTEGER CHECK (energy_min >= 1 AND energy_min <= 5), -- Minimum energy level required
  state_fit TEXT[] DEFAULT '{}', -- Which states this action fits: ['blank', 'destructive', 'expansive', 'minimize']
  tags TEXT[] DEFAULT '{}',
  intensity NUMERIC(3,2) DEFAULT 0.5 CHECK (intensity >= 0 AND intensity <= 1),
  cognitive_load NUMERIC(3,2) DEFAULT 0.5 CHECK (cognitive_load >= 0 AND cognitive_load <= 1),
  novelty NUMERIC(3,2) DEFAULT 0.5 CHECK (novelty >= 0 AND novelty <= 1),
  link TEXT, -- Optional external link or internal route
  why TEXT, -- Pre-computed explanation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for internal_actions
CREATE INDEX IF NOT EXISTS idx_internal_actions_type ON public.internal_actions(type);
CREATE INDEX IF NOT EXISTS idx_internal_actions_state_fit ON public.internal_actions USING GIN(state_fit);
CREATE INDEX IF NOT EXISTS idx_internal_actions_tags ON public.internal_actions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_internal_actions_intensity ON public.internal_actions(intensity);
CREATE INDEX IF NOT EXISTS idx_internal_actions_energy_min ON public.internal_actions(energy_min);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- Content items: public read, admin write
CREATE POLICY "Anyone can read content_items" ON public.content_items
  FOR SELECT USING (true);

-- User preferences: users can read/write their own
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Interaction events: users can read/write their own
CREATE POLICY "Users can view their own interactions" ON public.interaction_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions" ON public.interaction_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Internal actions: public read
CREATE POLICY "Anyone can read internal_actions" ON public.internal_actions
  FOR SELECT USING (true);

-- ============================================================
-- 7. UPDATE TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_internal_actions_updated_at
  BEFORE UPDATE ON public.internal_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();



