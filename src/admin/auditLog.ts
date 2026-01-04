import { supabase } from "../lib/supabaseClient";
import { getUserId } from "../data/savesApi";

/**
 * Log an admin action to the audit log
 *
 * @param action - The action performed (e.g., "content_update", "user_delete", "settings_update")
 * @param targetId - The ID of the resource affected (optional)
 * @param metadata - Additional metadata about the action (optional)
 */
export async function logAdminAction(
  action: string,
  targetId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) {
      console.warn("Cannot log admin action: user not authenticated");
      return;
    }

    const { error } = await supabase.from("admin_audit_log").insert([
      {
        actor_user_id: userId,
        action,
        target_id: targetId || null,
        metadata: metadata || {},
      },
    ]);

    if (error) {
      // If table doesn't exist, just log to console (don't break the app)
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("admin_audit_log table does not exist. Run migration: create_admin_audit_log.sql");
        return;
      }
      console.error("Error logging admin action:", error);
    }
  } catch (e) {
    // Silently fail - don't break the app if audit logging fails
    console.error("Exception logging admin action:", e);
  }
}

