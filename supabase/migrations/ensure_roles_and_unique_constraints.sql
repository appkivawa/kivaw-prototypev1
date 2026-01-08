-- ============================================================
-- Ensure All Required Roles Exist and user_roles Has Unique Constraint
-- ============================================================
-- This migration:
-- 1. Ensures all required roles exist (creator, partner, ops, admin)
-- 2. Verifies/enforces unique constraint on user_roles (user_id, role_id)
-- 3. Safe to run multiple times (idempotent)
-- ============================================================

-- ============================================================
-- STEP 1: ENSURE ALL REQUIRED ROLES EXIST
-- ============================================================

INSERT INTO public.roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('it', 'IT Support'),
  ('social_media', 'Social Media Manager'),
  ('operations', 'Operations'),
  ('ops', 'Operations'),
  ('creator', 'Creator'),
  ('partner', 'Partner')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 2: VERIFY UNIQUE CONSTRAINT ON user_roles
-- ============================================================

-- Check if PRIMARY KEY constraint exists (which enforces uniqueness)
DO $$
BEGIN
  -- Check if primary key constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_pkey'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    -- If no primary key, check if unique constraint exists
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname LIKE 'user_roles_%_key'
        AND conrelid = 'public.user_roles'::regclass
        AND contype = 'u'
    ) THEN
      -- Add unique constraint if neither exists
      ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
      
      RAISE NOTICE 'Added unique constraint on user_roles (user_id, role_id)';
    ELSE
      RAISE NOTICE 'Unique constraint already exists on user_roles';
    END IF;
  ELSE
    RAISE NOTICE 'Primary key constraint already exists on user_roles (enforces uniqueness)';
  END IF;
END $$;

-- ============================================================
-- STEP 3: CLEAN UP ANY DUPLICATE ROLE ASSIGNMENTS (if they exist)
-- ============================================================

-- Remove duplicate role assignments, keeping the oldest one
DELETE FROM public.user_roles ur1
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur2
  WHERE ur2.user_id = ur1.user_id
    AND ur2.role_id = ur1.role_id
    AND ur2.created_at < ur1.created_at
);

-- ============================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================

-- Verify all required roles exist
SELECT
  'Required roles check' as check_type,
  COUNT(*) FILTER (WHERE key IN ('admin', 'it', 'social_media', 'operations', 'ops', 'creator', 'partner')) as found_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE key IN ('admin', 'it', 'social_media', 'operations', 'ops', 'creator', 'partner')) = 7
    THEN '✅ All required roles exist'
    ELSE '⚠️ Some roles missing'
  END as status
FROM public.roles
WHERE key IN ('admin', 'it', 'social_media', 'operations', 'ops', 'creator', 'partner');

-- Verify unique constraint exists
SELECT
  'Unique constraint check' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE (conname = 'user_roles_pkey' OR conname LIKE 'user_roles_%_key')
        AND conrelid = 'public.user_roles'::regclass
        AND (contype = 'p' OR contype = 'u')
    )
    THEN '✅ Unique constraint exists'
    ELSE '⚠️ No unique constraint found'
  END as status;

-- ============================================================
-- NOTES
-- ============================================================
-- - The PRIMARY KEY on (user_id, role_id) already enforces uniqueness
-- - This migration ensures the constraint exists and cleans duplicates
-- - Role assignment code should use INSERT ... ON CONFLICT DO NOTHING
--   or check before inserting to avoid constraint violations
-- ============================================================


