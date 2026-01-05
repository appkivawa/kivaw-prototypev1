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
interface InviteUserRequest {
  email: string;
  roles: string[];
}

interface InviteUserResponse {
  success: boolean;
  user_id?: string;
  error?: string;
}

/**
 * Assign roles to a user (replaces existing roles)
 */
async function assignRolesToUser(
  serviceClient: ReturnType<typeof getServiceRoleClient>,
  userId: string,
  roleKeys: string[]
): Promise<string | null> {
  try {
    // Fetch role IDs for the provided role keys
    const { data: roles, error: rolesError } = await serviceClient
      .from("roles")
      .select("id, key")
      .in("key", roleKeys);

    if (rolesError) {
      return `Failed to fetch roles: ${rolesError.message}`;
    }

    if (roleKeys.length > 0 && (!roles || roles.length === 0)) {
      return `No roles found for keys: ${roleKeys.join(", ")}`;
    }

    // Delete existing roles for this user
    const { error: deleteError } = await serviceClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.warn("Error deleting existing roles:", deleteError);
      // Continue anyway - might be first time assigning roles
    }

    // Insert new roles (if any)
    if (roles && roles.length > 0) {
      const roleAssignments = roles.map((role) => ({
        user_id: userId,
        role_id: role.id,
      }));

      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert(roleAssignments);

      if (insertError) {
        return `Failed to assign roles: ${insertError.message}`;
      }
    }

    return null;
  } catch (e: any) {
    return `Exception assigning roles: ${e?.message || "Unknown error"}`;
  }
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
    const body: InviteUserRequest = await req.json();
    const { email, roles } = body;

    // Validate input
    if (!email || typeof email !== "string" || !email.trim()) {
      return jsonResponse({ success: false, error: "Invalid email: email is required" }, 400);
    }

    if (!Array.isArray(roles)) {
      return jsonResponse({ success: false, error: "Invalid roles: must be an array" }, 400);
    }

    // Invite user via Admin API
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/auth/callback`,
      }
    );

    if (inviteError) {
      // If user already exists, try to get their ID and assign roles
      if (
        inviteError.message?.includes("already registered") ||
        inviteError.message?.includes("already exists")
      ) {
        const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers();

        if (listError) {
          return jsonResponse(
            { success: false, error: `User exists but could not retrieve: ${listError.message}` },
            500
          );
        }

        const existingUser = usersData.users.find((u) => u.email === email.trim());
        if (existingUser) {
          // Assign roles to existing user
          if (roles.length > 0) {
            const roleError = await assignRolesToUser(serviceClient, existingUser.id, roles);
            if (roleError) {
              console.warn(`User exists but roles assignment failed: ${roleError}`);
              return jsonResponse(
                { success: false, error: `User exists but failed to assign roles: ${roleError}` },
                500
              );
            }
          }
          return jsonResponse({ success: true, user_id: existingUser.id }, 200);
        }
      }

      return jsonResponse(
        { success: false, error: `Failed to invite user: ${inviteError.message}` },
        500
      );
    }

    if (!inviteData?.user?.id) {
      return jsonResponse({ success: false, error: "User created but no ID returned" }, 500);
    }

    const newUserId = inviteData.user.id;

    // Assign roles to new user
    if (roles.length > 0) {
      const roleError = await assignRolesToUser(serviceClient, newUserId, roles);
      if (roleError) {
        console.warn(`User created but roles assignment failed: ${roleError}`);
        return jsonResponse(
          { success: false, error: `User created but failed to assign roles: ${roleError}` },
          500
        );
      }
    }

    return jsonResponse({ success: true, user_id: newUserId }, 200);
  } catch (e: any) {
    console.error("admin-invite-user error:", e);
    return jsonResponse(
      { success: false, error: e?.message || "Server error" },
      500
    );
  }
});
