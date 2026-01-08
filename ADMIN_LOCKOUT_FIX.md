# Admin Lockout Emergency Fix

## Immediate Steps to Regain Access

### Step 1: Check Browser Console
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Navigate to `/admin` or `/admin-debug`
4. Look for `[useRoles]` logs
5. Copy all logs and check what's happening

### Step 2: Use Debug Page
1. Navigate to `/admin-debug` (works in dev mode)
2. This page shows:
   - Your user ID and email
   - useRoles hook results
   - Direct query test results
   - RPC is_admin() test results
   - admin_allowlist check
   - Environment variables

### Step 3: Verify Environment Variable
Make sure `.env.local` exists and contains:
```
VITE_DEV_ADMIN_EMAILS=kivawapp@proton.me
```

Then **restart your dev server** for the env var to load.

### Step 4: Check Database Directly
Run this in Supabase SQL Editor to verify your admin status:

```sql
-- Check if you have admin role
SELECT 
  u.email,
  ur.user_id,
  r.key as role_key,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'kivawapp@proton.me';

-- Check admin_allowlist
SELECT * FROM admin_allowlist 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me');

-- Test is_admin() function
SELECT is_admin((SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me'));
```

### Step 5: Temporary Bypass (EMERGENCY ONLY)
If nothing works, temporarily modify `RequireAdmin.tsx`:

```tsx
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  // TEMPORARY BYPASS - REMOVE AFTER FIXING
  const { session } = useSession();
  if (session?.user?.email === 'kivawapp@proton.me') {
    return <>{children}</>;
  }
  
  return (
    <RequireRole allow={["admin"]}>
      {children}
    </RequireRole>
  );
}
```

**⚠️ REMOVE THIS BYPASS IMMEDIATELY AFTER REGAINING ACCESS**

## What Was Fixed

1. **useRoles.ts:**
   - Added immediate DEV failsafe check (before any queries)
   - Better error handling (doesn't throw on RLS errors)
   - Multiple fallback layers (RPC → DEV email)
   - Enhanced logging

2. **RequireRole.tsx:**
   - Doesn't show "No Access" while loading
   - Allows access if RPC confirms admin even if query failed
   - Allows access if isAdmin is true (catches failsafe cases)
   - Shows debug info in dev mode

3. **AdminDebug.tsx:**
   - Diagnostic page at `/admin-debug`
   - Shows all relevant info to debug the issue

## Common Issues and Solutions

### Issue: "No Access" page shows immediately
**Solution:** Check browser console for `[useRoles]` logs. The loading state should show first.

### Issue: Query returns empty array
**Possible causes:**
- RLS blocking the query
- Foreign key relationship issue
- User doesn't actually have roles in database

**Solution:** Check RLS policies and verify database directly.

### Issue: RPC is_admin() returns false
**Possible causes:**
- User not in admin_allowlist
- User doesn't have admin role in user_roles
- RPC function has a bug

**Solution:** Add user to admin_allowlist via SQL:
```sql
INSERT INTO admin_allowlist (user_id)
SELECT id FROM auth.users WHERE email = 'kivawapp@proton.me';
```

### Issue: DEV failsafe not working
**Possible causes:**
- `.env.local` not created
- Dev server not restarted after adding env var
- Email doesn't match exactly

**Solution:** 
1. Create `.env.local` with exact email
2. Restart dev server
3. Check console for failsafe activation message

## Next Steps After Regaining Access

1. Check `/admin-debug` page to see what's working
2. Fix the root cause (RLS policies, query syntax, etc.)
3. Remove temporary bypasses
4. Remove DEV failsafe after confirming everything works


