import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

// ============================================================
// Types
// ============================================================

export interface UnifiedContentItem {
  id: string;                    // 'feed_items:{uuid}' | 'recommendation:{uuid}' | 'cache:{uuid}'
  kind: string;                  // 'rss' | 'article' | 'video' | 'podcast' | 'watch' | 'read' | etc.
  title: string;
  byline: string | null;
  image_url: string | null;
  url: string | null;
  provider: string;              // 'rss' | 'youtube' | 'tmdb' | 'open_library' | etc.
  external_id: string | null;
  tags: string[];
  created_at: string;
  raw: Record<string, unknown> | null;
  score: number | null;
}

export interface ExploreFeedV2Request {
  limit?: number;
  cursor?: string;               // Base64 encoded offset (for pagination)
  kinds?: string[];              // Filter by kind: ['rss', 'watch', 'read']
  tags?: string[];               // Filter by tags: ['tech', 'ai']
  sort?: "featured" | "recent" | "score";  // Ordering strategy
}

export interface ExploreFeedV2Response {
  items: UnifiedContentItem[];
  nextCursor?: string;           // Base64 encoded offset for next page (if has more)
  hasMore: boolean;
}

// ============================================================
// Helpers
// ============================================================

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const decoded = atob(cursor);
    const offset = parseInt(decoded, 10);
    return isNaN(offset) ? 0 : Math.max(0, offset);
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number): string {
  return btoa(offset.toString());
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") {
    return jsonResponse({ ok: true, fn: "explore_feed_v2", version: "1.0.0" });
  }

  try {
    // Validate environment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(
        { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" },
        500
      );
    }

    // Create Supabase client with user auth (respects RLS)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    });

    // Parse request body
    let body: ExploreFeedV2Request = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      }
    } catch (parseErr: any) {
      console.warn("[explore_feed_v2] Body parse error (non-fatal):", parseErr?.message);
      body = {};
    }

    // Parse parameters
    const limit = typeof body.limit === "number" 
      ? Math.min(Math.max(body.limit, 1), 200)  // Min 1, max 200
      : 50;  // Default: 50 items
    
    const cursor = body.cursor;
    const offset = decodeCursor(cursor);
    
    const kinds = Array.isArray(body.kinds) ? body.kinds : undefined;
    const tags = Array.isArray(body.tags) ? body.tags : undefined;
    const sort = body.sort || "featured";  // Default: featured first

    // Build query
    let query = supabase
      .from("explore_items_v2")
      .select("*", { count: "exact" });

    // Apply filters
    if (kinds && kinds.length > 0) {
      query = query.in("kind", kinds);
    }

    if (tags && tags.length > 0) {
      // Filter by tags (contains any of the provided tags)
      // Note: Supabase PostgREST supports array overlap with cs (contains) operator
      query = query.contains("tags", tags);
    }

    // Apply ordering based on sort strategy
    switch (sort) {
      case "featured":
        // Featured first: public_recommendations (id starts with 'recommendation:') by rank desc,
        // then feed_items with score desc,
        // then external_content_cache (no score) by created_at desc
        query = query
          .order("score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false });
        break;
      
      case "recent":
        // Pure recency: created_at desc, then score desc as tiebreaker
        query = query
          .order("created_at", { ascending: false, nullsFirst: false })
          .order("score", { ascending: false, nullsFirst: false });
        break;
      
      case "score":
        // Score first: score desc, then created_at desc as tiebreaker
        query = query
          .order("score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false });
        break;
      
      default:
        // Fallback: featured ordering
        query = query
          .order("score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false });
    }

    // Apply pagination (must be after ordering)
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error("[explore_feed_v2] Query error:", error);
      return jsonResponse(
        { error: "Failed to fetch explore items", detail: error.message },
        500
      );
    }

    // Transform to UnifiedContentItem (ensure types match)
    const items: UnifiedContentItem[] = (data || []).map((row: any) => ({
      id: String(row.id || ""),
      kind: String(row.kind || ""),
      title: String(row.title || ""),
      byline: row.byline ? String(row.byline) : null,
      image_url: row.image_url ? String(row.image_url) : null,
      url: row.url ? String(row.url) : null,
      provider: String(row.provider || ""),
      external_id: row.external_id ? String(row.external_id) : null,
      tags: Array.isArray(row.tags) ? row.tags.map((t: any) => String(t)) : [],
      created_at: String(row.created_at || ""),
      raw: row.raw ? (typeof row.raw === "object" ? row.raw : {}) : null,
      score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
    }));

    // Determine if there are more items
    const totalCount = count ?? 0;
    const nextOffset = offset + limit;
    const hasMore = nextOffset < totalCount;
    const nextCursor = hasMore ? encodeCursor(nextOffset) : undefined;

    // Return response
    const response: ExploreFeedV2Response = {
      items,
      nextCursor,
      hasMore,
    };

    return jsonResponse(response);
  } catch (e: any) {
    console.error("[explore_feed_v2] Unhandled error:", e);
    return jsonResponse(
      { error: "Internal server error", detail: e?.message || String(e) },
      500
    );
  }
});

