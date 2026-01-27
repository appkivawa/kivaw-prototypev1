# Access Control Runbook

**Goal**: Never get locked out of admin access again.

---

## 🚨 Emergency Recovery (If Locked Out)

### Step 1: Use Supabase SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. SQL Editor uses **service role** (bypasses RLS)
3. Run this query (replace with your email):

```sql
-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Add yourself to admin_allowlist (break-glass access)
INSERT INTO public.admin_allowlist (user_id, super_admin)
SELECT id, true FROM auth.users WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE SET super_admin = true;

-- Verify
SELECT 
  u.email,
  public.is_admin(u.id) as is_admin
FROM auth.users u
WHERE u.email = 'your-email@example.com';
```

### Step 2: Verify Access
1. Refresh your app
2. Visit `/admin`
3. Should now have access

---

## 🔍 How Access Control Works

### Three-Tier System

1. **admin_allowlist** (Break-Glass)
   - Highest priority
   - Managed via service role (SQL Editor)
   - No RLS (prevents recursion)
   - Use for emergency access

2. **user_roles + roles** (Role-Based)
   - Assign "admin" role via `user_roles` table
   - Managed by admins via UI
   - Has RLS (admins can manage)

3. **Legacy admin_users** (Backward Compatibility)
   - Fallback if exists
   - Not recommended for new setups

### Single Source of Truth

**Database Function**: `public.is_admin(uid)`
- Checks all three sources
- Returns `true` if user is admin from any source
- Used by RLS policies (non-recursive)

**Frontend Function**: `get_user_permissions()`
- RPC function that returns JSON
- Includes: `is_admin`, `is_super_admin`, `role_keys`
- Used by `useRoles()` hook

---

## ✅ Verification Checklist

### After Running Migrations

1. **Check RLS Status**:
   ```sql
   -- Run CHECK_ROLES_FINAL.sql
   -- Should show:
   -- ✅ admin_allowlist RLS DISABLED
   -- ✅ All other tables RLS ENABLED
   -- ✅ All policies show "✅ SAFE" (no recursion)
   ```

2. **Check Admin Access**:
   ```sql
   -- Should return true for your user
   SELECT public.is_admin();
   ```

3. **Check Frontend**:
   - Visit `/admin` → Should load
   - All admin tabs → Should be accessible
   - No "No Access" errors

---

## 🧪 Test Matrix

### Test 1: Anonymous User
- **Visit**: `/studio`, `/timeline/explore`
- **Expected**: ✅ Can view public content
- **Visit**: `/admin`
- **Expected**: ❌ Redirected to login

### Test 2: Normal User (Logged In)
- **Visit**: `/timeline`, `/collection`
- **Expected**: ✅ Can use app normally
- **Visit**: `/admin`
- **Expected**: ❌ Shows "No Access" page

### Test 3: Creator User
- **Has Role**: `creator` or `partner`
- **Visit**: `/creator`
- **Expected**: ✅ Can access creator portal
- **Visit**: `/admin`
- **Expected**: ❌ Shows "No Access" page

### Test 4: Admin User
- **In**: `admin_allowlist` OR has `admin` role
- **Visit**: `/admin`
- **Expected**: ✅ Can access admin dashboard
- **Visit**: `/admin/users`
- **Expected**: ✅ Can view users tab
- **Visit**: `/admin/content`
- **Expected**: ✅ Can view content tab

### Test 5: Super Admin
- **In**: `admin_allowlist` with `super_admin = true`
- **Visit**: `/admin/security`
- **Expected**: ✅ Can view security tab
- **Visit**: `/admin/users`
- **Expected**: ✅ Can see super admins in list

---

## 🔧 Maintenance

### Adding a New Admin

**Option 1: Via SQL Editor (Service Role)**
```sql
INSERT INTO public.admin_allowlist (user_id, super_admin)
SELECT id, false FROM auth.users WHERE email = 'new-admin@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

**Option 2: Via Admin UI (If Already Admin)**
1. Go to `/admin/users`
2. Find user
3. Click "Assign roles"
4. Select "admin" role
5. Save

### Removing Admin Access

**Via SQL Editor**:
```sql
DELETE FROM public.admin_allowlist 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

**Via Admin UI**:
1. Go to `/admin/users`
2. Find user
3. Click "Edit roles"
4. Remove "admin" role
5. Save

---

## 🐛 Troubleshooting

### Issue: "No Access" on `/admin`

**Check 1**: Are you in admin_allowlist?
```sql
SELECT * FROM public.admin_allowlist 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

**Check 2**: Do you have admin role?
```sql
SELECT r.key, r.name
FROM public.user_roles ur
JOIN public.roles r ON ur.role_id = r.id
WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
  AND r.key = 'admin';
```

**Check 3**: Does is_admin() return true?
```sql
SELECT public.is_admin(
  (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
);
```

**Fix**: If all return empty/false, add yourself to admin_allowlist (see Emergency Recovery above)

### Issue: Infinite Recursion Error

**Symptom**: `"infinite recursion detected in policy"`

**Cause**: RLS policy calls `is_admin()` which checks a table that has RLS calling `is_admin()`

**Fix**: 
1. Run migration `20250127000000_fix_auth_rls_final.sql`
2. This disables RLS on `admin_allowlist` (no recursion)
3. All other policies check `admin_allowlist` directly (no function calls)

### Issue: Edge Functions Can't Write

**Symptom**: Edge Functions return 500 errors when writing to database

**Cause**: Edge Functions using anon key (respects RLS) instead of service role key

**Fix**: 
- Edge Functions should use `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
- Service role bypasses RLS
- Check Edge Function code uses service role client

---

## 📋 Quick Reference

### SQL Queries

**Check if user is admin**:
```sql
SELECT public.is_admin('USER_ID_HERE');
```

**Get user permissions**:
```sql
SELECT public.get_user_permissions('USER_ID_HERE');
```

**List all admins**:
```sql
SELECT u.email, aa.super_admin, public.is_admin(u.id)
FROM auth.users u
LEFT JOIN public.admin_allowlist aa ON u.id = aa.user_id
WHERE public.is_admin(u.id) = true;
```

**Add admin**:
```sql
INSERT INTO public.admin_allowlist (user_id, super_admin)
SELECT id, false FROM auth.users WHERE email = 'email@example.com';
```

### Frontend Checks

**In React components**:
```typescript
import { useRoles } from "../auth/useRoles";

const { isAdmin, isSuperAdmin, roleKeys } = useRoles();
```

**In route guards**:
```typescript
<RequireAdmin>
  <AdminDashboard />
</RequireAdmin>
```

---

## 🎯 Key Principles

1. **admin_allowlist has NO RLS** - Prevents recursion
2. **All policies check admin_allowlist directly** - No `is_admin()` calls in policies
3. **Edge Functions use service role** - Bypass RLS for writes
4. **Frontend uses RPC function** - Single source of truth
5. **Break-glass recovery always works** - SQL Editor bypasses RLS

---

**Last Updated**: 2025-01-27
**Status**: Production Ready
