# Next Steps - Admin Access & Users Tab

## ✅ What We've Fixed

1. **RLS Recursion** - Fixed infinite recursion in `user_roles` and `roles` tables
2. **Users Tab** - Rewritten to use direct database queries (no Edge Functions)
3. **Admin Access** - You're in admin via `admin_allowlist`

## 🧪 Test Now

### Step 1: Test Users Tab
1. Go to `/admin` in your app
2. Click on the **Users** tab
3. **Expected:** Should load list of users with their roles
4. **If error:** Check browser console and share the error

### Step 2: Test Role Assignment
1. Click **"➕ Assign roles"** button
2. Enter an existing user's email
3. Select some roles
4. Click **"Assign Roles"**
5. **Expected:** Roles should be assigned successfully

### Step 3: Test Edit Roles
1. Click **"Edit roles"** on any user
2. Add/remove roles
3. Click **"Save Changes"**
4. **Expected:** Roles should update successfully

## 🔧 If You Get Errors

### Error: "Cannot read profiles" or "Permission denied"
**Fix:** The `profiles` table RLS policy might still reference `admin_users`. Run this SQL:

```sql
-- Update profiles RLS policy to use admin_allowlist
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = auth.uid()
    )
  );
```

### Error: "Cannot read user_roles" or recursion error
**Fix:** Make sure you ran the `fix_rls_recursion.sql` migration. Check if it worked:

```sql
-- Verify policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('user_roles', 'roles', 'profiles')
ORDER BY tablename, policyname;
```

## 🧹 Clean Up (After Everything Works)

Once you confirm everything works:

1. **Remove temporary bypasses:**
   - Remove hardcoded email from `src/auth/useRoles.ts`
   - Remove emergency bypass from `src/admin/RequireAdmin.tsx`

2. **Verify RLS policies:**
   - All policies should use `admin_allowlist` (not `admin_users`)
   - No recursion errors in debug page

3. **Test in production:**
   - Make sure bypasses don't work in production
   - Verify admin access works via database only

## 📋 Current Status

- ✅ You're in admin (via `admin_allowlist`)
- ✅ RLS recursion fixed (migration run)
- ✅ Users tab uses direct queries (no Edge Functions)
- ⚠️ Need to test if it works
- ⚠️ May need to update `profiles` RLS policy

## 🎯 Immediate Action

**Go test the Users tab now!** Let me know:
- Does it load users?
- Any errors in console?
- Can you assign/edit roles?


