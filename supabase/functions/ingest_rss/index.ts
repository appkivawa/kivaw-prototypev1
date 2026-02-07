// supabase/functions/ingest_rss/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";

// --------------------
// CORS
// --------------------
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-ingest-secret, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --------------------
// Helpers
// --------------------
function cleanText(s?: string | null | any) {
  if (s == null) return "";
  if (typeof s !== "string") {
    if (typeof s === "object") {
      if (Array.isArray(s)) {
        return s
          .map((item) => cleanText(item))
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      }
      return cleanText(s["#text"] ?? s.text ?? s.value ?? JSON.stringify(s));
    }
    return String(s).replace(/\s+/g, " ").trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

function toIsoDate(v: any): string | null {
  const s = cleanText(String(v ?? ""));
  if (!s) return null;
  const t = new Date(s).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function pickFirst<T>(v: T | T[] | undefined | null): T | null {
  if (Array.isArray(v)) return (v[0] ?? null) as T | null;
  return (v ?? null) as T | null;
}

function extractImage(item: any): string | null {
  const mediaThumb =
    item?.["media:thumbnail"]?.["@_url"] ?? item?.["media:thumbnail"]?.url;
  const mediaContent =
    item?.["media:content"]?.["@_url"] ?? item?.["media:content"]?.url;
  const enclosure = item?.enclosure?.["@_url"] ?? item?.enclosure?.url;

  const img =
    cleanText(mediaThumb) ||
    cleanText(mediaContent) ||
    cleanText(enclosure) ||
    null;

  if (!img) return null;
  if (!/^https?:\/\//i.test(img)) return null;
  return img;
}

function stripHtml(html?: string | null): string {
  const s = String(html ?? "");
  return cleanText(s.replace(/<[^>]*>/g, " "));
}

// Normalize feed URLs so we don't treat the same feed as multiple sources
// (e.g. trailing slash differences, host casing, default ports).
function normalizeFeedUrl(input: string): string {
  const trimmed = cleanText(input);
  if (!trimmed) return "";

  try {
    const u = new URL(trimmed);

    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();

    // remove default ports
    if (
      (u.protocol === "https:" && u.port === "443") ||
      (u.protocol === "http:" && u.port === "80")
    ) {
      u.port = "";
    }

    // remove trailing slash (not root)
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    // If URL parsing fails, fall back to trimmed string.
    return trimmed;
  }
}

function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag || typeof tag !== "string") return null;
  let normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  normalized = normalized.replace(/[\s_]+/g, "-");
  normalized = normalized.replace(/[^a-z0-9\-\.]/g, "");
  normalized = normalized.replace(/^[\-\.]+|[\-\.]+$/g, "");
  if (normalized.length < 2 || normalized.length > 50) return null;
  return normalized;
}

function normalizeTags(tags: (string | null | undefined)[]): string[] {
  const normalized = tags
    .map(normalizeTag)
    .filter((t): t is string => t !== null);
  return Array.from(new Set(normalized));
}

function extractKeywordsFromText(
  text: string | null | undefined,
  maxKeywords = 5
): string[] {
  if (!text || typeof text !== "string") return [];
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "every",
    "some",
    "any",
    "no",
    "not",
    "only",
    "just",
    "more",
    "most",
    "very",
    "too",
    "so",
    "than",
    "then",
    "there",
    "here",
    "up",
    "down",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "once",
    "twice",
  ]);
  const words = clean
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);

  const sorted = Array.from(freq.entries())
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return normalizeTags(sorted);
}

// Stable hash for dedupe keys
async function sha1(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Per-feed fetch timeout so one bad feed doesn't hang the run
async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// --------------------
// Auth gate
// --------------------
function isLocalDev(req: Request): boolean {
  // Request URL (Kong may rewrite this internally, so not always reliable)
  try {
    const u = new URL(req.url);
    const host = (u.hostname ?? "").toLowerCase();
    if (host === "127.0.0.1" || host === "localhost") return true;
  } catch {
    // ignore
  }
  // Host header (when curling 127.0.0.1:54321; Kong may rewrite this when forwarding)
  const hostHeader = (req.headers.get("Host") ?? "").toLowerCase();
  if (hostHeader.startsWith("127.0.0.1") || hostHeader.startsWith("localhost"))
    return true;
  // X-Forwarded-Host (Kong often preserves original client host here)
  const forwardedHost = (req.headers.get("X-Forwarded-Host") ?? "")
    .toLowerCase()
    .split(",")[0]
    .trim();
  if (forwardedHost.startsWith("127.0.0.1") || forwardedHost.startsWith("localhost"))
    return true;
  // SUPABASE_URL in local dev (may be set to gateway URL)
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  if (
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost") ||
    (supabaseUrl.includes("http://") && supabaseUrl.includes(":54321"))
  )
    return true;
  // Explicit local override: set LOCAL_DEV=1 in supabase/functions/.env (see .env.example)
  if (Deno.env.get("LOCAL_DEV") === "1") return true;
  return false;
}

async function authorize(req: Request, authClient: ReturnType<typeof createClient>) {
  // ✅ LOCAL DEV BYPASS: no JWT/secret required when request is to localhost (Supabase local).
  if (isLocalDev(req)) {
    console.log("[ingest_rss] local dev auth bypass (request to localhost/127.0.0.1)");
    return { ok: true as const, mode: "local" as const, userId: null as string | null };
  }

  // Secret mode (cron/curl)
  const ingestSecret = (Deno.env.get("INGEST_SECRET") ?? "").trim();
  const gotSecret = (req.headers.get("x-ingest-secret") ?? "").trim();

  if (ingestSecret && gotSecret && gotSecret === ingestSecret) {
    return { ok: true as const, mode: "secret" as const, userId: null as string | null };
  }

  // JWT admin mode
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false as const, status: 401, error: "Missing Authorization Bearer token" };
  }

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Invalid session token",
      details: userErr?.message,
    };
  }

  const userId = userData.user.id;

  const { data: isAdmin, error: adminErr } = await authClient.rpc("is_admin", { check_uid: userId });
  if (adminErr) {
    return { ok: false as const, status: 500, error: "Admin check failed", details: adminErr.message };
  }
  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Forbidden: admin only" };
  }

  return { ok: true as const, mode: "jwt" as const, userId };
}

// --------------------
// Main
// --------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return json(200, { ok: true, fn: "ingest_rss" });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const startedAll = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const userAuthHeader = req.headers.get("Authorization") || "";

    const authClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
      global: userAuthHeader ? { headers: { Authorization: userAuthHeader } } : undefined,
    });

    const dbClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const authz = await authorize(req, authClient);
    if (!authz.ok) return json(authz.status, authz);

    const body = await req.json().catch(() => ({}));

    const maxFeeds =
      typeof body.maxFeeds === "number" ? Math.min(Math.max(body.maxFeeds, 1), 50) : 25;

    const perFeedLimit =
      typeof body.perFeedLimit === "number"
        ? Math.min(Math.max(body.perFeedLimit, 100), 200)
        : 100;

    // Load feeds
    let feeds: string[] = [];

    if (Array.isArray(body.urls) && body.urls.length > 0) {
      feeds = body.urls
        .map((url: any) => normalizeFeedUrl(cleanText(String(url ?? ""))))
        .filter((url: string) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        })
        .slice(0, maxFeeds);
    } else {
      const allUrls = new Set<string>();

      let sourcesQuery = dbClient
        .from("sources")
        .select("url, is_active")
        .eq("type", "rss")
        .eq("enabled", true);

      if (body.user_id) sourcesQuery = sourcesQuery.eq("user_id", body.user_id);

      const { data: sourcesData } = await sourcesQuery;
      if (sourcesData?.length) {
        const activeSources = sourcesData.filter((s: any) => {
          if (!("is_active" in s)) return true;
          return s.is_active !== false;
        });

        for (const s of activeSources) {
          const url = normalizeFeedUrl(cleanText(String(s.url ?? "")));
          if (!url) continue;
          try {
            new URL(url);
            allUrls.add(url);
          } catch {
            // ignore
          }
        }
      }

      const { data: defaultSources } = await dbClient
        .from("rss_sources")
        .select("url")
        .eq("active", true)
        .order("weight", { ascending: false })
        .limit(maxFeeds * 2);

      if (defaultSources?.length) {
        for (const s of defaultSources) {
          const url = normalizeFeedUrl(cleanText(String(s.url ?? "")));
          if (!url) continue;
          try {
            new URL(url);
            allUrls.add(url);
          } catch {
            // ignore
          }
        }
      }

      feeds = Array.from(allUrls)
        .filter((url: string) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        })
        .slice(0, maxFeeds);
    }

    if (!feeds.length) {
      return json(200, {
        ok: true,
        ingested: 0,
        feeds: 0,
        note: body.urls
          ? "No valid URLs provided in request body."
          : "No active RSS sources found in sources or rss_sources tables.",
        auth: { mode: authz.mode, userId: authz.userId },
      });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name) => name === "item" || name === "entry",
    });

    const SOURCE_TYPE = "rss";
    let totalUpserted = 0;
    const feedResults: any[] = [];

    for (const feedUrlRaw of feeds) {
      const feedUrl = normalizeFeedUrl(feedUrlRaw);
      if (!feedUrl) continue;

      const started = Date.now();
      let fetched = 0;
      let upserted = 0;

      try {
        const res = await fetchWithTimeout(feedUrl, 15000); // 15s per feed
        if (!res.ok) {
          feedResults.push({ feedUrl, ok: false, error: `Fetch failed: ${res.status} ${res.statusText}` });
          continue;
        }

        const xml = await res.text();
        const parsed = parser.parse(xml);

        const rssItems = parsed?.rss?.channel?.item ?? [];
        const atomEntries = parsed?.feed?.entry ?? [];

        const items = Array.isArray(rssItems) ? rssItems : [];
        const entries = Array.isArray(atomEntries) ? atomEntries : [];

        const unified = [
          ...items.map((it: any) => ({ kind: "rss", it })),
          ...entries.map((it: any) => ({ kind: "atom", it })),
        ].slice(0, perFeedLimit);

        fetched = unified.length;

        // Build "pre-rows" first (no hashing yet)
        const preRows = unified.map((u: any) => {
          const it = u.it;

          const title = cleanText(pickFirst(it.title)) || "Untitled";

          const link =
            u.kind === "atom"
              ? cleanText(pickFirst(it.link?.["@_href"] ?? it.link?.href ?? it.link))
              : cleanText(pickFirst(it.link));

          const guid = cleanText(pickFirst(it.guid?.["#text"] ?? it.guid));
          const atomId = cleanText(pickFirst(it.id));
          const rawExternal = guid || atomId || link || `${feedUrl}:${title}`;

          const author =
            u.kind === "atom"
              ? cleanText(pickFirst(it.author?.name ?? it.author))
              : cleanText(pickFirst(it["dc:creator"] ?? it.author));

          const published = toIsoDate(it.pubDate ?? it.published ?? it.updated ?? it["dc:date"]) ?? null;

          const ingestedAt = new Date().toISOString();

          const summaryRaw =
            it["content:encoded"] ?? it.content ?? it.summary ?? it.description ?? null;

          const summary = stripHtml(summaryRaw);
          const imageUrl = extractImage(it);

          const categoryTags: string[] = [];
          const rssCategories = Array.isArray(it.category)
            ? it.category
            : it.category
              ? [it.category]
              : [];

          for (const cat of rssCategories) {
            const catText = cleanText(
              typeof cat === "string" ? cat : (cat?.["#text"] ?? cat?.term ?? String(cat))
            );
            if (catText) categoryTags.push(catText);
          }

          let derivedTags = normalizeTags(categoryTags);
          if (derivedTags.length < 3) {
            const text = [title, summary].filter(Boolean).join(" ");
            const keywords = extractKeywordsFromText(text, 5);
            derivedTags = Array.from(new Set([...derivedTags, ...keywords])).slice(0, 10);
          }
          if (derivedTags.length === 0) derivedTags = ["rss"];

          let score = 1.0;
          if (imageUrl) score += 0.3;
          if (summary && summary.length > 50) score += 0.2;
          if (author) score += 0.1;
          if (published) score += 0.2;
          if (derivedTags.length > 0) score += 0.2;

          return {
            feedUrl,
            rawExternal,
            url: link || feedUrl,
            title,
            summary: summary ? summary.slice(0, 1200) : null,
            author: author || null,
            image_url: imageUrl || null,
            published_at: published,
            ingested_at: ingestedAt,
            tags: derivedTags,
            is_discoverable: true,
            score,
          };
        });

        // Batch hash creation (fast + avoids sequential await)
        const rows = await Promise.all(
          preRows.map(async (p) => {
            const source_item_id = await sha1(`${SOURCE_TYPE}:${p.feedUrl}:${p.rawExternal}`);

            return {
              source_type: SOURCE_TYPE,
              source_item_id,

              // Keep external_id globally unique (you have unique indexes on external_id)
              external_id: source_item_id,

              url: p.url,
              title: p.title,
              summary: p.summary,
              author: p.author,
              image_url: p.image_url,
              published_at: p.published_at,
              ingested_at: p.ingested_at,
              tags: p.tags,
              is_discoverable: p.is_discoverable,
              score: p.score,
              metadata: {
                feed_url: p.feedUrl,
                raw_id: p.rawExternal,
              },
            };
          })
        );

        // Deduplicate within batch by (source_type, source_item_id)
        const dedupeMap = new Map<string, any>();
        for (const row of rows) {
          const key = `${row.source_type}:${row.source_item_id}`;
          if (!dedupeMap.has(key)) dedupeMap.set(key, row);
        }
        const uniqueRows = Array.from(dedupeMap.values());

        const { data: upData, error: upErr } = await dbClient
          .from("feed_items")
          .upsert(uniqueRows, { onConflict: "source_type,source_item_id" })
          .select("id");

        if (upErr) {
          feedResults.push({ feedUrl, ok: false, error: upErr.message, fetched, ms: Date.now() - started });
          continue;
        }

        upserted = upData?.length ?? 0;
        totalUpserted += upserted;

        feedResults.push({ feedUrl, ok: true, fetched, upserted, ms: Date.now() - started });
      } catch (e: any) {
        const msg =
          e?.name === "AbortError" ? "Fetch timed out" : (e?.message ?? String(e));
        feedResults.push({ feedUrl, ok: false, error: msg, fetched, ms: Date.now() - started });
      }
    }

    const result = {
      ok: true,
      feeds: feeds.length,
      ingested: totalUpserted,
      results: feedResults,
      duration_ms: Date.now() - startedAll,
      auth: { mode: authz.mode, userId: authz.userId },
    };

    // Best-effort job_runs logging (dbClient bypasses RLS)
    try {
      const successfulFeeds = feedResults.filter((r) => r.ok).length;
      const failedFeeds = feedResults.filter((r) => !r.ok).length;
      const summaryMessage = `ingested=${totalUpserted} feeds=${feeds.length} successful=${successfulFeeds} failed=${failedFeeds}`;

      await dbClient
        .from("job_runs")
        .upsert(
          {
            job_name: "rss_ingest",
            last_run_at: new Date().toISOString(),
            status: "success",
            error_message: summaryMessage,
            result_summary: result,
          },
          { onConflict: "job_name" }
        );
    } catch (logErr) {
      console.error("[ingest_rss] job_runs logging error:", logErr);
    }

    return json(200, result);
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
















