# RLS Policy Notes for Role-Based Access Control

This document outlines Row Level Security (RLS) policies that should be implemented for role-based write access to various tables.

## Tables Requiring Role-Based Write Access

### 1. `content_items` (Content Management)
**Write Access Required Roles:**
- `admin` - Full CRUD access
- `social_media` - Can create/edit content items (for social media content)

**Recommended RLS Policy:**
```sql
-- Policy: Admins and social_media can insert/update content_items
CREATE POLICY "Role-based content_items write" ON public.content_items
  FOR INSERT, UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.key IN ('admin', 'social_media')
    )
  );

-- Policy: Admins can delete content_items
CREATE POLICY "Admins can delete content_items" ON public.content_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.key = 'admin'
    )
  );
```

### 2. `experiments` (Experiment Tracker)
**Write Access Required Roles:**
- `admin` - Full CRUD access

**Note:** Already has RLS policies in `create_experiments_table.sql` that check for admin access via `admin_allowlist` or `admin_users`. Should be updated to also check `user_roles` with "admin" role.

### 3. `admin_audit_log` (Audit Logging)
**Write Access Required Roles:**
- `admin` - Can insert audit logs
- `it` - Can insert audit logs (for IT operations tracking)

**Recommended RLS Policy:**
```sql
-- Policy: Admins and IT can insert audit logs
CREATE POLICY "Role-based audit_log write" ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.key IN ('admin', 'it')
    )
  );
```

### 4. `app_settings` / `system_settings` (System Configuration)
**Write Access Required Roles:**
- `admin` - Full CRUD access
- `it` - Can update certain settings (for IT maintenance)

**Recommended RLS Policy:**
```sql
-- Policy: Admins and IT can update settings
CREATE POLICY "Role-based settings write" ON public.app_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.key IN ('admin', 'it')
    )
  );
```

### 5. `support_tickets` / `user_reports` (Support System)
**Write Access Required Roles:**
- `admin` - Full access
- `it` - Can update/respond to tickets
- `operations` - Can view and update tickets

**Recommended RLS Policy:**
```sql
-- Policy: Admins, IT, and Operations can update support tickets
CREATE POLICY "Role-based support_tickets write" ON public.support_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.key IN ('admin', 'it', 'operations')
    )
  );
```

### 6. `user_roles` (Role Management)
**Write Access Required Roles:**
- `admin` - Full CRUD access (assign/remove roles)

**Note:** Already has RLS policies in `create_rbac_system.sql` that restrict write access to admins.

### 7. `roles` (Role Definitions)
**Write Access Required Roles:**
- `admin` - Full CRUD access (create/edit roles)

**Note:** Already has RLS policies in `create_rbac_system.sql` that restrict write access to admins.

## Implementation Notes

1. **Migration Strategy:**
   - These policies should be added via new migration files
   - Test policies in development before applying to production
   - Consider using `CREATE POLICY IF NOT EXISTS` for idempotency

2. **Performance:**
   - The `user_roles` join with `roles` is indexed, so performance should be acceptable
   - Consider adding indexes on `user_roles.user_id` and `roles.key` if not already present

3. **Backward Compatibility:**
   - Existing policies that check `admin_allowlist` or `admin_users` should remain
   - New policies should use `OR` to check both old and new systems during transition

4. **Testing:**
   - Test each role's access to ensure proper restrictions
   - Verify that users without roles cannot write to protected tables
   - Ensure read access remains appropriate (users can read their own data, etc.)

## Helper Function Usage

The `is_admin(uid)` function can be used in policies, but for role-based checks, direct joins are more flexible:

```sql
-- Example: Check for multiple roles
EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid() 
  AND r.key IN ('admin', 'it', 'operations')
)
```

