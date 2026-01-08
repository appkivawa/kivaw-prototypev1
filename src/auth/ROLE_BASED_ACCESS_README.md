# Role-Based Access Control (RBAC) Implementation

This document describes the role-based access control system implemented in the Kivaw app.

## Overview

The RBAC system allows fine-grained control over who can access different parts of the admin dashboard and perform specific actions. Roles are stored in the database and checked both on the frontend (for UI access) and should be enforced via RLS policies on the backend (for data access).

## Components

### 1. `useRoles.ts` Hook

**Location:** `src/auth/useRoles.ts`

**Purpose:** Fetches and caches the current user's roles from the `user_roles` table.

**Features:**
- In-memory caching (5-minute TTL) to reduce database queries
- Automatic refresh on login/logout
- Helper functions: `hasRole()`, `hasAnyRole()`, `refreshRoles()`

**Usage:**
```tsx
import { useSession } from "./useSession";
import { useRoles } from "./useRoles";

function MyComponent() {
  const { session } = useSession();
  const { roles, hasRole, hasAnyRole, loading } = useRoles(session);
  
  if (hasRole("admin")) {
    // Admin-only content
  }
  
  if (hasAnyRole(["admin", "it"])) {
    // Admin or IT content
  }
}
```

### 2. `RequireRole.tsx` Component

**Location:** `src/auth/RequireRole.tsx`

**Purpose:** Wrapper component that restricts access to children based on required roles.

**Props:**
- `roles: string[]` - Array of role keys (user must have at least one)
- `fallback?: ReactNode` - Custom component to show if access denied
- `redirectTo?: string` - URL to redirect to if access denied

**Usage:**
```tsx
<RequireRole roles={["admin", "it"]}>
  <ITToolsSection />
</RequireRole>
```

### 3. `RequireAdmin.tsx` Component

**Location:** `src/admin/RequireAdmin.tsx`

**Purpose:** Simplified wrapper that requires "admin" role. Now uses `RequireRole` internally.

**Usage:**
```tsx
<RequireAdmin>
  <AdminLayout />
</RequireAdmin>
```

## Access Restrictions

### Admin Dashboard (`/admin/*`)
- **Required Role:** `admin`
- **Implementation:** Wrapped in `<RequireAdmin>` in `App.tsx`
- **Protected Routes:**
  - `/admin` (Overview)
  - `/admin/users`
  - `/admin/content`
  - `/admin/analytics`
  - `/admin/operations`
  - `/admin/settings`
  - `/admin/support`
  - `/admin/health`
  - `/admin/security`
  - `/admin/finance`
  - `/admin/experiments`

### IT Tools Section (`/admin/operations`)
- **Required Roles:** `admin` OR `it`
- **Implementation:** `<RequireRole roles={["admin", "it"]}>` in `Operations.tsx`
- **Access:** IT support staff can access operations tools for troubleshooting

### Social Media Section (`/admin/content`)
- **Required Roles:** `admin` OR `social_media`
- **Implementation:** `<RequireRole roles={["admin", "social_media"]}>` in `Content.tsx`
- **Access:** Social media managers can manage content items

## Available Roles

Roles are seeded in the database via `create_rbac_system.sql`:

1. **`admin`** - Full administrative access
2. **`it`** - IT support and operations tools
3. **`social_media`** - Content management and social media
4. **`operations`** - Operations and support tools

## Role Management

Roles are managed via the Admin Users tab (`/admin/users`):
- Admins can invite users and assign roles
- Admins can edit user roles
- Uses Edge Functions: `admin-invite-user`, `admin-list-users`, `admin-set-user-roles`

## Database Schema

### Tables

1. **`roles`** - Role definitions
   - `id` (UUID, primary key)
   - `key` (TEXT, unique) - e.g., "admin", "it"
   - `name` (TEXT) - Display name, e.g., "Administrator"
   - `created_at` (TIMESTAMPTZ)

2. **`user_roles`** - User-role assignments
   - `user_id` (UUID, references auth.users)
   - `role_id` (UUID, references roles)
   - `created_at` (TIMESTAMPTZ)
   - Primary key: (user_id, role_id)

3. **`admin_allowlist`** - Legacy admin access (backward compatibility)
   - `user_id` (UUID, references auth.users)
   - `created_at` (TIMESTAMPTZ)

### Helper Function

**`is_admin(uid)`** - SQL function that checks if a user is an admin via:
1. `admin_allowlist` table
2. `admin_users` table (legacy)
3. `user_roles` with "admin" role

## RLS Policies

See `RLS_POLICY_NOTES.md` for recommended Row Level Security policies for role-based write access to various tables.

**Key Tables Requiring Role-Based Write Access:**
- `content_items` - Admin + social_media
- `experiments` - Admin only
- `admin_audit_log` - Admin + IT
- `app_settings` - Admin + IT
- `support_tickets` - Admin + IT + operations
- `user_roles` - Admin only
- `roles` - Admin only

## Caching Strategy

Roles are cached in memory for 5 minutes to reduce database load:
- Cache key: `userId`
- Cache TTL: 5 minutes
- Auto-refresh on login/logout
- Manual refresh via `refreshRoles()`

## Security Considerations

1. **Frontend Protection:** UI components use `RequireRole` to hide/show content
2. **Backend Protection:** RLS policies should enforce access at the database level
3. **Edge Functions:** Admin functions check roles before executing
4. **Caching:** Cache is per-user and cleared on logout

## Migration Path

If migrating from the old `is_admin` boolean system:

1. Run `create_rbac_system.sql` migration
2. Assign "admin" role to existing admins via:
   ```sql
   INSERT INTO public.user_roles (user_id, role_id)
   SELECT id, (SELECT id FROM roles WHERE key = 'admin')
   FROM auth.users
   WHERE id IN (SELECT user_id FROM admin_allowlist);
   ```
3. Update frontend components to use `RequireRole` instead of `RequireAdmin` where needed
4. Gradually migrate RLS policies to use role-based checks

## Testing

To test role-based access:

1. **Assign roles via Admin UI:**
   - Go to `/admin/users`
   - Click "Edit roles" for a user
   - Assign roles (e.g., "it", "social_media")

2. **Test access:**
   - Sign in as user with "it" role → Should access `/admin/operations`
   - Sign in as user with "social_media" role → Should access `/admin/content`
   - Sign in as user without roles → Should see "Access Denied"

3. **Verify caching:**
   - Check browser console for role fetch logs
   - Roles should be cached for 5 minutes
   - Cache should clear on logout

## Troubleshooting

**Issue: User can't access admin dashboard**
- Check if user has "admin" role assigned
- Verify `user_roles` table has correct entries
- Check browser console for role fetch errors

**Issue: Roles not refreshing after assignment**
- Call `refreshRoles()` manually
- Wait for cache to expire (5 minutes)
- Sign out and sign back in

**Issue: RLS policies blocking access**
- Verify RLS policies use role-based checks
- Check `is_admin()` function works correctly
- Ensure service role is used for admin operations


