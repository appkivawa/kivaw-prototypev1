-- ============================================================
-- Add "ops" Role
-- ============================================================
-- Inserts the "ops" role into the roles table
-- ============================================================

INSERT INTO public.roles (key, name) VALUES
  ('ops', 'Operations')
ON CONFLICT (key) DO NOTHING;

-- Verify the role was inserted
SELECT id, key, name FROM public.roles WHERE key = 'ops';


