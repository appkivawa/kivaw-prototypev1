import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// base64url decode helper
function b64urlDecode(input: string) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!jwt) return json({ error: "Missing auth token" }, 401);

    const userId = getUserIdFromJwt(jwt);
    if (!userId) return json({ error: "Invalid token payload" }, 401);

    // allowlist check
    const { data: adminRow, error: adminErr } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminErr) return json({ error: "Admin check failed", detail: adminErr.message }, 500);
    if (!adminRow) return json({ error: "Forbidden" }, 403);

    // safe counts (won’t crash if table missing)
    const safeCount = async (table: string) => {
      try {
        const { count } = await admin.from(table).select("*", { count: "exact", head: true });
        return count ?? 0;
      } catch {
        return 0;
      }
    };

    const stats = {
      saves: await safeCount("saves_v2"),
      users: await safeCount("profiles"),
      echoes: await safeCount("echoes_v2"),
      waves: await safeCount("waves_events"),
    };

    return json({ ok: true, stats }, 200);
  } catch (e: any) {
    console.error("admin-stats error:", e);
    return json({ error: e?.message || "Server error" }, 500);
  }
});


