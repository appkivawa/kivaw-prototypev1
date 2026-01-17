-- Create movies table for storing ingested movie data from TMDB
-- This table provides a dedicated schema for movies used in explore UI

CREATE TABLE IF NOT EXISTS public.movies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'tmdb',
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  overview TEXT,
  poster_url TEXT,
  release_date DATE,
  genres TEXT[] DEFAULT '{}',
  popularity NUMERIC(10, 2) DEFAULT 0,
  rating NUMERIC(3, 1) DEFAULT 0,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Unique constraint for idempotency
  CONSTRAINT movies_provider_external_id_unique UNIQUE (provider, external_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_movies_provider_external_id ON public.movies(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON public.movies(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_movies_popularity ON public.movies(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_movies_rating ON public.movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_movies_genres ON public.movies USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_movies_updated_at ON public.movies(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read movies
DROP POLICY IF EXISTS "Authenticated users can read movies" ON public.movies;
CREATE POLICY "Authenticated users can read movies" ON public.movies
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy: Service role can manage movies (for edge functions)
DROP POLICY IF EXISTS "Service role can manage movies" ON public.movies;
CREATE POLICY "Service role can manage movies" ON public.movies
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Add comments
COMMENT ON TABLE public.movies IS 'Stores ingested movie data from TMDB and other providers';
COMMENT ON COLUMN public.movies.provider IS 'Content provider (e.g., tmdb)';
COMMENT ON COLUMN public.movies.external_id IS 'Provider-specific movie ID (e.g., TMDB movie ID)';
COMMENT ON COLUMN public.movies.genres IS 'Array of genre names or IDs';
COMMENT ON COLUMN public.movies.popularity IS 'TMDB popularity score';
COMMENT ON COLUMN public.movies.rating IS 'Average rating (0-10 scale)';
COMMENT ON COLUMN public.movies.raw IS 'Raw JSON data from provider API';



