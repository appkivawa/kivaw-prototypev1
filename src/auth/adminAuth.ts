/**
 * Admin Authentication & Authorization
 * 
 * Checks if a user has admin privileges
 */

import { supabase } from "../lib/supabaseClient";
import { getUserId } from "../data/savesApi";

/**
 * Check if the current user is an admin
 * 
 * This checks the admin_users table in Supabase.
 * To make a user an admin, add their user_id to the admin_users table.
 * 
 * @returns Promise<boolean> - true if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const userId = await getUserId();
    if (!userId) return false;

    // Check if user exists in admin_users table
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
      navigate("/login", { state: { from: "/admin" } });
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

