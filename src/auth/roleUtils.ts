/**
 * Role utility functions for checking user roles
 * 
 * Note: These are client-side checks for UX only.
 * Security is enforced by RLS policies and Edge Functions on the backend.
 */

export type Role = {
  id: string;
  key: string;
  name: string;
};

export type RoleKey = string;

/**
 * Check if user has any of the required roles
 * @param userRoles - Array of role keys the user has
 * @param allow - Array of role keys that are allowed
 * @returns true if user has at least one of the allowed roles
 */
export function hasAnyRole(userRoles: RoleKey[], allow: RoleKey[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  if (!allow || allow.length === 0) return false;
  return allow.some((role) => userRoles.includes(role));
}

/**
 * Check if user has a specific role
 * @param userRoles - Array of role keys the user has
 * @param roleKey - Role key to check for
 * @returns true if user has the role
 */
export function hasRole(userRoles: RoleKey[], roleKey: RoleKey): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.includes(roleKey);
}

/**
 * Check if user is an admin
 * Admin status can come from:
 * 1. Having "admin" role in user_roles
 * 2. Being in admin_allowlist (server-verified, but we check client-side for UX)
 * 
 * @param userRoles - Array of role keys the user has
 * @param isAdminFlag - Optional server-verified admin flag (if stored in session/profile)
 * @returns true if user is admin
 */
export function isAdmin(userRoles: RoleKey[], isAdminFlag?: boolean): boolean {
  // Check server-verified flag first (if available)
  if (isAdminFlag === true) return true;
  
  // Check if user has "admin" role
  return hasRole(userRoles, "admin");
}

/**
 * Check if user is a super admin
 * Super admins are the ultimate admins with all powers
 * 
 * @param isSuperAdminFlag - Server-verified super admin flag (from RPC or database)
 * @returns true if user is super admin
 */
export function isSuperAdmin(isSuperAdminFlag?: boolean): boolean {
  return isSuperAdminFlag === true;
}

/**
 * Check if user is an ops user
 * 
 * @param userRoles - Array of role keys the user has
 * @returns true if user has "ops" role
 */
export function isOps(userRoles: RoleKey[]): boolean {
  return hasRole(userRoles, "ops");
}

/**
 * Get role display name from role key
 * @param roleKey - Role key (e.g., "admin", "it")
 * @returns Display name for the role
 */
export function getRoleDisplayName(roleKey: RoleKey): string {
  const roleNames: Record<string, string> = {
    admin: "Administrator",
    it: "IT Support",
    social_media: "Social Media Manager",
    operations: "Operations",
    ops: "Operations",
  };
  
  return roleNames[roleKey] || roleKey;
}

/**
 * Format role keys for display
 * @param roleKeys - Array of role keys
 * @returns Formatted string of role names
 */
export function formatRoles(roleKeys: RoleKey[]): string {
  if (!roleKeys || roleKeys.length === 0) return "No roles";
  return roleKeys.map(getRoleDisplayName).join(", ");
}

