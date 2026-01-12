# Migration Fixes Summary

## Issues Fixed

### ✅ 1. is_super_admin() GRANT Error

**Problem:**
```
ERROR: function public.is_super_admin() does not exist (SQLSTATE 42883)
At statement: GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated
```

**Root Cause:**
The function `is_super_admin(check_uid UUID DEFAULT auth.uid())` has a DEFAULT parameter, but PostgreSQL doesn't allow GRANTing on the zero-argument version separately. You can only GRANT on the actual function signature `is_super_admin(UUID)`.

**Fix:**
- Removed the invalid GRANT statement: `GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;`
- Kept only: `GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;`
- The function can still be called without arguments due to the DEFAULT parameter

**File Changed:**
- `supabase/migrations/20260112000305_add_super_admin.sql`

### ✅ 2. Duplicate Policy Error

**Problem:**
```
ERROR: policy "Content items are viewable by everyone" for table "content_items" already exists (SQLSTATE 42710)
```

**Root Cause:**
Migrations were creating policies without first checking if they exist, causing errors on re-runs.

**Fix:**
- Added `DROP POLICY IF EXISTS` before all `CREATE POLICY` statements in the recommendation engine migration
- Made all policies idempotent

**File Changed:**
- `supabase/migrations/20260112000321_create_recommendation_engine.sql`

**Policies Made Idempotent:**
- "Anyone can read content_items"
- "Users can view their own preferences"
- "Users can insert their own preferences"
- "Users can update their own preferences"
- "Users can view their own interactions"
- "Users can insert their own interactions"
- "Anyone can read internal_actions"

### ✅ 3. Migration Naming

**Status:** ✅ Already correct

All migrations follow the pattern: `YYYYMMDDHHMMSS_description.sql`

## Files Modified

1. `supabase/migrations/20260112000305_add_super_admin.sql`
   - Removed invalid zero-argument GRANT statement
   - Added comment explaining why

2. `supabase/migrations/20260112000321_create_recommendation_engine.sql`
   - Added `DROP POLICY IF EXISTS` before all `CREATE POLICY` statements
   - Made all policies idempotent

## Testing

After applying these fixes, migrations should:
1. ✅ Run successfully on a fresh database
2. ✅ Run successfully on a database that already has the objects (idempotent)
3. ✅ Not fail with "function does not exist" errors
4. ✅ Not fail with "policy already exists" errors

## Next Steps

1. Run `supabase db push` to apply migrations
2. Verify no errors occur
3. If you see other policy errors, apply the same pattern: add `DROP POLICY IF EXISTS` before `CREATE POLICY`

