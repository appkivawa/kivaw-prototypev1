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
interface UserWithRoles {
  id: string;
  email: string | null;
  created_at: string;
  roles: string[];
}

interface ListUsersResponse {
  success: boolean;
  users?: UserWithRoles[];
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

    // List all users via Admin API
    const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers();

    if (usersError) {
      console.error("Error listing users:", usersError);
      return jsonResponse(
        { success: false, error: `Failed to list users: ${usersError.message}` },
        500
      );
    }

    const users = usersData.users || [];
    const userIds = users.map((u) => u.id);

    // Get all user roles in one query with proper join
    // Use explicit foreign key join to avoid recursion
    const { data: userRolesData, error: rolesError } = await serviceClient
      .from("user_roles")
      .select("user_id, role:roles!user_roles_role_id_fkey(id, key)")
      .in("user_id", userIds);

    if (rolesError) {
      console.warn("Error fetching user roles:", rolesError);
    }

    // Build a map of user_id -> role keys
    const rolesMap = new Map<string, string[]>();
    if (userRolesData) {
      for (const ur of userRolesData) {
        const uid = ur.user_id as string;
        const role = ur.role as { id: string; key: string } | null;
        if (role?.key) {
          if (!rolesMap.has(uid)) {
            rolesMap.set(uid, []);
          }
          rolesMap.get(uid)!.push(role.key);
        }
      }
    }

    // Combine user data with roles
    const usersWithRoles: UserWithRoles[] = users.map((user) => ({
      id: user.id,
      email: user.email || null,
      created_at: user.created_at || new Date().toISOString(),
      roles: rolesMap.get(user.id) || [],
    }));

    return jsonResponse({ success: true, users: usersWithRoles }, 200);
  } catch (e: any) {
    console.error("admin-list-users error:", e);
    return jsonResponse(
      { success: false, error: e?.message || "Server error" },
      500
    );
  }
});
