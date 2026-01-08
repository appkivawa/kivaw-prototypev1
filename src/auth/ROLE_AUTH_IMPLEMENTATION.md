# Role-Aware Auth Utilities Implementation

This document describes the frontend role-aware authentication utilities.

## Overview

The role-aware auth system provides client-side UX guards for role-based access control. **Important:** These are UX-only checks. Security is enforced by:
- RLS (Row Level Security) policies in Supabase
- Edge Functions that verify admin status before executing

## Components

### 1. `useRoles.ts` Hook

**Location:** `src/auth/useRoles.ts`

**Purpose:** Fetches and manages current user's roles from the database.

**API:**
```typescript
const {
  roles,        // Array of Role objects { id, key, name }
  roleKeys,     // Array of role keys (string[])
  isAdmin,      // boolean - true if user has "admin" role
  loading,      // boolean - true while fetching
  error,        // string | null - error message if fetch failed
  hasRole,      // (roleKey: string) => boolean
  hasAnyRole,   // (allow: string[]) => boolean
  refreshRoles, // () => void - manually refresh roles
} = useRoles();
```

**Features:**
- Fetches roles from `user_roles` join `roles` table
- In-memory caching (5-minute TTL)
- Auto-refreshes on login/logout
- Graceful error handling (returns empty array if tables don't exist)

**Usage:**
```typescript
import { useRoles } from "../auth/useRoles";

function MyComponent() {
  const { isAdmin, hasAnyRole, loading } = useRoles();
  
  if (loading) return <div>Loading...</div>;
  
  if (isAdmin) {
    // Admin-only content
  }
  
  if (hasAnyRole(["admin", "it"])) {
    // Admin or IT content
  }
}
```

### 2. `RequireRole.tsx` Component

**Location:** `src/auth/RequireRole.tsx`

**Purpose:** Wrapper component that restricts access based on user roles.

**Props:**
- `allow: string[]` - Array of role keys that are allowed (e.g., `["admin"]`, `["admin", "it"]`)
- `fallback?: ReactNode` - Custom component to show if access denied
- `redirectTo?: string` - URL to redirect to if access denied

**Behavior:**
- If not logged in → redirects to `/login`
- If user lacks required role → shows themed "No access" page
- If user has required role → renders children

**Usage:**
```typescript
import RequireRole from "../auth/RequireRole";

<RequireRole allow={["admin", "it"]}>
  <ITToolsSection />
</RequireRole>
```

**Themed "No Access" Page:**
- Matches app theme (no gradients, uses theme tokens)
- Shows required roles and user's current roles
- Provides "Go Home" button

### 3. `roleUtils.ts` Utilities

**Location:** `src/auth/roleUtils.ts`

**Purpose:** Pure utility functions for role checking.

**Functions:**

```typescript
// Check if user has any of the required roles
hasAnyRole(userRoles: string[], allow: string[]): boolean

// Check if user has a specific role
hasRole(userRoles: string[], roleKey: string): boolean

// Check if user is admin (checks "admin" role or server flag)
isAdmin(userRoles: string[], isAdminFlag?: boolean): boolean

// Get display name for role key
getRoleDisplayName(roleKey: string): string

// Format role keys for display
formatRoles(roleKeys: string[]): string
```

**Usage:**
```typescript
import { hasAnyRole, isAdmin, formatRoles } from "../auth/roleUtils";

const userRoles = ["it", "operations"];
hasAnyRole(userRoles, ["admin", "it"]); // true
isAdmin(userRoles); // false
formatRoles(userRoles); // "IT Support, Operations"
```

## Integration Examples

### Example 1: Admin-Only Page

```typescript
import RequireRole from "../auth/RequireRole";

export default function AdminPage() {
  return (
    <RequireRole allow={["admin"]}>
      <AdminDashboard />
    </RequireRole>
  );
}
```

### Example 2: Multiple Roles

```typescript
import RequireRole from "../auth/RequireRole";

export default function ITToolsPage() {
  return (
    <RequireRole allow={["admin", "it"]}>
      <ITTools />
    </RequireRole>
  );
}
```

### Example 3: Conditional Rendering

```typescript
import { useRoles } from "../auth/useRoles";

export default function MyComponent() {
  const { isAdmin, hasAnyRole } = useRoles();
  
  return (
    <div>
      {isAdmin && <AdminPanel />}
      {hasAnyRole(["admin", "it"]) && <ITPanel />}
      <PublicContent />
    </div>
  );
}
```

### Example 4: Custom Fallback

```typescript
import RequireRole from "../auth/RequireRole";

export default function ProtectedPage() {
  return (
    <RequireRole 
      allow={["admin"]}
      fallback={<CustomAccessDenied />}
    >
      <ProtectedContent />
    </RequireRole>
  );
}
```

## Security Notes

⚠️ **Important:** These utilities are for UX only. They do NOT provide security.

**Security is enforced by:**
1. **RLS Policies** - Database-level access control
2. **Edge Functions** - Server-side admin checks before executing operations
3. **Service Role Key** - Never exposed to client, only used in Edge Functions

**Client-side checks are for:**
- Hiding UI elements users can't access
- Showing friendly "No access" pages
- Improving UX by not showing inaccessible content

**Never rely on client-side checks for:**
- Data access control
- API endpoint security
- Sensitive operations

## Caching Strategy

Roles are cached in memory for 5 minutes to reduce database load:
- Cache key: `userId`
- Cache TTL: 5 minutes
- Auto-refresh on login/logout
- Manual refresh via `refreshRoles()`

## Error Handling

- If `user_roles` table doesn't exist → returns empty array (graceful degradation)
- If fetch fails → sets error state, returns empty array
- If user not logged in → returns empty array, `isAdmin = false`

## Type Safety

All utilities are fully typed with TypeScript:
- `Role` type for role objects
- `RoleKey` type alias for role keys
- Function signatures are type-safe

## Migration from Old API

If you have existing code using the old API:

**Old:**
```typescript
const { roles, hasAnyRole } = useRoles(session);
<RequireRole roles={["admin"]}>...</RequireRole>
```

**New:**
```typescript
const { roleKeys, hasAnyRole } = useRoles();
<RequireRole allow={["admin"]}>...</RequireRole>
```

## Testing

To test role-based access:

1. **Assign roles via Admin UI:**
   - Go to `/admin/users`
   - Click "Edit roles" for a user
   - Assign roles (e.g., "it", "social_media")

2. **Test access:**
   - Sign in as user with "it" role → Should access `/admin/operations`
   - Sign in as user with "social_media" role → Should access `/admin/content`
   - Sign in as user without roles → Should see "No access" page

3. **Verify caching:**
   - Check browser console for role fetch logs
   - Roles should be cached for 5 minutes
   - Cache should clear on logout


