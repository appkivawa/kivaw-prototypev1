import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS Headers
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
// Auth Helpers
// ============================================================

function b64urlDecode(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

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

function getUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return null;
  return getUserIdFromJwt(jwt);
}

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
 * Check if user is admin or employee (ops, admin, super_admin)
 */
async function isAdminOrEmployee(userId: string, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    // Check if user is admin (includes super_admin via admin_allowlist)
    const { data: isAdminData, error: adminError } = await supabase.rpc("is_admin", { check_uid: userId });
    if (!adminError && isAdminData === true) {
      return true;
    }

    // Check if user has employee roles (ops, admin, super_admin)
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role:roles!user_roles_role_id_fkey(key)")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Error checking user roles:", rolesError);
      return false;
    }

    if (rolesData && rolesData.length > 0) {
      const roleKeys = rolesData.map((r: any) => r.role?.key).filter(Boolean);
      // Check for employee roles: ops, admin, super_admin
      return roleKeys.some((key: string) => ["ops", "admin", "super_admin"].includes(key));
    }

    return false;
  } catch (e) {
    console.error("Exception checking admin/employee status:", e);
    return false;
  }
}

// ============================================================
// Main Handler
// ============================================================

type UpdateProviderSettingsRequest = {
  provider: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get user ID from request
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Create clients
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const serviceClient = getServiceRoleClient();

    // Check if user is admin or employee (ops, admin, super_admin)
    const userIsAdminOrEmployee = await isAdminOrEmployee(userId, anonClient);
    if (!userIsAdminOrEmployee) {
      return jsonResponse({ error: "Forbidden: Admin or employee access required" }, 403);
    }

    // Parse request body
    const body: UpdateProviderSettingsRequest = await req.json().catch(() => ({}));
    const { provider, enabled, config } = body;

    if (!provider) {
      return jsonResponse({ error: "Provider is required" }, 400);
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (enabled !== undefined) {
      updateData.enabled = enabled;
    }
    if (config !== undefined) {
      updateData.config = config;
    }

    if (Object.keys(updateData).length === 0) {
      return jsonResponse({ error: "No fields to update" }, 400);
    }

    // Update provider_settings using service role client
    const { data, error } = await serviceClient
      .from("provider_settings")
      .upsert(
        {
          provider,
          ...updateData,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "provider",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating provider settings:", error);
      return jsonResponse({ error: error.message || "Failed to update provider settings" }, 500);
    }

    return jsonResponse({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in admin-update-provider-settings:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

