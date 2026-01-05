-- ============================================================
-- Super Admin Safeguards
-- ============================================================
-- Prevents:
-- 1. Removing super_admin from yourself
-- 2. Removing the last super_admin
-- 3. Deleting the last super_admin user
-- ============================================================

-- ============================================================
-- Function: Check if user is the last super admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_last_super_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_is_last_super_admin_func$
DECLARE
  super_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO super_admin_count
  FROM public.admin_allowlist
  WHERE super_admin = TRUE;
  
  -- If there's only one super admin and it's this user, return true
  IF super_admin_count = 1 THEN
    RETURN EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE user_id = check_user_id
        AND super_admin = TRUE
    );
  END IF;
  
  RETURN FALSE;
END;
$_is_last_super_admin_func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_last_super_admin(UUID) TO authenticated;

-- ============================================================
-- Function: Prevent removing super_admin from yourself
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_remove_super_admin(
  target_user_id UUID,
  requester_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $_can_remove_super_admin_func$
BEGIN
  -- Cannot remove super_admin from yourself
  IF target_user_id = requester_user_id THEN
    RETURN FALSE;
  END IF;
  
  -- Cannot remove super_admin if target is the last super admin
  IF public.is_last_super_admin(target_user_id) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$_can_remove_super_admin_func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_remove_super_admin(UUID, UUID) TO authenticated;

-- ============================================================
-- Trigger: Prevent removing super_admin from yourself
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_self_super_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $_prevent_self_removal_func$
BEGIN
  -- If updating super_admin to FALSE
  IF NEW.super_admin = FALSE AND OLD.super_admin = TRUE THEN
    -- Check if this is the last super admin
    IF public.is_last_super_admin(OLD.user_id) THEN
      RAISE EXCEPTION 'Cannot remove super_admin status: This is the last super admin in the system. At least one super admin must always exist.';
    END IF;
    
    -- Check if user is trying to remove their own super_admin status
    IF OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Cannot remove super_admin status: You cannot remove your own super_admin role.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_prevent_self_removal_func$;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_self_super_admin_removal_trigger ON public.admin_allowlist;
CREATE TRIGGER prevent_self_super_admin_removal_trigger
  BEFORE UPDATE ON public.admin_allowlist
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_super_admin_removal();

-- ============================================================
-- Trigger: Prevent deleting the last super admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_last_super_admin_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $_prevent_deletion_func$
DECLARE
  remaining_count INTEGER;
BEGIN
  -- Count remaining super admins after this deletion
  SELECT COUNT(*) INTO remaining_count
  FROM public.admin_allowlist
  WHERE super_admin = TRUE
    AND user_id != OLD.user_id;
  
  -- If this was the last super admin, prevent deletion
  IF OLD.super_admin = TRUE AND remaining_count = 0 THEN
    RAISE EXCEPTION 'Cannot delete user: This is the last super admin in the system. At least one super admin must always exist.';
  END IF;
  
  RETURN OLD;
END;
$_prevent_deletion_func$;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_last_super_admin_deletion_trigger ON public.admin_allowlist;
CREATE TRIGGER prevent_last_super_admin_deletion_trigger
  BEFORE DELETE ON public.admin_allowlist
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_super_admin_deletion();

-- ============================================================
-- RPC Function: Check super admin safeguards before role change
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_super_admin_safeguards(
  target_user_id UUID,
  will_have_super_admin BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $_check_safeguards_func$
DECLARE
  current_super_admin BOOLEAN;
  is_self BOOLEAN;
  is_last BOOLEAN;
  result JSONB;
BEGIN
  -- Get current super_admin status
  SELECT COALESCE(super_admin, FALSE) INTO current_super_admin
  FROM public.admin_allowlist
  WHERE user_id = target_user_id;
  
  -- Check if removing super_admin
  IF current_super_admin = TRUE AND will_have_super_admin = FALSE THEN
    -- Check if it's self
    is_self := (target_user_id = auth.uid());
    
    -- Check if it's the last super admin
    is_last := public.is_last_super_admin(target_user_id);
    
    -- Build result
    result := jsonb_build_object(
      'allowed', FALSE,
      'is_self', is_self,
      'is_last', is_last,
      'reason', CASE
        WHEN is_self THEN 'You cannot remove your own super_admin role.'
        WHEN is_last THEN 'Cannot remove super_admin: This is the last super admin in the system. At least one super admin must always exist.'
        ELSE 'Cannot remove super_admin status.'
      END
    );
    
    RETURN result;
  END IF;
  
  -- Allowed
  RETURN jsonb_build_object('allowed', TRUE);
END;
$_check_safeguards_func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_super_admin_safeguards(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- Notes
-- ============================================================
-- These safeguards ensure:
-- 1. Super admins cannot remove their own super_admin status
-- 2. The system always has at least one super admin
-- 3. The last super admin cannot be deleted
--
-- Frontend should also check these conditions and show warnings
-- before attempting the action.
-- ============================================================

