/**
 * Role utility functions for checking user roles.
 *
 * IMPORTANT:
 * - Client-side checks are for UX only.
 * - Real security is enforced by RLS + server-side (Edge Functions / SQL).
 *
 * This file is designed to work with the RPC `get_my_permissions()` which returns:
 * - is_admin (boolean)
 * - is_super_admin (boolean)
 * - role_keys (string[])
 */

export type Role = {
  id: string;
  key: string;
  name: string;
};

export type RoleKey = string;

export function hasAnyRole(userRoles: RoleKey[], allow: RoleKey[]): boolean {
  if (!userRoles?.length) return false;
  if (!allow?.length) return false;

  const userSet = new Set(userRoles.map((r) => String(r).toLowerCase()));
  return allow.some((role) => userSet.has(String(role).toLowerCase()));
}

export function hasRole(userRoles: RoleKey[], roleKey: RoleKey): boolean {
  if (!userRoles?.length) return false;
  const userSet = new Set(userRoles.map((r) => String(r).toLowerCase()));
  return userSet.has(String(roleKey).toLowerCase());
}

/**
 * Admin check should primarily use server-verified flags from RPC.
 * `role_keys` can still include "admin" if you want, but it shouldn't be required.
 */
export function isAdmin(userRoles: RoleKey[], isAdminFlag?: boolean, isSuperAdminFlag?: boolean): boolean {
  if (isSuperAdminFlag === true) return true;
  if (isAdminFlag === true) return true;

  // Optional fallback: treat "admin" role as admin for legacy setups
  return hasRole(userRoles, "admin");
}

export function isSuperAdmin(isSuperAdminFlag?: boolean): boolean {
  return isSuperAdminFlag === true;
}

export function isOps(userRoles: RoleKey[]): boolean {
  // Support either "ops" or "operations" as keys (your code references both)
  return hasRole(userRoles, "ops") || hasRole(userRoles, "operations");
}

export function getRoleDisplayName(roleKey: RoleKey): string {
  const roleNames: Record<string, string> = {
    admin: "Administrator",
    super_admin: "Super Admin",
    it: "IT Support",
    social_media: "Social Media Manager",
    operations: "Operations",
    ops: "Operations",
    creator: "Creator",
  };

  return roleNames[roleKey] || roleKey;
}

export function formatRoles(roleKeys: RoleKey[]): string {
  if (!roleKeys?.length) return "No roles";
  return roleKeys.map(getRoleDisplayName).join(", ");
}


