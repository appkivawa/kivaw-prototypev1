// src/auth/useRoles.ts
import { useCallback, useMemo } from "react";
import { usePermissions } from "./usePermissions";
import { isAdmin as checkIsAdmin, isOps as checkIsOps, hasAnyRole, hasRole } from "./roleUtils";
import type { RoleKey } from "./roleUtils";

type Role = {
  id: string;
  key: string;
  name: string;
};

/**
 * Compatibility wrapper around RPC-based permissions.
 *
 * IMPORTANT:
 * - No direct table reads (no user_roles query).
 * - No dev failsafe injections here (admin gating handled by RequireAdmin + VITE_DEV_ADMIN_EMAILS).
 * - Keeps the old API shape so the rest of your app doesn’t need a rewrite.
 */
export function useRoles() {
  const { loading, error, perms, roleKeys, isAdmin, isSuperAdmin, refresh } = usePermissions();

  // Build a Role[] for UI components that expect full objects.
  // If you have a real role name map, you can improve this later.
  const roles: Role[] = useMemo(() => {
    return (roleKeys || []).map((k) => ({
      id: `role:${k}`,
      key: k,
      name: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }, [roleKeys]);

  const isOps = useMemo(() => checkIsOps(roleKeys), [roleKeys]);

  // Keep old helper funcs
  const hasRoleFn = useCallback((roleKey: RoleKey) => hasRole(roleKeys, roleKey), [roleKeys]);

  const hasAnyRoleFn = useCallback((allow: RoleKey[]) => hasAnyRole(roleKeys, allow), [roleKeys]);

  const refreshRoles = useCallback(() => {
    // keep old name, call the new refresh
    refresh();
  }, [refresh]);

  return {
    roles,
    roleKeys,
    isAdmin: checkIsAdmin(roleKeys) || isAdmin || isSuperAdmin, // admin override
    isSuperAdmin,
    isOps,
    loading,
    error,
    // Old hook exposed this; now it’s not meaningful. Keep for compatibility.
    rpcAdminCheck: perms ? (perms.is_admin || perms.is_super_admin) : null,
    hasRole: hasRoleFn,
    hasAnyRole: hasAnyRoleFn,
    refreshRoles,
  };
}

