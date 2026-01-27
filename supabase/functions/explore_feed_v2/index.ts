import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

export interface UnifiedContentItem {
  id: string;
  kind: string;
  title: string;
  byline: string | null;
  image_url: string | null;
  summary: string | null;
  url: string | null;
  provider: string;
  external_id: string | null;
  tags: string[];
  created_at: string;
  raw: Record<string, unknown> | null;
  score: number | null;
}

export interface ExploreFeedV2Request {
  limit?: number;
  cursor?: string; // base64 offset
  kinds?: string[];
  providers?: string[];
  includeRecommendations?: boolean; // default false
}

export interface ExploreFeedV2Response {
  items: UnifiedContentItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const decoded = atob(cursor);
    const offset = parseInt(decoded, 10);
    return Number.isFinite(offset) ? Math.max(0, offset) : 0;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number): string {
  return btoa(String(offset));
}

// deterministic RNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// stable daily seed (UTC day)
function daySeed(): number {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return (y * 10000 + m * 100 + day) ^ 0x9e3779b9;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// round-robin mix buckets: watch/read/rss/other
function mixBuckets(items: UnifiedContentItem[], seed: number): UnifiedContentItem[] {
  const watch: UnifiedContentItem[] = [];
  const read: UnifiedContentItem[] = [];
  const rss: UnifiedContentItem[] = [];
  const other: UnifiedContentItem[] = [];

  for (const it of items) {
    const k = (it.kind || "").toLowerCase();
    if (k === "watch") watch.push(it);
    else if (k === "read") read.push(it);
    else if (k === "rss" || k === "atom" || k === "article" || k === "news") rss.push(it);
    else other.push(it);
  }

  const w = seededShuffle(watch, seed ^ 1);
  const r = seededShuffle(read, seed ^ 2);
  const s = seededShuffle(rss, seed ^ 3);
  const o = seededShuffle(other, seed ^ 4);

  const out: UnifiedContentItem[] = [];
  let i = 0;

  while (w.length || r.length || s.length || o.length) {
    if (w.length) out.push(w.shift()!);
    if (r.length) out.push(r.shift()!);
    if (s.length) out.push(s.shift()!);
    if (o.length) out.push(o.shift()!);

    if (++i > 5000) break;
  }

  return out;
}

// Generate correlation ID for request tracking
function generateCorrelationId(): string {
  return `explore_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Structured logging helper
function log(level: "info" | "warn" | "error", correlationId: string, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    fn: "explore_feed_v2",
    correlationId,
    message,
    ...meta,
  };
  console.log(JSON.stringify(logEntry));
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  if (req.method === "GET") {
    return jsonResponse({ ok: true, fn: "explore_feed_v2", version: "2.1.0-mixed-daily-shuffle" });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      log("error", correlationId, "Missing environment variables", { missing: !SUPABASE_URL ? "SUPABASE_URL" : "SUPABASE_ANON_KEY" });
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const apikeyHeader = SUPABASE_ANON_KEY;

    // Extract user ID from JWT if present
    let userId: string | null = null;
    if (authHeader) {
      try {
        const jwt = authHeader.replace("Bearer ", "");
        const parts = jwt.split(".");
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          userId = payload?.sub || null;
        }
      } catch {
        // JWT parsing failed, continue as anonymous
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          apikey: apikeyHeader,
        },
      },
    });

    let body: ExploreFeedV2Request = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch {
      body = {};
    }

    log("info", correlationId, "Request received", {
      userId: userId || "anonymous",
      limit: body.limit,
      kinds: body.kinds,
      providers: body.providers,
      includeRecommendations: body.includeRecommendations,
    });

    const limit = typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 50) : 20;
    const offset = decodeCursor(body.cursor);

    const kinds =
      Array.isArray(body.kinds) && body.kinds.length
        ? body.kinds.filter((k): k is string => typeof k === "string")
        : undefined;

    const providers =
      Array.isArray(body.providers) && body.providers.length
        ? body.providers.filter((p): p is string => typeof p === "string")
        : undefined;

    const includeRecommendations = body.includeRecommendations === true; // default false
    const POOL_SIZE = 500;

    let query = supabase
      .from("explore_items_v2")
      .select("id, kind, provider, external_id, url, title, byline, image_url, summary, tags, created_at, raw, score");

    if (kinds?.length) query = query.in("kind", kinds);
    if (providers?.length) query = query.in("provider", providers);

    // ✅ Filter recommendations at query-time (prevents wasting pool then filtering)
    if (!includeRecommendations) {
      query = query.not("id", "like", "recommendation:%");
    }

    query = query
      .order("score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(0, POOL_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      log("error", correlationId, "Database query failed", {
        userId: userId || "anonymous",
        error: error.message,
        code: error.code,
      });
      return jsonResponse({ error: "Failed to fetch explore items", detail: error.message }, 500);
    }

    const poolSize = (data ?? []).length;
    log("info", correlationId, "Query successful", {
      userId: userId || "anonymous",
      poolSize,
    });

    const items: UnifiedContentItem[] = (data ?? []).map((row: any) => ({
      id: String(row.id || ""),
      kind: String(row.kind || ""),
      title: String(row.title || ""),
      byline: row.byline ? String(row.byline) : null,
      image_url: row.image_url ? String(row.image_url) : null,
      summary: row.summary ? String(row.summary) : null,
      url: row.url ? String(row.url) : null,
      provider: String(row.provider || ""),
      external_id: row.external_id ? String(row.external_id) : null,
      tags: Array.isArray(row.tags) ? row.tags.map((t: any) => String(t)) : [],
      created_at: String(row.created_at || ""),
      raw: row.raw && typeof row.raw === "object" ? row.raw : null,
      score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
    }));

    const seed = daySeed();
    const mixed = mixBuckets(items, seed);

    const page = mixed.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    const hasMore = nextOffset < mixed.length;
    const nextCursor = hasMore ? encodeCursor(nextOffset) : null;

    const resp: ExploreFeedV2Response = {
      items: page,
      nextCursor,
      hasMore,
    };

    const duration = Date.now() - startTime;
    log("info", correlationId, "Request completed", {
      userId: userId || "anonymous",
      itemCount: page.length,
      hasMore,
      durationMs: duration,
    });

    return jsonResponse(resp);
  } catch (e: any) {
    const duration = Date.now() - startTime;
    log("error", correlationId, "Unhandled exception", {
      userId: userId || "anonymous",
      error: e?.message || String(e),
      stack: e?.stack,
      durationMs: duration,
    });
    return jsonResponse({ error: "Internal server error", detail: e?.message || String(e) }, 500);
  }
});






