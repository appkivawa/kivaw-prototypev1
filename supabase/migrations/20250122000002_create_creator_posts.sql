-- ============================================================
-- CREATE creator_posts TABLE
-- ============================================================
-- Allows creators to publish content that appears in StudioExplore/StudioFeed
-- Supports draft, pending (moderation), and published status

CREATE TABLE IF NOT EXISTS public.creator_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL, -- Post content/body text
  media_url TEXT, -- Optional: image, video, or other media URL
  tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Tags for categorization
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  published_at TIMESTAMPTZ, -- NULL for drafts/pending, set on publish
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_creator_posts_creator_user_id ON public.creator_posts(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_posts_status ON public.creator_posts(status);
CREATE INDEX IF NOT EXISTS idx_creator_posts_published_at ON public.creator_posts(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_creator_posts_created_at ON public.creator_posts(created_at DESC);

-- Index for public queries (status = 'published')
CREATE INDEX IF NOT EXISTS idx_creator_posts_published ON public.creator_posts(published_at DESC NULLS LAST)
  WHERE status = 'published';

-- Enable Row Level Security
ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Policy: Creators can CRUD their own posts
DROP POLICY IF EXISTS "Creators can manage own posts" ON public.creator_posts;
CREATE POLICY "Creators can manage own posts" ON public.creator_posts
  FOR ALL
  USING (auth.uid() = creator_user_id)
  WITH CHECK (auth.uid() = creator_user_id);

-- Policy: Public can read published posts
DROP POLICY IF EXISTS "Public can read published posts" ON public.creator_posts;
CREATE POLICY "Public can read published posts" ON public.creator_posts
  FOR SELECT
  USING (status = 'published' AND published_at IS NOT NULL);

-- Policy: Admins can read all posts (for moderation)
DROP POLICY IF EXISTS "Admins can read all creator posts" ON public.creator_posts;
CREATE POLICY "Admins can read all creator posts" ON public.creator_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Policy: Admins can update status (for approval/rejection)
DROP POLICY IF EXISTS "Admins can approve/reject creator posts" ON public.creator_posts;
CREATE POLICY "Admins can approve/reject creator posts" ON public.creator_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
    -- Only allow status updates (not other fields)
    AND (
      -- Admin can change status
      (status = OLD.status OR status IN ('pending', 'published', 'rejected'))
      -- Can't change other fields directly (creators manage their own posts)
      AND title = OLD.title
      AND body = OLD.body
      AND media_url IS NOT DISTINCT FROM OLD.media_url
      AND tags = OLD.tags
      AND creator_user_id = OLD.creator_user_id
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_creator_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at on row update
CREATE TRIGGER creator_posts_updated_at
  BEFORE UPDATE ON public.creator_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_creator_posts_updated_at();

-- Function to set published_at when status changes to 'published'
CREATE OR REPLACE FUNCTION public.set_creator_posts_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set published_at when status changes to 'published' (if not already set)
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at = NOW();
  END IF;
  
  -- Clear published_at if status changes away from 'published'
  IF NEW.status != 'published' AND OLD.status = 'published' THEN
    NEW.published_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to set published_at on status change
CREATE TRIGGER creator_posts_set_published_at
  BEFORE UPDATE ON public.creator_posts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.set_creator_posts_published_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.creator_posts IS 'Content published by creators that appears in StudioExplore/StudioFeed';
COMMENT ON COLUMN public.creator_posts.creator_user_id IS 'UUID of the creator (auth.users.id)';
COMMENT ON COLUMN public.creator_posts.title IS 'Post title';
COMMENT ON COLUMN public.creator_posts.body IS 'Post content/body text';
COMMENT ON COLUMN public.creator_posts.media_url IS 'Optional: image, video, or other media URL';
COMMENT ON COLUMN public.creator_posts.tags IS 'Tags for categorization';
COMMENT ON COLUMN public.creator_posts.status IS 'Post status: draft, pending (moderation), published, or rejected';
COMMENT ON COLUMN public.creator_posts.published_at IS 'Timestamp when post was published (NULL for drafts/pending)';

-- ============================================================
-- GRANTS
-- ============================================================

-- Grant SELECT to authenticated users (for own posts and published posts)
GRANT SELECT ON public.creator_posts TO authenticated;

-- Grant SELECT to anonymous users (for published posts only)
GRANT SELECT ON public.creator_posts TO anon;

-- Grant INSERT/UPDATE/DELETE to authenticated users (RLS will restrict to own posts)
GRANT INSERT, UPDATE, DELETE ON public.creator_posts TO authenticated;

