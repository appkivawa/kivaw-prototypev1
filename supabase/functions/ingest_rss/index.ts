// supabase/functions/ingest_rss/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";
import { logHealthEvent } from "../_shared/logHealthEvent.ts";
import { logIngestionRun } from "../_shared/logIngestionRun.ts";

// --------------------
// CORS
// --------------------
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function json(body: unknown, status = 200) {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// --------------------
// Helpers
// --------------------
function decodeHtmlEntities(input: string): string {
  let s = input;

  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });

  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
  };
  for (const k of Object.keys(map)) s = s.split(k).join(map[k]);

  // common mojibake
  s = s
    .split("â€™").join("’")
    .split("â€œ").join("“")
    .split("â€�").join("”")
    .split("â€“").join("–")
    .split("â€”").join("—")
    .split("â€¦").join("…");

  // common "Â" junk
  s = s.replace(/\u00c2/g, "");

  return s;
}

function stripHtml(html?: string | null): string {
  const s = String(html ?? "");
  return s.replace(/<[^>]*>/g, " ");
}

function normalizeText(v: any): string {
  if (v == null) return "";
  if (typeof v !== "string") {
    if (typeof v === "object") {
      if (Array.isArray(v)) return v.map(normalizeText).filter(Boolean).join(" ").trim();
      return normalizeText(v["#text"] ?? v.text ?? v.value ?? JSON.stringify(v));
    }
    return String(v);
  }

  let s = v;
  s = decodeHtmlEntities(s);
  s = stripHtml(s);

  // strip control chars
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // strip zero-width + bidi marks (these cause “invisible garbage”)
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function pickFirst<T>(v: T | T[] | undefined | null): T | null {
  if (Array.isArray(v)) return (v[0] ?? null) as T | null;
  return (v ?? null) as T | null;
}

// Strict date parsing: returns ISO string and milliseconds, or null if invalid
function parsePublishedDate(v: any): { iso: string; ms: number } | null {
  const s = normalizeText(String(v ?? ""));
  if (!s) return null;
  
  const date = new Date(s);
  const ms = date.getTime();
  
  // Validate: must be a valid date and not invalid (NaN)
  if (!Number.isFinite(ms)) return null;
  
  // Validate: date must be reasonable (not too far in past/future)
  // Reject dates before 1970 or more than 1 year in the future
  const now = Date.now();
  const oneYearFromNow = now + 365 * 24 * 60 * 60 * 1000;
  if (ms < 0 || ms > oneYearFromNow) return null;
  
  return { iso: date.toISOString(), ms };
}

function looksLikeImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (!/^https?:\/\//i.test(u)) return false;
  if (u.includes("doubleclick") || u.includes("adservice")) return false;
  if (u.includes("pixel") || u.includes("1x1")) return false;

  if (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|#|$)/i.test(u)) return true;

  if (u.includes("image") || u.includes("img") || u.includes("thumb") || u.includes("thumbnail")) return true;

  return false;
}

function extractImageIfValid(item: any): string | null {
  const candidates: any[] = [];

  candidates.push(item?.["media:thumbnail"]?.["@_url"]);
  candidates.push(item?.["media:thumbnail"]?.url);
  candidates.push(item?.["media:content"]?.["@_url"]);
  candidates.push(item?.["media:content"]?.url);

  candidates.push(item?.enclosure?.["@_url"]);
  candidates.push(item?.enclosure?.url);

  candidates.push(item?.["itunes:image"]?.["@_href"]);
  candidates.push(item?.image?.url);

  for (const c of candidates) {
    const u = normalizeText(c);
    if (u && looksLikeImageUrl(u)) return u;
  }
  return null;
}

function hostFromUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "rss";
  }
}

// Extract meta description from HTML
async function fetchArticleDescription(url: string, timeoutMs = 4000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "KivawRSSBot/1.0 (+https://kivaw.com)",
        "Accept": "text/html",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    
    // Extract og:description
    const ogMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      return normalizeText(ogMatch[1]).slice(0, 400);
    }

    // Extract meta name="description"
    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaMatch && metaMatch[1]) {
      return normalizeText(metaMatch[1]).slice(0, 400);
    }

    return null;
  } catch (e) {
    // Timeout or network error - fail silently
    return null;
  }
}

// RSS freshness threshold: 7 days (configurable)
const MAX_AGE_DAYS = 7;

// --------------------
// Main
// --------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const startTime = Date.now();
  const startedAtISO = new Date().toISOString();
  let supabase: ReturnType<typeof createClient> | null = null;
  let runId: string | null = null;

  try {
    if (req.method === "GET") {
      return json({ ok: true, fn: "ingest_rss", version: "2026-01-26-explicit-content_kind-provider" });
    }

    // Initialize supabase early for error logging
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }
    supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Log start of ingestion run
    await logIngestionRun(supabase, {
      jobName: "ingest_rss",
      status: "running",
      startedAt: startedAtISO,
    });

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Check CRON_SECRET if set (for internal cron calls)
    const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim();
    if (CRON_SECRET) {
      const got = (req.headers.get("x-cron-secret") ?? "").trim();
      if (got !== CRON_SECRET) {
        // Allow service role key as fallback (for direct calls)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.includes("Bearer")) {
          return json({ error: "Forbidden: Missing or invalid x-cron-secret" }, 403);
        }
      }
    }

    const INGEST_SECRET = (Deno.env.get("INGEST_SECRET") ?? "").trim();
    if (INGEST_SECRET) {
      const got = (req.headers.get("x-ingest-secret") ?? "").trim();
      if (got !== INGEST_SECRET) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const maxFeeds =
      typeof body.maxFeeds === "number" ? Math.min(Math.max(body.maxFeeds, 1), 50) : 25;
    const perFeedLimit =
      typeof body.perFeedLimit === "number" ? Math.min(Math.max(body.perFeedLimit, 25), 200) : 100;

    // Pull feeds
    const allUrls = new Set<string>();

    const { data: sourcesData } = await supabase
      .from("sources")
      .select("url, is_active")
      .eq("type", "rss")
      .eq("enabled", true);

    if (sourcesData?.length) {
      const activeSources = sourcesData.filter((s: any) => !("is_active" in s) || s.is_active !== false);
      for (const s of activeSources) {
        const url = normalizeText(String(s.url ?? ""));
        if (!url) continue;
        try {
          new URL(url);
          allUrls.add(url);
        } catch {
          /* skip */
        }
      }
    }

    const { data: defaultSources } = await supabase
      .from("rss_sources")
      .select("url")
      .eq("active", true)
      .order("weight", { ascending: false })
      .limit(maxFeeds * 2);

    if (defaultSources?.length) {
      for (const s of defaultSources) {
        const url = normalizeText(String(s.url ?? ""));
        if (!url) continue;
        try {
          new URL(url);
          allUrls.add(url);
        } catch {
          /* skip */
        }
      }
    }

    const feeds = Array.from(allUrls).slice(0, maxFeeds);

    if (!feeds.length) {
      return json({ ok: true, feeds: 0, ingested: 0, note: "No active RSS sources found." });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name) => name === "item" || name === "entry",
    });

    let totalUpserted = 0;
    const feedResults: any[] = [];

    for (const feedUrl of feeds) {
      const started = Date.now();
      const provider = hostFromUrl(feedUrl);

      let fetched = 0;
      let upserted = 0;

      try {
        const res = await fetch(feedUrl, {
          headers: {
            "User-Agent": "KivawRSSBot/1.0 (+https://kivaw.com)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
          },
        });

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

        // Parse all items and extract publish dates with strict validation
        const allItems = [
          ...items.map((it: any) => ({ kind: "rss", it })),
          ...entries.map((it: any) => ({ kind: "atom", it })),
        ];

        // Compute cutoff: last 7 days (86400_000 ms per day)
        const cutoffMs = Date.now() - MAX_AGE_DAYS * 86400_000;

        // Parse dates strictly - skip items with missing/invalid dates
        const itemsWithDates = allItems
          .map((u) => {
            const it = u.it;
            // Try multiple date fields in order of preference
            const dateFields = [
              it.pubDate,
              it.published,
              it.updated,
              it["dc:date"],
            ];
            
            let parsed: { iso: string; ms: number } | null = null;
            for (const field of dateFields) {
              parsed = parsePublishedDate(field);
              if (parsed) break;
            }
            
            // SKIP items with missing/invalid dates (no fallback to now())
            if (!parsed) return null;
            
            return {
              ...u,
              publishedISO: parsed.iso,
              publishedMs: parsed.ms,
            };
          })
          .filter((u): u is NonNullable<typeof u> => u !== null)
          // Filter to fresh items only (within last 7 days)
          .filter((u) => u.publishedMs >= cutoffMs)
          // Sort by published date DESC (newest first)
          .sort((a, b) => b.publishedMs - a.publishedMs)
          // Then take limit
          .slice(0, perFeedLimit);

        fetched = allItems.length; // Total fetched from feed
        const fresh = itemsWithDates.length; // Items that passed freshness filter

        const rows: any[] = [];
        let newestPublishedAt: string | null = null;
        let oldestPublishedAt: string | null = null;
        
        for (const u of itemsWithDates) {
          const it = u.it;

          const title = normalizeText(pickFirst(it.title)) || "Untitled";

          const link =
            u.kind === "atom"
              ? normalizeText(pickFirst(it.link?.["@_href"] ?? it.link?.href ?? it.link))
              : normalizeText(pickFirst(it.link));

          const guid = normalizeText(pickFirst(it.guid?.["#text"] ?? it.guid));
          const atomId = normalizeText(pickFirst(it.id));
          const externalId = guid || atomId || link || `${feedUrl}:${title}`;

          const author =
            u.kind === "atom"
              ? normalizeText(pickFirst(it.author?.name ?? it.author))
              : normalizeText(pickFirst(it["dc:creator"] ?? it.author));

          // Use parsed ISO date (strictly validated)
          const publishedISO = u.publishedISO;
          const ingestedAt = new Date().toISOString();

          // Track newest/oldest for verification
          if (!newestPublishedAt || publishedISO > newestPublishedAt) {
            newestPublishedAt = publishedISO;
          }
          if (!oldestPublishedAt || publishedISO < oldestPublishedAt) {
            oldestPublishedAt = publishedISO;
          }

          let summaryRaw = it["content:encoded"] ?? it.content ?? it.summary ?? it.description ?? null;
          let summary = normalizeText(summaryRaw);

          // If summary is missing or too short (< 40 chars), try to fetch from article page
          // Only run enrichment after freshness filter passes (avoid heavy scraping)
          if ((!summary || summary.length < 40) && link) {
            try {
              const fetchedDesc = await fetchArticleDescription(link);
              if (fetchedDesc && fetchedDesc.length >= 40) {
                summary = fetchedDesc;
              }
            } catch (e) {
              // Fail silently - use existing summary or null
            }
          }

          const imageUrl = extractImageIfValid(it);

          rows.push({
            // ✅ explicit, no triggers needed
            content_kind: "rss",
            provider, // hostname(feedUrl) with www. stripped
            source: "rss",

            external_id: externalId,
            url: link || feedUrl,
            title,
            summary: summary ? summary.slice(0, 1200) : null,
            author: author || null,
            image_url: imageUrl || null,
            published_at: publishedISO, // Store parsed ISO date
            ingested_at: ingestedAt,
            tags: ["rss"],
            topics: null,
            is_discoverable: true,

            // baseline, the explore scoring can boost later
            score: 1.0,

            metadata: { feed_url: feedUrl, follow_key: `rss:${feedUrl}`, raw_id: externalId },
          });
        }

        if (!rows.length) {
          feedResults.push({
            feedUrl,
            ok: true,
            counts: { fetched, fresh: 0, upserted: 0 },
            newestPublishedAt: null,
            oldestPublishedAt: null,
            ms: Date.now() - started,
          });
          continue;
        }

        const dedupe = new Map<string, any>();
        for (const r of rows) {
          const key = `${r.source}:${r.external_id}`;
          if (!dedupe.has(key)) dedupe.set(key, r);
        }
        const uniqueRows = Array.from(dedupe.values());

        const { data: upData, error: upErr } = await supabase
          .from("feed_items")
          .upsert(uniqueRows, { onConflict: "source,external_id" })
          .select("id");

        if (upErr) {
          feedResults.push({
            feedUrl,
            ok: false,
            error: upErr.message,
            counts: { fetched, fresh, upserted: 0 },
            ms: Date.now() - started,
          });
          continue;
        }

        upserted = upData?.length ?? 0;
        totalUpserted += upserted;

        feedResults.push({
          feedUrl,
          ok: true,
          counts: { fetched, fresh, upserted },
          newestPublishedAt,
          oldestPublishedAt,
          ms: Date.now() - started,
        });
      } catch (e: any) {
        feedResults.push({
          feedUrl,
          ok: false,
          error: e?.message ?? String(e),
          counts: { fetched: fetched || 0, fresh: 0, upserted: 0 },
          ms: Date.now() - started,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const finishedAtISO = new Date().toISOString();
    
    // Calculate totals from feedResults
    const totalFetched = feedResults.reduce((sum, r) => sum + (r.counts?.fetched || 0), 0);
    const totalSkipped = feedResults.reduce((sum, r) => sum + (r.counts?.fetched || 0) - (r.counts?.upserted || 0), 0);
    
    const result = { ok: true, feeds: feeds.length, ingested: totalUpserted, results: feedResults };
    
    // Log ingestion run (success)
    await logIngestionRun(supabase, {
      jobName: "ingest_rss",
      status: "ok",
      startedAt: startedAtISO,
      finishedAt: finishedAtISO,
      durationMs,
      feedsProcessed: feeds.length,
      itemsFetched: totalFetched,
      itemsUpserted: totalUpserted,
      itemsSkipped: totalSkipped,
      metadata: {
        feedResults: feedResults.length,
        results: feedResults,
      },
    });
    
    // Also log health event (for backward compatibility)
    await logHealthEvent(supabase, {
      jobName: "ingest_rss",
      status: "ok",
      durationMs,
      metadata: {
        feeds: feeds.length,
        ingested: totalUpserted,
        results: feedResults.length,
      },
    });
    
    return json(result);
  } catch (e: any) {
    const durationMs = Date.now() - startTime;
    const finishedAtISO = new Date().toISOString();
    const errorMsg = e?.message ?? String(e);
    
    // Log ingestion run (failure)
    if (supabase) {
      await logIngestionRun(supabase, {
        jobName: "ingest_rss",
        status: "fail",
        startedAt: startedAtISO,
        finishedAt: finishedAtISO,
        durationMs,
        errorMessage: errorMsg,
        metadata: {
          error: errorMsg,
          stack: e?.stack,
        },
      });
      
      // Also log health event (for backward compatibility)
      await logHealthEvent(supabase, {
        jobName: "ingest_rss",
        status: "fail",
        durationMs,
        errorMessage: errorMsg,
      });
    }
    
    return json({ error: errorMsg }, 500);
  }
});



