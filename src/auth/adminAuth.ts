/**
 * Admin Authentication & Authorization
 * 
 * Checks if a user has admin privileges and role-based access
 */

import { supabase } from "../lib/supabaseClient";
import { getUserId } from "../data/savesApi";

export type AdminRole = "owner" | "admin" | "editor" | "support";

export interface AdminRoleInfo {
  role: AdminRole;
  permissions: Record<string, boolean>;
}

/**
 * Check if the current user is an admin (any role)
 * 
 * This checks both admin_users table (legacy) and admin_roles table (new)
 * 
 * @returns Promise<boolean> - true if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const userId = await getUserId();
    if (!userId) return false;

    // First check admin_roles table (new role-based system)
    const { data: roleData, error: roleError } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleError && roleData) {
      return true;
    }

    // Fallback to admin_users table (legacy)
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Check if table doesn't exist (code 42P01 in PostgreSQL)
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn(
          "Admin table does not exist. Please run the migration: supabase/migrations/create_admin_users.sql"
        );
        return false;
      }
      // Other errors - log but don't throw
      console.warn("Admin check failed:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Get user's admin role and permissions
 */
export async function getAdminRole(): Promise<AdminRoleInfo | null> {
  try {
    const userId = await getUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from("admin_roles")
      .select("role, permissions")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      // Fallback: if user is in admin_users but not admin_roles, assume admin role
      const isUserAdmin = await isAdmin();
      if (isUserAdmin) {
        return { role: "admin", permissions: {} };
      }
      return null;
    }

    return {
      role: data.role as AdminRole,
      permissions: (data.permissions as Record<string, boolean>) || {},
    };
  } catch (error) {
    console.error("Error getting admin role:", error);
    return null;
  }
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const roleInfo = await getAdminRole();
  if (!roleInfo) return false;

  // Owners and admins have all permissions
  if (roleInfo.role === "owner" || roleInfo.role === "admin") {
    return true;
  }

  // Check specific permission
  return roleInfo.permissions[permission] === true;
}

/**
 * Check if user has minimum role level
 */
export async function hasRole(minRole: AdminRole): Promise<boolean> {
  const roleInfo = await getAdminRole();
  if (!roleInfo) return false;

  const roleHierarchy: Record<AdminRole, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    support: 1,
  };

  return roleHierarchy[roleInfo.role] >= roleHierarchy[minRole];
}

/**
 * Require admin access - redirects if not admin
 * 
 * @param navigate - Navigation function
 * @returns Promise<string | null> - User ID if admin, null otherwise
 */
export async function requireAdmin(
  navigate: (to: string) => void
): Promise<string | null> {
  try {
    const userId = await getUserId();
    if (!userId) {
      navigate("/login");
      return null;
    }

    const admin = await isAdmin();
    if (!admin) {
      // Don't redirect - return null so component can show error message
      // This allows the page to show setup instructions or access denied message
      return null;
    }

    return userId;
  } catch (error) {
    console.error("Error in requireAdmin:", error);
    // On error, return null so component can handle it
    return null;
  }
}

/**
 * Get admin user info
 */
export async function getAdminInfo(userId: string) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

