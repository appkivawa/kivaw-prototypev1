# Ops Role Implementation

## ✅ What Was Implemented

### 1. **Database Migration** (`supabase/migrations/add_ops_role.sql`)
   - Inserts "ops" role into roles table
   - Key: `ops`, Name: `Operations`

### 2. **Permissions System** (`src/admin/permissions.ts`)
   - Added "ops" to RoleTier type
   - Defined ops permissions:
     - ✅ Can view: Overview, Content, Analytics (read-only), Operations (view-only), Support, Health
     - ❌ Cannot: Assign roles, Access settings, Manage users
   - Updated `getUserRoleTier()` to recognize "ops" role

### 3. **Role Utilities** (`src/auth/roleUtils.ts`)
   - Added `isOps()` function
   - Added "ops" to role display names

### 4. **useRoles Hook** (`src/auth/useRoles.ts`)
   - Added `isOps` computation
   - Exposes `isOps` in hook return value

### 5. **UI Restrictions** (`src/admin/tabs/Users.tsx`)
   - "Assign roles" button only visible to super_admin and admin
   - "Edit roles" button only visible to super_admin and admin
   - Ops users see "No access" instead of action buttons

### 6. **Settings Tab** (Already Protected)
   - Settings tab uses `RequirePermission` with "settings" tab
   - Ops role doesn't have "view_settings" permission, so they can't access it

## 🎯 Ops Role Permissions

### ✅ Can Do:
- View Overview
- View and manage Content
- View Analytics (read-only)
- View Operations (view-only)
- View Support tickets
- View System Health

### ❌ Cannot Do:
- Assign roles to users
- Access Settings
- Manage users
- Export analytics
- Modify operations

## 🚀 Setup Steps

### Step 1: Run the Migration

Run this SQL in Supabase SQL Editor:

```sql
-- File: supabase/migrations/add_ops_role.sql
INSERT INTO public.roles (key, name) VALUES
  ('ops', 'Operations')
ON CONFLICT (key) DO NOTHING;
```

### Step 2: Assign Ops Role

Use the Users tab to assign "ops" role to a user:
1. Go to Users tab
2. Click "Edit roles" on a user
3. Select "Operations" (ops) role
4. Save

### Step 3: Test Restrictions

As an ops user:
- ✅ Should see: Overview, Content, Analytics, Operations, Support, Health tabs
- ❌ Should NOT see: Users, Settings, Security, Finance, Experiments tabs
- ❌ Should NOT see "Assign roles" or "Edit roles" buttons
- ❌ Should see "Read-only mode" in Analytics
- ❌ Should see "Limited access" in Operations

## 📝 Notes

- Ops role is separate from "operations" role (both exist)
- Ops has more restrictions than "operations" role
- Only super_admin and admin can assign the ops role
- All restrictions are enforced at both route and UI level

