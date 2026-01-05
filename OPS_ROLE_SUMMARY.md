# Ops Role Implementation Summary

## ✅ Completed

### 1. **Database**
- ✅ SQL migration created: `supabase/migrations/add_ops_role.sql`
- ✅ Inserts role: key=`ops`, name=`Operations`

### 2. **Permissions System**
- ✅ Added "ops" to RoleTier type
- ✅ Defined ops permissions (cannot assign roles, access settings, manage users)
- ✅ Updated `getUserRoleTier()` to recognize "ops"

### 3. **Role Utilities**
- ✅ Added `isOps()` function to `roleUtils.ts`
- ✅ Added "ops" to role display names

### 4. **useRoles Hook**
- ✅ Added `isOps` computation
- ✅ Exposes `isOps` in return value

### 5. **UI Restrictions**
- ✅ "Assign roles" button only visible to super_admin/admin
- ✅ "Edit roles" button only visible to super_admin/admin
- ✅ Settings tab already protected (ops doesn't have view_settings permission)
- ✅ Users tab already protected (RequireRole allow={["admin"]})

## 🎯 Ops Role Capabilities

### ✅ Can Access:
- Overview tab
- Content tab (view + manage)
- Analytics tab (read-only)
- Operations tab (view-only)
- Support tab (view)
- Health tab (view)

### ❌ Cannot Access:
- Users tab (blocked by RequireRole)
- Settings tab (no view_settings permission)
- Security tab (no view_security permission)
- Finance tab (no view_finance permission)
- Experiments tab (no view_experiments permission)

### ❌ Cannot Do:
- Assign roles to users
- Edit user roles
- Access settings
- Manage users

## 🚀 Next Steps

1. **Run Migration:**
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO public.roles (key, name) VALUES
     ('ops', 'Operations')
   ON CONFLICT (key) DO NOTHING;
   ```

2. **Assign Ops Role:**
   - Go to Users tab (as super_admin or admin)
   - Click "Edit roles" on a user
   - Select "Operations" (ops) role
   - Save

3. **Test:**
   - Log in as ops user
   - Verify they can only see allowed tabs
   - Verify they cannot see "Assign roles" or "Edit roles" buttons
   - Verify they cannot access Settings

## 📝 Notes

- Ops role is separate from "operations" role
- Only super_admin and admin can assign the ops role
- All restrictions enforced at route and UI level
- Settings tab automatically blocked (no permission)

