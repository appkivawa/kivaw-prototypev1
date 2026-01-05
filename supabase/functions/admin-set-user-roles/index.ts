import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// INLINED SHARED CODE (CORS)
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// INLINED SHARED CODE (AUTH)
// ============================================================

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
function getUserIdFromJwt(jwt: string): string | null {
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
function getUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return null;
  return getUserIdFromJwt(jwt);
}

/**
 * Create Supabase client with service role key (for admin operations)
 */
function getServiceRoleClient() {
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
async function checkIsAdmin(
  serviceClient: ReturnType<typeof getServiceRoleClient>,
  userId: string
): Promise<boolean> {
  try {
    // Use the is_admin() function from the migration (FIXED: use check_uid parameter)
    const { data, error } = await serviceClient.rpc("is_admin", { check_uid: userId });

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
    .select("role_id, role:roles!user_roles_role_id_fkey(id, key)")
    .eq("user_id", userId);

  if (rolesData && rolesData.length > 0) {
    // Check if any role is admin
    for (const ur of rolesData) {
      const role = ur.role as { id: string; key: string } | null;
      if (role?.key === "admin") {
        return true;
      }
    }
  }

  return false;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

// Request/Response types
interface SetUserRolesRequest {
  user_id: string;
  roles: string[];
}

interface SetUserRolesResponse {
  success: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get requester user ID from JWT
    const requesterUserId = getUserIdFromRequest(req);
    if (!requesterUserId) {
      return jsonResponse({ success: false, error: "Missing or invalid auth token" }, 401);
    }

    // Create service role client for admin operations
    const serviceClient = getServiceRoleClient();

    // Check if requester is admin
    const isRequesterAdmin = await checkIsAdmin(serviceClient, requesterUserId);
    if (!isRequesterAdmin) {
      return jsonResponse(
        { success: false, error: "Forbidden: Admin access required" },
        403
      );
    }

    // Parse request body
    const body: SetUserRolesRequest = await req.json();
    const { user_id, roles } = body;

    // Validate input
    if (!user_id || typeof user_id !== "string") {
      return jsonResponse({ success: false, error: "Invalid user_id: user_id is required" }, 400);
    }

    if (!Array.isArray(roles)) {
      return jsonResponse({ success: false, error: "Invalid roles: must be an array" }, 400);
    }

    // Verify user exists
    const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(user_id);

    if (userError || !userData?.user) {
      return jsonResponse(
        { success: false, error: `User not found: ${userError?.message || "Unknown error"}` },
        404
      );
    }

    // Get role IDs for the provided role keys
    const { data: rolesData, error: rolesError } = await serviceClient
      .from("roles")
      .select("id, key")
      .in("key", roles);

    if (rolesError) {
      return jsonResponse(
        { success: false, error: `Failed to fetch roles: ${rolesError.message}` },
        500
      );
    }

    // Verify all requested roles exist (if any roles provided)
    if (roles.length > 0) {
      if (!rolesData || rolesData.length === 0) {
        return jsonResponse(
          { success: false, error: `No roles found for keys: ${roles.join(", ")}` },
          400
        );
      }

      // Check if all requested roles were found
      const foundRoleKeys = new Set(rolesData.map((r) => r.key));
      const missingRoles = roles.filter((key) => !foundRoleKeys.has(key));
      if (missingRoles.length > 0) {
        return jsonResponse(
          { success: false, error: `Roles not found: ${missingRoles.join(", ")}` },
          400
        );
      }
    }

    // Delete existing roles for this user (transactional: replace all)
    const { error: deleteError } = await serviceClient
      .from("user_roles")
      .delete()
      .eq("user_id", user_id);

    if (deleteError) {
      return jsonResponse(
        { success: false, error: `Failed to remove existing roles: ${deleteError.message}` },
        500
      );
    }

    // Insert new roles (if any)
    if (rolesData && rolesData.length > 0) {
      const roleAssignments = rolesData.map((role) => ({
        user_id: user_id,
        role_id: role.id,
      }));

      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert(roleAssignments);

      if (insertError) {
        return jsonResponse(
          { success: false, error: `Failed to assign roles: ${insertError.message}` },
          500
        );
      }
    }

    return jsonResponse({ success: true }, 200);
  } catch (e: any) {
    console.error("admin-set-user-roles error:", e);
    return jsonResponse(
      { success: false, error: e?.message || "Server error" },
      500
    );
  }
});
