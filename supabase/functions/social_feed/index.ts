import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // handy smoke test
  if (req.method === "GET") {
    return jsonResponse({ ok: true, fn: "social_feed" });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonResponse({ error: userErr.message }, 401);
    const user = userData.user;
    if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = typeof body.limit === "number" ? Math.min(Math.max(body.limit, 10), 120) : 60;

    const types: Source[] = Array.isArray(body.types) ? body.types : [];
    const query = cleanText(body.query ?? "");

    const { data: prefRow } = await supabase
      .from("user_preferences")
      .select("prefs")
      .eq("user_id", user.id)
      .maybeSingle();

    const prefs: Prefs = (prefRow?.prefs as Prefs) ?? {
      sources: { youtube: 1.2, reddit: 1.0, rss: 1.0, spotify: 0.9, eventbrite: 0.9, podcast: 0.8 },
      topics: [],
      blocked_topics: [],
      length_pref: "medium",
    };

    const { data: follows } = await supabase
      .from("user_sources")
      .select("source_type, handle, is_enabled")
      .eq("user_id", user.id)
      .eq("is_enabled", true);

    const followKeys = new Set((follows ?? []).map((f) => `${String(f.source_type)}:${String(f.handle)}`));

    const { data: actions } = await supabase
      .from("user_item_actions")
      .select("item_id, action")
      .eq("user_id", user.id);

    const actionMap = new Map<string, string[]>();
    for (const a of actions ?? []) {
      const id = String(a.item_id);
      const arr = actionMap.get(id) ?? [];
      arr.push(String(a.action));
      actionMap.set(id, arr);
    }

    const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString();
    let qx = supabase
      .from("feed_items")
      .select("id,source,external_id,url,title,summary,author,image_url,published_at,tags,topics,metadata")
      .gte("created_at", sinceIso)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(400);

    if (types.length) qx = qx.in("source", types);

    const { data: rows, error: rowsErr } = await qx;
    if (rowsErr) return jsonResponse({ error: rowsErr.message }, 500);

    let items: FeedItem[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      source: r.source,
      external_id: r.external_id,
      url: r.url,
      title: r.title,
      summary: r.summary,
      author: r.author,
      image_url: r.image_url,
      published_at: r.published_at,
      tags: r.tags,
      topics: r.topics,
      metadata: r.metadata ?? {},
    }));

    if (query) {
      const qq = normalizeKey(query);
      items = items.filter((it) => blob(it).includes(qq));
    }

    const scored = items
      .map((it) => {
        const acts = actionMap.get(it.id) ?? [];
        const acted = actionWeights(acts);
        if (acted <= -5) return { ...it, score: -999 };

        const r = recencyScore(it.published_at);
        const t = topicMatchScore(it, prefs);
        const s = sourceWeight(it, prefs);
        const bpen = blockedPenalty(it, prefs);

        const followMarker = String((it.metadata as any)?.follow_key ?? "");
        const followBoost = followMarker && followKeys.has(followMarker) ? 1.25 : 0;

        const score = (r * 1.8) + (t * 1.2) + (s * 0.9) + acted + followBoost - bpen;
        return { ...it, score: Number(score.toFixed(4)) };
      })
      .filter((x) => (x.score ?? 0) > -100)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);

    return jsonResponse({
      feed: scored,
      debug: {
        limit,
        types,
        query: query ? true : false,
        candidates: items.length,
        returned: scored.length,
      },
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? String(e) }, 500);
  }
});

