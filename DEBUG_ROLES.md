# Debug Roles Loading Issue

## Steps to Diagnose

### 1. Check Browser Console
Open browser DevTools (F12) → Console tab, and look for:
- `[Users] Loading roles...`
- `[Users] Roles query result:`
- Any error messages

**Share what you see in the console.**

### 2. Check if Roles Table Exists
Run this in Supabase SQL Editor:

```sql
-- Check if roles table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'roles'
) as roles_table_exists;

-- Check role count
SELECT COUNT(*) as role_count FROM public.roles;

-- List all roles
SELECT * FROM public.roles;
```

### 3. Check RLS Policies
Run this in Supabase SQL Editor:

```sql
-- Check RLS policies on roles table
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'roles';
```

### 4. Test Direct Query (as your user)
Run this in Supabase SQL Editor (this simulates what the app does):

```sql
-- This should return your user ID
SELECT auth.uid() as current_user_id;

-- This should return roles (if RLS allows)
SELECT id, key, name FROM public.roles ORDER BY key;
```

### 5. Seed Roles (if table is empty)
```sql
INSERT INTO public.roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('it', 'IT Support'),
  ('social_media', 'Social Media Manager'),
  ('operations', 'Operations')
ON CONFLICT (key) DO NOTHING;

-- Verify
SELECT * FROM public.roles;
```

## Common Issues

1. **"relation 'roles' does not exist"** → Run the RBAC migration
2. **"permission denied"** → RLS policy issue, need to fix policy
3. **Empty result** → Roles table is empty, need to seed
4. **"infinite recursion"** → RLS policy recursion, need to fix

## What to Share

Please share:
1. Browser console output (especially the `[Users]` logs)
2. Results from SQL queries above
3. Any error messages you see


