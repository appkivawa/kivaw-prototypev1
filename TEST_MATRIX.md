# Access Control Test Matrix

## Test Scenarios

### Test 1: Anonymous User (Not Logged In)

**Setup**: No authentication

**Tests**:
1. **Visit `/studio`**
   - Expected: ✅ Loads (public page)
   - Console: No errors

2. **Visit `/timeline/explore`**
   - Expected: ✅ Loads Explore feed
   - Console: No errors
   - Data: Should show content from `explore_feed_v2`

3. **Visit `/admin`**
   - Expected: ❌ Redirected to `/login`
   - Console: No errors

4. **Visit `/collection`**
   - Expected: ❌ Redirected to `/login` (RequireAuth)

5. **Try to save an item**
   - Expected: ❌ Should prompt to login or fail gracefully

**Verification SQL**:
```sql
-- Should return false (no auth.uid())
SELECT public.is_admin();
-- Expected: false
```

---

### Test 2: Normal User (Logged In, No Admin)

**Setup**:
1. Create test user: `test-user@example.com`
2. Login as this user
3. **Do NOT** add to `admin_allowlist`
4. **Do NOT** assign admin role

**Tests**:
1. **Visit `/timeline`**
   - Expected: ✅ Loads feed/explore
   - Console: No errors

2. **Visit `/collection`**
   - Expected: ✅ Loads saved items
   - Console: No errors

3. **Save an item from Explore**
   - Expected: ✅ Item saved to collection
   - Console: No errors

4. **Create an echo**
   - Expected: ✅ Echo created
   - Console: No errors

5. **Visit `/admin`**
   - Expected: ❌ Shows "No Access" page
   - Console: No errors
   - Message: "You don't have permission to access this page"

6. **Visit `/creator`**
   - Expected: ❌ Shows "No Access" page
   - Message: "This area is for creators and partners only"

**Verification SQL**:
```sql
-- Replace with test user ID
SELECT 
  u.email,
  public.is_admin(u.id) as is_admin,
  public.is_super_admin(u.id) as is_super_admin,
  public.get_user_permissions(u.id) as permissions
FROM auth.users u
WHERE u.email = 'test-user@example.com';

-- Expected:
-- is_admin: false
-- is_super_admin: false
-- permissions: { "is_admin": false, "is_super_admin": false, "role_keys": [] }
```

---

### Test 3: Creator User

**Setup**:
1. Create test user: `creator@example.com`
2. Login as this user
3. Assign "creator" role:
   ```sql
   INSERT INTO public.user_roles (user_id, role_id)
   SELECT 
     (SELECT id FROM auth.users WHERE email = 'creator@example.com'),
     (SELECT id FROM public.roles WHERE key = 'creator')
   ON CONFLICT DO NOTHING;
   ```

**Tests**:
1. **Visit `/creator`**
   - Expected: ✅ Loads creator portal
   - Console: No errors

2. **Visit `/creators/dashboard`**
   - Expected: ✅ Loads creator dashboard
   - Console: No errors

3. **Visit `/admin`**
   - Expected: ❌ Shows "No Access" page
   - Console: No errors

4. **Visit `/timeline`**
   - Expected: ✅ Loads normally
   - Console: No errors

**Verification SQL**:
```sql
SELECT 
  u.email,
  public.is_admin(u.id) as is_admin,
  array_agg(r.key) as role_keys
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE u.email = 'creator@example.com'
GROUP BY u.id, u.email;

-- Expected:
-- is_admin: false
-- role_keys: ['creator']
```

---

### Test 4: Admin User (Via admin_allowlist)

**Setup**:
1. Use existing admin user OR create: `admin@example.com`
2. Login as this user
3. Add to `admin_allowlist`:
   ```sql
   INSERT INTO public.admin_allowlist (user_id, super_admin)
   SELECT id, false FROM auth.users WHERE email = 'admin@example.com'
   ON CONFLICT (user_id) DO NOTHING;
   ```

**Tests**:
1. **Visit `/admin`**
   - Expected: ✅ Loads admin dashboard
   - Console: No errors

2. **Visit `/admin/users`**
   - Expected: ✅ Loads users tab
   - Console: No errors
   - Data: Should show list of users

3. **Visit `/admin/content`**
   - Expected: ✅ Loads content tab
   - Console: No errors

4. **Visit `/admin/analytics`**
   - Expected: ✅ Loads analytics tab
   - Console: No errors

5. **Visit `/admin/operations`**
   - Expected: ✅ Loads operations tab
   - Console: No errors

6. **Visit `/admin/settings`**
   - Expected: ✅ Loads settings tab
   - Console: No errors

7. **Visit `/admin/security`**
   - Expected: ✅ Loads security tab (if super_admin) OR ❌ "No Access" (if not super_admin)
   - Console: No errors

8. **Visit `/timeline`**
   - Expected: ✅ Loads normally (admin can use app)
   - Console: No errors

9. **Try to assign roles to another user**
   - Expected: ✅ Can assign roles (admin permission)
   - Console: No errors

**Verification SQL**:
```sql
SELECT 
  u.email,
  aa.user_id IS NOT NULL as in_allowlist,
  aa.super_admin,
  public.is_admin(u.id) as is_admin,
  public.is_super_admin(u.id) as is_super_admin,
  public.get_user_permissions(u.id) as permissions
FROM auth.users u
LEFT JOIN public.admin_allowlist aa ON u.id = aa.user_id
WHERE u.email = 'admin@example.com';

-- Expected:
-- in_allowlist: true
-- super_admin: false (or true)
-- is_admin: true
-- is_super_admin: false (or true)
-- permissions: { "is_admin": true, "is_super_admin": false, "role_keys": [] }
```

---

### Test 5: Admin User (Via admin Role)

**Setup**:
1. Create test user: `admin-role@example.com`
2. Login as this user
3. Assign "admin" role (NOT in admin_allowlist):
   ```sql
   INSERT INTO public.user_roles (user_id, role_id)
   SELECT 
     (SELECT id FROM auth.users WHERE email = 'admin-role@example.com'),
     (SELECT id FROM public.roles WHERE key = 'admin')
   ON CONFLICT DO NOTHING;
   ```

**Tests**:
1. **Visit `/admin`**
   - Expected: ✅ Loads admin dashboard
   - Console: No errors

2. **Visit `/admin/users`**
   - Expected: ✅ Loads users tab
   - Console: No errors

3. **Visit `/admin/security`**
   - Expected: ❌ Shows "No Access" (not super_admin)
   - Console: No errors

**Verification SQL**:
```sql
SELECT 
  u.email,
  aa.user_id IS NOT NULL as in_allowlist,
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = u.id AND r.key = 'admin'
  ) as has_admin_role,
  public.is_admin(u.id) as is_admin
FROM auth.users u
LEFT JOIN public.admin_allowlist aa ON u.id = aa.user_id
WHERE u.email = 'admin-role@example.com';

-- Expected:
-- in_allowlist: false
-- has_admin_role: true
-- is_admin: true
```

---

### Test 6: Super Admin User

**Setup**:
1. Use existing super admin OR create: `super-admin@example.com`
2. Login as this user
3. Add to `admin_allowlist` with `super_admin = true`:
   ```sql
   INSERT INTO public.admin_allowlist (user_id, super_admin)
   SELECT id, true FROM auth.users WHERE email = 'super-admin@example.com'
   ON CONFLICT (user_id) DO UPDATE SET super_admin = true;
   ```

**Tests**:
1. **Visit `/admin/security`**
   - Expected: ✅ Loads security tab
   - Console: No errors

2. **Visit `/admin/users`**
   - Expected: ✅ Can see super admins in list
   - Console: No errors

3. **Try to remove another super admin**
   - Expected: ✅ Can remove (super admin permission)
   - Console: No errors

4. **Try to remove yourself**
   - Expected: ❌ Should be prevented (safeguard)
   - Console: No errors

**Verification SQL**:
```sql
SELECT 
  u.email,
  aa.super_admin,
  public.is_admin(u.id) as is_admin,
  public.is_super_admin(u.id) as is_super_admin
FROM auth.users u
JOIN public.admin_allowlist aa ON u.id = aa.user_id
WHERE u.email = 'super-admin@example.com';

-- Expected:
-- super_admin: true
-- is_admin: true
-- is_super_admin: true
```

---

## Edge Function Tests

### Test 7: Edge Function Writes (Service Role)

**Setup**: Edge Functions should use `SUPABASE_SERVICE_ROLE_KEY`

**Tests**:
1. **Call `ingest_rss` Edge Function**
   - Expected: ✅ Writes to `feed_items` table
   - Console: No RLS errors
   - Database: New rows in `feed_items`

2. **Call `explore_feed_v2` Edge Function**
   - Expected: ✅ Reads from `explore_items_v2` view
   - Console: No RLS errors
   - Response: Returns items array

3. **Call `cron_runner` Edge Function**
   - Expected: ✅ Can write to `system_health` table
   - Console: No RLS errors

**Verification**:
- Check Edge Function logs in Supabase Dashboard
- Should not see "permission denied" or "RLS policy violation" errors
- Edge Functions use service role (bypasses RLS)

---

## Recursion Tests

### Test 8: No Infinite Recursion

**Setup**: Run all queries that previously caused recursion

**Tests**:
1. **Query `user_roles` table**
   ```sql
   SELECT ur.*, r.key, r.name
   FROM public.user_roles ur
   JOIN public.roles r ON ur.role_id = r.id
   WHERE ur.user_id = auth.uid();
   ```
   - Expected: ✅ Returns results (no recursion error)
   - Error: Should NOT see "infinite recursion detected"

2. **Query `admin_allowlist` table**
   ```sql
   SELECT * FROM public.admin_allowlist;
   ```
   - Expected: ✅ Returns results (RLS disabled, no recursion)
   - Error: Should NOT see "infinite recursion detected"

3. **Call `is_admin()` function**
   ```sql
   SELECT public.is_admin();
   ```
   - Expected: ✅ Returns boolean (no recursion error)
   - Error: Should NOT see "infinite recursion detected"

**Verification SQL**:
```sql
-- Check for recursion risks
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%is_admin(%' THEN '⚠️ RECURSION RISK'
    WHEN qual::text LIKE '%admin_allowlist%' AND tablename = 'admin_allowlist' THEN '⚠️ SELF-REFERENCE'
    ELSE '✅ SAFE'
  END as recursion_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('admin_allowlist', 'user_roles', 'roles', 'profiles')
ORDER BY tablename, policyname;

-- Expected: All should show "✅ SAFE"
```

---

## Expected Results Summary

| Test | User Type | Route | Expected Result |
|------|-----------|-------|----------------|
| 1a | Anon | `/studio` | ✅ Loads |
| 1b | Anon | `/admin` | ❌ Redirect to login |
| 2a | Normal | `/timeline` | ✅ Loads |
| 2b | Normal | `/admin` | ❌ "No Access" |
| 3a | Creator | `/creator` | ✅ Loads |
| 3b | Creator | `/admin` | ❌ "No Access" |
| 4a | Admin (allowlist) | `/admin` | ✅ Loads |
| 4b | Admin (allowlist) | `/admin/users` | ✅ Loads |
| 5a | Admin (role) | `/admin` | ✅ Loads |
| 6a | Super Admin | `/admin/security` | ✅ Loads |
| 7a | Edge Function | `ingest_rss` | ✅ Writes succeed |
| 8a | Any | Query `user_roles` | ✅ No recursion |

---

## Quick Test Commands

### Run All Verification Queries
```sql
-- Run CHECK_ROLES_FINAL.sql in Supabase SQL Editor
-- Should show all ✅ checks passing
```

### Test Current User
```sql
-- Replace with your email
SELECT 
  u.email,
  public.is_admin(u.id) as is_admin,
  public.is_super_admin(u.id) as is_super_admin,
  public.get_user_permissions(u.id) as permissions
FROM auth.users u
WHERE u.email = 'your-email@example.com';
```

### Test RLS Policies
```sql
-- Should return no recursion risks
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%is_admin(%' THEN '⚠️ RECURSION RISK'
    ELSE '✅ SAFE'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('admin_allowlist', 'user_roles', 'roles', 'profiles');
```

---

**Last Updated**: 2025-01-27
