/**
 * ============================================================
 * GET RECOMMENDATIONS EDGE FUNCTION
 * ============================================================
 * 
 * POST /functions/v1/get-recommendations
 * Body: {
 *   state: "blank" | "destructive" | "expansive" | "minimize",
 *   focus: "music" | "watch" | "read" | "move" | "create" | "reset",
 *   timeAvailableMin: number,
 *   energyLevel: number (1-5),
 *   intent?: string,
 *   noHeavy?: boolean
 * }
 * 
 * Returns: { recommendations: Recommendation[], metadata: {...} }
 * 
 * ============================================================
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

// Import recommendation engine (we'll need to bundle or inline)
// For now, we'll implement core logic here

type RecommendationRequest = {
  state: "blank" | "destructive" | "expansive" | "minimize";
  focus: "music" | "watch" | "read" | "move" | "create" | "reset";
  timeAvailableMin: number;
  energyLevel: number;
  intent?: string;
  noHeavy?: boolean;
};

type ContentItem = {
  id: string;
  type: string;
  title: string;
  tags: string[];
  genres: string[];
  intensity: number;
  cognitive_load: number;
  novelty: number;
  duration_min: number | null;
  popularity: number;
  rating: number | null;
  link: string | null;
  source: string;
  description?: string | null;
  image_url?: string | null;
};

type UserPreferences = {
  user_id: string;
  liked_tags: string[];
  disliked_tags: string[];
  liked_genres: string[];
  disliked_genres: string[];
  intensity_tolerance: number;
  novelty_tolerance: number;
};

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
    const body: RecommendationRequest = await req.json().catch(() => ({}));

    // Validate request
    if (!body.state || !body.focus || !body.timeAvailableMin || !body.energyLevel) {
      return jsonResponse(
        { error: "Missing required fields: state, focus, timeAvailableMin, energyLevel" },
        400
      );
    }

    if (body.energyLevel < 1 || body.energyLevel > 5) {
      return jsonResponse({ error: "energyLevel must be between 1 and 5" }, 400);
    }

    // Fetch user preferences (create default if missing)
    let { data: prefs } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!prefs) {
      // Create default preferences
      const { data: newPrefs } = await supabase
        .from("user_preferences")
        .insert({
          user_id: user.id,
          liked_tags: [],
          disliked_tags: [],
          liked_genres: [],
          disliked_genres: [],
          intensity_tolerance: 0.5,
          novelty_tolerance: 0.5,
        })
        .select()
        .single();

      prefs = newPrefs;
    }

    // Fetch candidate items based on focus
    let candidatesQuery = supabase.from("content_items").select("*");

    // Filter by type based on focus
    const focusTypeMap: Record<string, string[]> = {
      music: ["listen"],
      watch: ["watch"],
      read: ["read"],
      move: ["move"],
      create: ["create"],
      reset: ["reset"],
    };

    const allowedTypes = focusTypeMap[body.focus] || ["watch", "read", "listen"];
    candidatesQuery = candidatesQuery.in("type", allowedTypes);

    // Also fetch internal_actions if focus is move/create/reset
    let internalActions: ContentItem[] = [];
    if (["move", "create", "reset"].includes(body.focus)) {
      const { data: actions } = await supabase
        .from("internal_actions")
        .select("*")
        .eq("type", body.focus);

      if (actions) {
        internalActions = actions.map((action) => ({
          id: action.id,
          type: action.type,
          title: action.title,
          tags: action.tags || [],
          genres: [],
          intensity: Number(action.intensity),
          cognitive_load: Number(action.cognitive_load),
          novelty: Number(action.novelty),
          duration_min: action.duration_min,
          popularity: 0.5,
          rating: null,
          link: action.link,
          source: "internal",
          description: action.description,
          image_url: null,
        }));
      }
    }

    const { data: contentItems, error: itemsError } = await candidatesQuery;

    if (itemsError) {
      console.error("Error fetching content items:", itemsError);
      return jsonResponse({ error: "Failed to fetch content items" }, 500);
    }

    // Combine content items and internal actions
    const allCandidates: ContentItem[] = [
      ...(contentItems || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        tags: item.tags || [],
        genres: item.genres || [],
        intensity: Number(item.intensity),
        cognitive_load: Number(item.cognitive_load),
        novelty: Number(item.novelty),
        duration_min: item.duration_min,
        popularity: Number(item.popularity),
        rating: item.rating ? Number(item.rating) : null,
        link: item.link,
        source: item.source,
        description: item.description,
        image_url: item.image_url,
      })),
      ...internalActions,
    ];

    // TODO: Import and use the recommendation engine
    // For now, return a simple response
    // In production, you'd import from the bundled TypeScript files

    return jsonResponse({
      recommendations: allCandidates.slice(0, 12).map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        link: item.link,
        score: 75, // Placeholder
        why: "Good fit for your state",
        tags: item.tags,
        source: item.source,
        description: item.description,
        image_url: item.image_url,
      })),
      metadata: {
        totalCandidates: allCandidates.length,
        state: body.state,
        focus: body.focus,
      },
    });
  } catch (error) {
    console.error("Error in get-recommendations:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});










