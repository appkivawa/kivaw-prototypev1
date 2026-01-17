import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS
// ============================================================
function getAllowedOrigin(req: Request): string {
  // Get allowed origins from env or default to wildcard
  const allowed = Deno.env.get("ALLOWED_ORIGINS");
  if (allowed) {
    const origins = allowed.split(",").map((o) => o.trim());
    const requestOrigin = req.headers.get("origin");
    // If request has origin and it's in allowed list, use it
    if (requestOrigin && origins.includes(requestOrigin)) {
      return requestOrigin;
    }
    // Otherwise allow all for development
    return "*";
  }
  // Default: allow all origins (for development)
  // In production, set ALLOWED_ORIGINS to your domain
  return "*";
}

function getCorsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  return null;
}

function jsonResponse(body: unknown, status = 200, req?: Request): Response {
  const corsHeaders = req ? getCorsHeaders(req) : {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// Types
// ============================================================
type Source = "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";

type FeedItem = {
  id: string;
  source: Source;
  external_id: string;
  url: string;
  title: string;
  summary?: string | null;
  author?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  topics?: string[] | null;
  metadata?: Record<string, unknown>;
  score?: number;
};

type Prefs = {
  sources?: Partial<Record<Source, number>>;
  topics?: Array<{ key: string; w: number }>;
  blocked_topics?: string[];
  length_pref?: "short" | "medium" | "long";
};

// ============================================================
// Helpers
// ============================================================
function cleanText(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}
function normalizeKey(s: string) {
  return cleanText(s).toLowerCase();
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function recencyScore(publishedAt?: string | null) {
  if (!publishedAt) return 0.15;
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 0.15;
  const hours = (Date.now() - t) / 36e5;
  const s = 1 / (1 + Math.max(0, hours) / 24);
  return clamp(s, 0.05, 1);
}
function actionWeights(actions: string[]) {
  if (actions.includes("hide")) return -5;
  let w = 0;
  if (actions.includes("save")) w += 2.2;
  if (actions.includes("like")) w += 1.4;
  if (actions.includes("open")) w += 0.35;
  return w;
}
function blob(it: FeedItem) {
  return normalizeKey(
    [it.title, it.summary, it.author, ...(it.tags ?? []), ...(it.topics ?? []), it.source]
      .filter(Boolean)
      .join(" "),
  );
}
function topicMatchScore(it: FeedItem, prefs: Prefs) {
  const list = prefs.topics ?? [];
  if (!list.length) return 0;
  const b = blob(it);

  let score = 0;
  for (const t of list) {
    const k = normalizeKey(t.key);
    if (!k) continue;
    if (b.includes(k)) score += clamp(t.w, 0, 3);
  }
  return clamp(score, 0, 4);
}
function blockedPenalty(it: FeedItem, prefs: Prefs) {
  const blocked = (prefs.blocked_topics ?? []).map(normalizeKey).filter(Boolean);
  if (!blocked.length) return 0;
  const b = blob(it);
  return blocked.some((k) => b.includes(k)) ? 3.5 : 0;
}
function sourceWeight(it: FeedItem, prefs: Prefs) {
  const w = prefs.sources?.[it.source] ?? 1;
  return clamp(w, 0, 3);
}

// ============================================================
// Config
// ============================================================
// Prefer published_at for recency filtering. 21 days default.
const DEFAULT_DAYS = 21;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // handy smoke test
  if (req.method === "GET") {
    return jsonResponse({ ok: true, fn: "social_feed" }, 200, req);
  }

  try {
    // Validate required environment variables
    // Note: SUPABASE_URL and SUPABASE_ANON_KEY are auto-provided by Supabase
    // but we validate them exist for safety
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missing = [];
      if (!SUPABASE_URL) missing.push("SUPABASE_URL");
      if (!SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
      
      console.error("[social_feed] Missing required environment variables:", missing);
      return jsonResponse(
        {
          feed: [],
          fresh: [],
          today: [],
          error: `Missing required environment variables: ${missing.join(", ")}`,
          message: "SUPABASE_URL and SUPABASE_ANON_KEY should be auto-provided by Supabase. If you see this error, check your Edge Function deployment.",
          debug: {
            authed: false,
            candidates: 0,
            returned: 0,
            error: `Missing: ${missing.join(", ")}`,
          },
        },
        500,
        req
      );
    }

    // IMPORTANT: Use ANON_KEY with user auth headers to respect RLS
    // - This allows the function to work with Row Level Security policies
    // - User queries (preferences, sources, actions) are scoped to the authenticated user
    // - Public queries (feed_items) work for both authenticated and anonymous users
    // - If you need to bypass RLS, use SUPABASE_SERVICE_ROLE_KEY instead (not recommended)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    });

    // Parse body with error handling
    let body: any = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      }
    } catch (parseErr: any) {
      // Body parsing errors are non-fatal - continue with empty body
      console.warn("[social_feed] Body parse error (non-fatal):", parseErr?.message);
      body = {};
    }

    const limit = typeof body.limit === "number" ? Math.min(Math.max(body.limit, 10), 120) : 60;
    const types: Source[] = Array.isArray(body.types) ? body.types : [];
    const query = cleanText(body.query ?? "");
    const days = typeof body.days === "number" ? Math.min(Math.max(body.days, 1), 365) : DEFAULT_DAYS;
    const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * days).toISOString();

    // Auth (optional - never return 401 for logged-out users)
    // Wrap in try/catch to isolate auth errors
    let userId: string | null = null;
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      // Only set userId if we have a valid user session
      if (!userErr && userData?.user) {
        userId = userData.user.id;
      }
    } catch (authErr: any) {
      // Auth errors are non-fatal - continue as logged-out user
      console.warn("[social_feed] Auth check error (non-fatal):", authErr?.message);
      userId = null;
    }

    // Defaults for logged-out users OR fallback for missing prefs row
    let prefs: Prefs = {
      sources: { youtube: 1.2, reddit: 1.0, rss: 1.0, spotify: 0.9, eventbrite: 0.9, podcast: 0.8 },
      topics: [],
      blocked_topics: [],
      length_pref: "medium",
    };

    // User-based data (only fetch if logged in)
    // Use per-query error isolation so one failing query doesn't break everything
    let followKeys = new Set<string>();
    const actionMap = new Map<string, string[]>();

    if (userId) {
      // Fetch user preferences, followed sources, and item actions
      // Each query is isolated - if one fails, others continue
      const [prefResult, followsResult, actionsResult] = await Promise.allSettled([
        supabase
          .from("user_preferences")
          .select("prefs")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("sources")
          .select("type, url, enabled, is_active")
          .eq("user_id", userId)
          .eq("enabled", true)
          .or("is_active.eq.true,is_active.is.null"),
        supabase
          .from("user_item_actions")
          .select("item_id, action")
          .eq("user_id", userId),
      ]);

      // Handle preferences (isolated error handling)
      if (prefResult.status === "fulfilled" && !prefResult.value.error && prefResult.value.data) {
        prefs = (prefResult.value.data.prefs as Prefs) ?? prefs;
      } else if (prefResult.status === "rejected") {
        console.warn("[social_feed] User preferences query failed (non-fatal):", prefResult.reason);
      }

      // Handle follows (isolated error handling)
      if (followsResult.status === "fulfilled" && !followsResult.value.error && followsResult.value.data) {
        // Filter for is_active: treat null as true, only exclude if explicitly false
        const activeSources = (followsResult.value.data ?? []).filter((f: any) => {
          // If is_active column doesn't exist, include all
          if (!("is_active" in f)) return true;
          // If is_active is null or true, include it
          return f.is_active !== false;
        });
        followKeys = new Set(activeSources.map((f: any) => `${String(f.type)}:${String(f.url)}`));
      } else if (followsResult.status === "rejected") {
        console.warn("[social_feed] User sources query failed (non-fatal):", followsResult.reason);
      }

      // Handle actions (isolated error handling)
      if (actionsResult.status === "fulfilled" && !actionsResult.value.error && actionsResult.value.data) {
        for (const a of actionsResult.value.data ?? []) {
          const id = String((a as any).item_id);
          const arr = actionMap.get(id) ?? [];
          arr.push(String((a as any).action));
          actionMap.set(id, arr);
        }
      } else if (actionsResult.status === "rejected") {
        console.warn("[social_feed] User actions query failed (non-fatal):", actionsResult.reason);
      }
    }
    // If userId is null (logged out), skip user queries and use defaults above

    // ============================================================
    // Fetch candidate rows with timeout protection
    // ============================================================
    // ✅ Fix: use published_at for time filtering.
    // If published_at is null, we'll still allow the row through if created_at is recent (via OR).
    let rows: any[] = [];
    let rowsErr: any = null;

    try {
      // Query feed_items - simplified without complex timeout (Supabase has built-in timeouts)
      let qx = supabase
        .from("feed_items")
        .select("id,source,external_id,url,title,summary,author,image_url,published_at,tags,topics,metadata,created_at,ingested_at")
        .or(`published_at.gte.${sinceIso},and(published_at.is.null,created_at.gte.${sinceIso})`)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(400);

      if (types.length) qx = qx.in("source", types);

      const { data: queryData, error: queryError } = await qx;
      rows = queryData ?? [];
      rowsErr = queryError ?? null;
    } catch (queryErr: any) {
      console.error("[social_feed] Query execution error:", queryErr);
      rowsErr = queryErr;
    }
    if (rowsErr) {
      console.error("[social_feed] Query error:", rowsErr);
      // If table doesn't exist, return empty feed with helpful error
      if (rowsErr.code === "42P01" || rowsErr.message?.includes("does not exist")) {
        return jsonResponse(
          {
            feed: [],
            fresh: [],
            today: [],
            error: "feed_items table does not exist. Please run the migration: supabase/migrations/create_feed_items.sql",
            message: rowsErr.message,
            debug: {
              authed: Boolean(userId),
              candidates: 0,
              returned: 0,
              error: rowsErr.message,
              code: rowsErr.code,
            },
          },
          200,
          req
        );
      }
      return jsonResponse(
        {
          feed: [],
          fresh: [],
          today: [],
          error: `Database query failed: ${rowsErr.message}`,
          message: rowsErr.message,
          code: rowsErr.code,
          debug: {
            authed: Boolean(userId),
            candidates: 0,
            returned: 0,
            error: rowsErr.message,
            code: rowsErr.code,
          },
        },
        500,
        req
      );
    }

    // Build map of RSS feed URLs to weights for quick lookup
    // Isolated error handling - if this fails, continue without weights
    const rssWeightMap = new Map<string, number>();
    try {
      const { data: rssSources } = await supabase
        .from("rss_sources")
        .select("url, weight")
        .eq("active", true);
      
      if (rssSources) {
        for (const src of rssSources) {
          rssWeightMap.set(src.url, src.weight ?? 1);
        }
      }
    } catch (rssErr: any) {
      // Non-fatal - continue without RSS weights
      console.warn("[social_feed] RSS sources query failed (non-fatal):", rssErr?.message);
    }

    let items: FeedItem[] = (rows ?? []).map((r: any) => {
      // Extract RSS source weight from metadata.feed_url
      let rssWeight = 1; // Default weight
      if (r.source === "rss" && r.metadata) {
        const feedUrl = (r.metadata as any)?.feed_url;
        if (feedUrl && rssWeightMap.has(feedUrl)) {
          rssWeight = rssWeightMap.get(feedUrl) ?? 1;
        }
      }
      
      return {
        id: r.id,
        source: r.source,
        external_id: r.external_id,
        url: r.url,
        title: r.title,
        summary: r.summary,
        author: r.author,
        image_url: r.image_url,
        published_at: r.published_at ?? r.created_at ?? null,
        tags: r.tags,
        topics: r.topics,
        metadata: { 
          ...(r.metadata ?? {}), 
          _rss_weight: rssWeight,
          ingested_at: r.ingested_at ?? null, // Store ingested_at for age calculation
        }, // Store weight in metadata for scoring
      };
    });

    // Search filter
    if (query) {
      const qq = normalizeKey(query);
      items = items.filter((it) => blob(it).includes(qq));
    }

    // ============================================================
    // Score + sort
    // ============================================================
    // RSS source weight constant: small multiplier (0.2 per weight point)
    // This ensures weight nudges ranking without dominating
    // Weight range: 1-5, so boost range: 0.2 to 1.0
    const RSS_WEIGHT_MULTIPLIER = 0.2;
    
    const scored = items
      .map((it) => {
        // Get RSS source weight (if RSS item)
        const rssWeight = it.source === "rss" ? ((it.metadata as any)?._rss_weight ?? 1) : 0;
        const rssWeightBoost = rssWeight * RSS_WEIGHT_MULTIPLIER;
        
        // For logged-out users, only use recency + default source weight + RSS weight
        if (!userId) {
          const r = recencyScore(it.published_at);
          const s = sourceWeight(it, prefs);
          const score = (r * 1.8) + (s * 0.9) + rssWeightBoost;
          return { ...it, score: Number(score.toFixed(4)) };
        }

        // For logged-in users, use full personalization + RSS weight
        const acts = actionMap.get(it.id) ?? [];
        const acted = actionWeights(acts);
        if (acted <= -5) return { ...it, score: -999 };

        const r = recencyScore(it.published_at);
        const t = topicMatchScore(it, prefs);
        const s = sourceWeight(it, prefs);
        const bpen = blockedPenalty(it, prefs);

        const followMarker = String((it.metadata as any)?.follow_key ?? "");
        const followBoost = followMarker && followKeys.has(followMarker) ? 1.25 : 0;

        const score = (r * 1.8) + (t * 1.2) + (s * 0.9) + acted + followBoost - bpen + rssWeightBoost;
        return { ...it, score: Number(score.toFixed(4)) };
      })
      .filter((x) => (x.score ?? 0) > -100)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);

    // ============================================================
    // Build Fresh (6h) and Today (24h) sections
    // ============================================================
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Helper to get item timestamp (coalesce published_at, ingested_at, created_at)
    function getItemTimestamp(item: FeedItem): string | null {
      return item.published_at ?? (item.metadata as any)?.ingested_at ?? null;
    }

    // Filter items by age
    const freshItems = items.filter((it) => {
      const ts = getItemTimestamp(it);
      if (!ts) return false;
      return ts >= sixHoursAgo;
    })
      .sort((a, b) => {
        const tsA = getItemTimestamp(a) ?? "";
        const tsB = getItemTimestamp(b) ?? "";
        return tsB.localeCompare(tsA);
      })
      .slice(0, 50);

    const todayItems = items.filter((it) => {
      const ts = getItemTimestamp(it);
      if (!ts) return false;
      return ts >= twentyFourHoursAgo;
    })
      .sort((a, b) => {
        const tsA = getItemTimestamp(a) ?? "";
        const tsB = getItemTimestamp(b) ?? "";
        return tsB.localeCompare(tsA);
      })
      .slice(0, 50);

    return jsonResponse(
      {
        feed: scored,
        fresh: freshItems.slice(0, 50),
        today: todayItems.slice(0, 50),
        debug: {
          authed: Boolean(userId),
          days,
          sinceIso,
          limit,
          types,
          query: query ? true : false,
          candidates: items.length,
          returned: scored.length,
          freshCount: freshItems.length,
          todayCount: todayItems.length,
        },
      },
      200,
      req
    );
  } catch (e: any) {
    // Log full error details to console for Supabase logs
    console.error("[social_feed] Unhandled error:", {
      message: e?.message ?? String(e),
      name: e?.name ?? "Unknown",
      stack: e?.stack,
      cause: e?.cause,
    });

    // Always return a proper JSON response with status code
    const errorMessage = e?.message ?? String(e) ?? "Unknown error occurred";
    const errorName = e?.name ?? e?.constructor?.name ?? "Error";

    return jsonResponse(
      {
        feed: [],
        fresh: [],
        today: [],
        error: errorMessage,
        message: `social_feed function error: ${errorMessage}`,
        errorType: errorName,
        debug: {
          authed: false,
          candidates: 0,
          returned: 0,
          error: errorMessage,
          errorType: errorName,
          // Only include stack in development
          stack: import.meta.env.DEV ? e?.stack : undefined,
        },
      },
      500,
      req
    );
  }
});
