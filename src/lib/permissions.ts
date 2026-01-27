/**
 * Single Source of Truth for Permissions
 * 
 * This module provides a unified way to check user permissions
 * by calling the get_user_permissions() RPC function.
 * 
 * All frontend permission checks should use this module.
 */

import { supabase } from "./supabaseClient";

export type UserPermissions = {
  user_id: string;
  email: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  role_keys: string[];
};

/**
 * Get current user's permissions from database
 * Uses get_user_permissions() RPC function (single source of truth)
 */
export async function getUserPermissions(): Promise<UserPermissions | null> {
  try {
    const { data, error } = await supabase.rpc("get_user_permissions");

    if (error) {
      console.error("[permissions] Error fetching permissions:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data as UserPermissions;
  } catch (err) {
    console.error("[permissions] Exception fetching permissions:", err);
    return null;
  }
}

/**
 * Get permissions for a specific user (admin only)
 */
export async function getUserPermissionsById(userId: string): Promise<UserPermissions | null> {
  try {
    const { data, error } = await supabase.rpc("get_user_permissions", {
      check_uid: userId,
    });

    if (error) {
      console.error("[permissions] Error fetching permissions for user:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data as UserPermissions;
  } catch (err) {
    console.error("[permissions] Exception fetching permissions:", err);
    return null;
  }
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const perms = await getUserPermissions();
  return perms?.is_admin ?? false;
}

/**
 * Check if current user is super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const perms = await getUserPermissions();
  return perms?.is_super_admin ?? false;
}

/**
 * Check if current user has a specific role
 */
export async function hasRole(roleKey: string): Promise<boolean> {
  const perms = await getUserPermissions();
  return perms?.role_keys.includes(roleKey) ?? false;
}

/**
 * Check if current user has any of the specified roles
 */
export async function hasAnyRole(roleKeys: string[]): Promise<boolean> {
  const perms = await getUserPermissions();
  if (!perms) return false;
  return roleKeys.some((key) => perms.role_keys.includes(key));
}
