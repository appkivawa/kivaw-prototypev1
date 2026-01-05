-- ============================================================
-- Role-Based Access Control (RBAC) System
-- Creates roles, user_roles, and admin_allowlist tables
-- 
-- IMPORTANT: For initial setup, you may need to add the first admin
-- to admin_allowlist using the service role (which bypasses RLS).
-- After that, admins can manage the system through the UI.
-- ============================================================

-- ============================================================
-- STEP 1: CREATE ALL TABLES FIRST (before policies)
-- ============================================================

-- 1.1 ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 1.2 USER_ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

-- 1.3 ADMIN_ALLOWLIST TABLE (temporary/simple gating)
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: CREATE POLICIES (now that all tables exist)
-- ============================================================

-- 3.1 ROLES TABLE POLICIES
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;

-- Policy: Readable by authenticated users
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Writable only by admins (using admin_allowlist, admin_users, or admin role)
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL
  USING (
    -- Check admin_allowlist
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    -- Check legacy admin_users table (if exists)
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
    -- Check user_roles for admin role
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.key = 'admin'
    )
  );

-- 3.2 USER_ROLES TABLE POLICIES
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

-- Policy: Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Writable only by admins
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL
  USING (
    -- Check admin_allowlist
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    -- Check legacy admin_users table (if exists)
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
    -- Check user_roles for admin role
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.key = 'admin'
    )
  );

-- 3.3 ADMIN_ALLOWLIST TABLE POLICIES
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can read admin_allowlist" ON public.admin_allowlist;
DROP POLICY IF EXISTS "Admins can manage admin_allowlist" ON public.admin_allowlist;

-- Policy: Readable by authenticated users
CREATE POLICY "Authenticated users can read admin_allowlist" ON public.admin_allowlist
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Writable only by admins (or service role in SQL editor)
-- Note: Service role bypasses RLS, so admins can manage via SQL editor
-- For initial setup, you may need to temporarily disable RLS or use service role
CREATE POLICY "Admins can manage admin_allowlist" ON public.admin_allowlist
  FOR ALL
  USING (
    -- Check admin_allowlist (self-reference for existing admins)
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
    -- Check legacy admin_users table (if exists)
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
    -- Check user_roles for admin role
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.key = 'admin'
    )
  );

-- ============================================================
-- 4. HELPER FUNCTION: is_admin(uid)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_is_admin_func$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE user_id = check_uid) THEN
    RETURN TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = check_uid) THEN
    RETURN TRUE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_uid AND r.key = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$_is_admin_func$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Also create a version that uses the current user's ID by default
-- This is already handled by the DEFAULT auth.uid() above, but we ensure it works

-- ============================================================
-- 5. SEED ROLES
-- ============================================================
INSERT INTO public.roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('it', 'IT Support'),
  ('social_media', 'Social Media Manager'),
  ('operations', 'Operations')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_key ON public.roles(key);

-- ============================================================
-- 7. INITIAL SETUP INSTRUCTIONS
-- ============================================================
-- After running this migration, add your first admin:
--
-- Option 1: Using service role (recommended for initial setup)
-- INSERT INTO public.admin_allowlist (user_id)
-- SELECT id FROM auth.users WHERE email = 'your-admin@email.com';
--
-- Option 2: Using user_roles (after roles are seeded)
-- INSERT INTO public.user_roles (user_id, role_id)
-- SELECT 
--   (SELECT id FROM auth.users WHERE email = 'your-admin@email.com'),
--   (SELECT id FROM public.roles WHERE key = 'admin');
--
-- ============================================================
-- 8. VERIFICATION QUERIES (optional - can be removed)
-- ============================================================
-- Uncomment to verify setup:
-- SELECT 'Roles created:' as status, COUNT(*) as count FROM public.roles;
-- SELECT 'is_admin function created' as status;
-- SELECT public.is_admin() as is_current_user_admin;

