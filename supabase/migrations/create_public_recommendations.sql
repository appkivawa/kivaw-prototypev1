-- ============================================================
-- CREATE public_recommendations TABLE
-- ============================================================
-- This table stores curated items for the public Explore feed.
-- Items are manually selected from external_content_cache by admins.

CREATE TABLE IF NOT EXISTS public.public_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('watch', 'read', 'event', 'listen')),
  source TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  description TEXT,
  mood_tags TEXT[] DEFAULT '{}',
  focus_tags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_public_recommendations_type ON public.public_recommendations(type);
CREATE INDEX IF NOT EXISTS idx_public_recommendations_rank_published ON public.public_recommendations(rank DESC, published_at DESC);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.public_recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE RLS POLICIES
-- ============================================================

-- Allow anonymous users to SELECT (read) from public_recommendations
DROP POLICY IF EXISTS "Anyone can read public recommendations" ON public.public_recommendations;
CREATE POLICY "Anyone can read public recommendations" ON public.public_recommendations
  FOR SELECT
  USING (true); -- Public read access

-- Only admins can INSERT
DROP POLICY IF EXISTS "Admins can insert public recommendations" ON public.public_recommendations;
CREATE POLICY "Admins can insert public recommendations" ON public.public_recommendations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'super_admin')
    )
  );

-- Only admins can UPDATE
DROP POLICY IF EXISTS "Admins can update public recommendations" ON public.public_recommendations;
CREATE POLICY "Admins can update public recommendations" ON public.public_recommendations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'super_admin')
    )
  );

-- Only admins can DELETE
DROP POLICY IF EXISTS "Admins can delete public recommendations" ON public.public_recommendations;
CREATE POLICY "Admins can delete public recommendations" ON public.public_recommendations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.key IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Grant SELECT to anon (public read access)
GRANT SELECT ON public.public_recommendations TO anon;
GRANT SELECT ON public.public_recommendations TO authenticated;

-- Grant full access to service_role (for Edge Functions)
GRANT ALL ON public.public_recommendations TO service_role;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert 2 sample rows (one watch, one read)
INSERT INTO public.public_recommendations (title, type, source, url, image_url, description, mood_tags, focus_tags, rank)
VALUES
  (
    'The Shawshank Redemption',
    'watch',
    'tmdb',
    'https://www.themoviedb.org/movie/278',
    'https://image.tmdb.org/t/p/w500/9cqN21kSXRsqh7ZbPnhc2UIZ3oA.jpg',
    'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
    ARRAY['comfort', 'reflect'],
    ARRAY['watch'],
    10
  ),
  (
    'The Alchemist',
    'read',
    'open_library',
    'https://openlibrary.org/works/OL82563W',
    'https://covers.openlibrary.org/b/id/8739161-L.jpg',
    'A shepherd boy travels from Spain to Egypt in search of treasure, discovering the importance of following one''s dreams.',
    ARRAY['faith', 'reflect'],
    ARRAY['read'],
    10
  )
ON CONFLICT DO NOTHING;
