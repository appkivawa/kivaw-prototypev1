# Admin Access Fix - Diagnosis and Solution

## Problem Diagnosis

**Root Cause:** The role query in `useRoles.ts` was using incorrect join syntax that may not properly extract role keys, and there was no failsafe mechanism to prevent permanent lockout.

**Specific Issues Found:**
1. Query syntax: `select("role_id, roles(id, key, name)")` may not properly join in all cases
2. No development failsafe to prevent lockout during debugging
3. Insufficient logging to diagnose RLS or query issues
4. Error handling didn't account for RLS permission errors

## Solution Applied

### 1. Fixed Role Query
**Changed from:**
```typescript
.select("role_id, roles(id, key, name)")
```

**Changed to:**
```typescript
.select("roles!inner(id, key, name)")
```

The `!inner` syntax ensures a proper inner join and is the recommended Supabase pattern.

### 2. Added Development Failsafe
Added a temporary development-only failsafe that grants admin access if:
- User is authenticated
- User email matches `VITE_DEV_ADMIN_EMAILS` environment variable
- Roles query fails or returns empty

**To use the failsafe:**
1. Add to `.env.local`:
   ```
   VITE_DEV_ADMIN_EMAILS=your-email@example.com,another@example.com
   ```
2. The failsafe only works in development mode (`import.meta.env.DEV`)
3. **IMPORTANT:** Remove this failsafe after confirming admin access works

### 3. Enhanced Logging
Added comprehensive dev-only logging:
- User ID being checked
- Query results
- Extracted roles
- Role keys
- isAdmin result
- hasAnyRole checks

### 4. Better Error Handling
- Detects RLS permission errors (code 42501)
- Logs specific error types
- Falls back to failsafe on errors if email matches

## RLS Policy Requirements

For the role query to work, ensure these RLS policies exist:

### user_roles table:
```sql
-- Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);
```

### roles table:
```sql
-- Authenticated users can read all roles
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

## Verification Steps

1. **Check browser console** (dev mode) for role query logs
2. **Verify RLS policies** exist in Supabase dashboard
3. **Test with failsafe** by setting `VITE_DEV_ADMIN_EMAILS`
4. **Remove failsafe** once confirmed working

## Files Modified

- `src/auth/useRoles.ts` - Fixed query, added failsafe, enhanced logging

## Next Steps

1. Test admin access with the fixed query
2. Check browser console for any RLS errors
3. If still locked out, use the failsafe temporarily
4. Verify RLS policies allow reading own roles
5. Remove failsafe after confirming access works


