/**
 * ============================================================
 * LOG INTERACTION EDGE FUNCTION
 * ============================================================
 * 
 * POST /functions/v1/log-interaction
 * Body: {
 *   contentId: string,
 *   action: "view" | "save" | "skip" | "dismiss",
 *   state?: "blank" | "destructive" | "expansive" | "minimize",
 *   focus?: "music" | "watch" | "read" | "move" | "create" | "reset"
 * }
 * 
 * ============================================================
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Missing Supabase configuration" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid authentication" }, 401);
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));

    if (!body.contentId || !body.action) {
      return jsonResponse({ error: "Missing required fields: contentId, action" }, 400);
    }

    if (!["view", "save", "skip", "dismiss"].includes(body.action)) {
      return jsonResponse({ error: "Invalid action. Must be: view, save, skip, dismiss" }, 400);
    }

    // Insert interaction event
    const { data, error } = await supabase
      .from("interaction_events")
      .insert({
        user_id: user.id,
        content_id: body.contentId,
        action: body.action,
        state: body.state || null,
        focus: body.focus || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error logging interaction:", error);
      return jsonResponse({ error: "Failed to log interaction" }, 500);
    }

    return jsonResponse({ success: true, interaction: data });
  } catch (error) {
    console.error("Error in log-interaction:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});










