// Shared auth helper for Supabase Edge Functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Base64URL decode helper
function b64urlDecode(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Extract user ID from JWT token
 */
export function getUserIdFromJwt(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(b64urlDecode(parts[1]));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Get user ID from Authorization header
 */
export function getUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return null;
  return getUserIdFromJwt(jwt);
}

/**
 * Create Supabase client with anon key (for identifying requester)
 */
export function getAnonClient(jwt: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: { persistSession: false },
  });
}

/**
 * Create Supabase client with service role key (for admin operations)
 */
export function getServiceRoleClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Check if user is admin using is_admin() RPC function
 * Falls back to direct table checks if function doesn't exist
 */
export async function checkIsAdmin(
  serviceClient: ReturnType<typeof getServiceRoleClient>,
  userId: string
): Promise<boolean> {
  try {
    // Use the is_admin() function from the migration
    const { data, error } = await serviceClient.rpc("is_admin", { uid: userId });

    if (error) {
      console.error("Error checking admin status via RPC:", error);
      // Fallback to direct table checks if function doesn't exist
      return await checkIsAdminFallback(serviceClient, userId);
    }

    return data === true;
  } catch (e) {
    console.error("Exception checking admin status:", e);
    return await checkIsAdminFallback(serviceClient, userId);
  }
}

/**
 * Fallback admin check: directly query admin_allowlist and user_roles
 */
async function checkIsAdminFallback(
  serviceClient: ReturnType<typeof getServiceRoleClient>,
  userId: string
): Promise<boolean> {
  // Check admin_allowlist (break-glass access)
  const { data: allowlistCheck } = await serviceClient
    .from("admin_allowlist")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (allowlistCheck) {
    return true;
  }

  // Check user_roles for admin role
  const { data: rolesData } = await serviceClient
    .from("user_roles")
    .select("role_id, roles!inner(id, key)")
    .eq("user_id", userId)
    .eq("roles.key", "admin")
    .maybeSingle();

  if (rolesData) {
    return true;
  }

  // Legacy: Check admin_users table if it exists
  try {
    const { data: adminUsersCheck } = await serviceClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminUsersCheck) {
      return true;
    }
  } catch {
    // admin_users table doesn't exist, ignore
  }

  return false;
}
