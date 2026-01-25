import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

// ============================================================
// Types
// ============================================================

export interface UnifiedContentItem {
  id: string;                    // 'feed_items:{uuid}' | 'recommendation:{uuid}' | 'cache:{uuid}' | 'creator_post:{uuid}'
  kind: string;                  // 'rss' | 'article' | 'video' | 'podcast' | 'watch' | 'read' | 'listen' | 'creator' | etc.
  title: string;
  byline: string | null;
  image_url: string | null;
  url: string | null;
  provider: string;              // 'rss' | 'youtube' | 'tmdb' | 'open_library' | 'google_books' | 'kivaw' | etc.
  external_id: string | null;
  tags: string[];
  created_at: string;
  raw: Record<string, unknown> | null;
  score: number | null;
}

export interface ExploreFeedV2Request {
  limit?: number;
  cursor?: string;               // Base64 encoded offset (for pagination)
  kinds?: string[];              // Filter by kind: ['watch', 'read', 'listen']
  providers?: string[];          // Filter by provider: ['tmdb', 'open_library']
}

export interface ExploreFeedV2Response {
  items: UnifiedContentItem[];
  nextCursor: string | null;     // Base64 encoded offset for next page (if has more)
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
    return jsonResponse({ ok: true, fn: "explore_feed_v2", version: "2.0.0" });
  }

  try {
    // Validate environment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("[explore_feed_v2] Missing environment variables");
      return jsonResponse(
        { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" },
        500
      );
    }

    // Get auth header (optional - function works for anonymous users)
    const authHeader = req.headers.get("Authorization") ?? "";
    const apikeyHeader = req.headers.get("apikey") ?? SUPABASE_ANON_KEY;
    
    // Log request info for debugging
    console.log("[explore_feed_v2] Request received:", {
      method: req.method,
      hasAuth: !!authHeader,
      hasApikey: !!apikeyHeader,
      contentType: req.headers.get("Content-Type"),
    });

    // Create Supabase client with user auth (respects RLS)
    // Works with or without Authorization header (anonymous access supported)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          apikey: apikeyHeader,
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

    // Parse and validate parameters
    const limit = typeof body.limit === "number" 
      ? Math.min(Math.max(body.limit, 1), 50)  // Clamp between 1 and 50
      : 20;  // Default: 20 items
    
    const cursor = body.cursor;
    const offset = decodeCursor(cursor);
    
    const kinds = Array.isArray(body.kinds) && body.kinds.length > 0 
      ? body.kinds.filter((k): k is string => typeof k === "string")
      : undefined;
    
    const providers = Array.isArray(body.providers) && body.providers.length > 0
      ? body.providers.filter((p): p is string => typeof p === "string")
      : undefined;

    // Build query - select specific columns from explore_items_v2
    let query = supabase
      .from("explore_items_v2")
      .select("id, kind, provider, external_id, url, title, byline, image_url, tags, created_at, raw, score", { count: "exact" });

    // Apply filters
    // Only filter by kinds if provided and non-empty
    if (kinds && kinds.length > 0) {
      query = query.in("kind", kinds);
    }

    // Only filter by providers if provided and non-empty
    if (providers && providers.length > 0) {
      query = query.in("provider", providers);
    }

    // Apply ordering: score DESC NULLS LAST, then created_at DESC
    query = query
      .order("score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });

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

    // Determine if there are more items (for cursor pagination)
    const totalCount = count ?? 0;
    const nextOffset = offset + limit;
    const hasMore = nextOffset < totalCount;
    const nextCursor = hasMore ? encodeCursor(nextOffset) : null;

    // Return response
    const response: ExploreFeedV2Response = {
      items,
      nextCursor,
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
