import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";

// --------------------
// CORS
// --------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "x-client-info, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  return null;
}

function json(body: unknown, status = 200) {
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
    // If it's an object or array, try to extract text or stringify
    if (typeof s === "object") {
      if (Array.isArray(s)) {
        return s.map((item) => cleanText(item)).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      }
      // Try common text fields
      return cleanText(s["#text"] ?? s.text ?? s.value ?? JSON.stringify(s));
    }
    return String(s).replace(/\s+/g, " ").trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

// Stable hash for source_item_id
async function sha1(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toIsoDate(v: any): string | null {
  const s = cleanText(String(v ?? ""));
  if (!s) return null;

  // Common RSS/Atom date formats generally parse via Date()
  const t = new Date(s).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function pickFirst<T>(v: T | T[] | undefined | null): T | null {
  if (Array.isArray(v)) return (v[0] ?? null) as T | null;
  return (v ?? null) as T | null;
}

// Try common media image fields (RSS + Atom variants)
function extractImage(item: any): string | null {
  const mediaThumb = item?.["media:thumbnail"]?.["@_url"] ?? item?.["media:thumbnail"]?.url;
  const mediaContent = item?.["media:content"]?.["@_url"] ?? item?.["media:content"]?.url;
  const enclosure = item?.enclosure?.["@_url"] ?? item?.enclosure?.url;

  const img =
    cleanText(mediaThumb) ||
    cleanText(mediaContent) ||
    cleanText(enclosure) ||
    null;

  if (!img) return null;
  // quick sanity
  if (!/^https?:\/\//i.test(img)) return null;
  return img;
}

function stripHtml(html?: string | null): string {
  const s = String(html ?? "");
  return cleanText(s.replace(/<[^>]*>/g, " "));
}

// --------------------
// Main
// --------------------
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") return json({ ok: true, fn: "ingest_rss" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    // Optional: protect ingestion with a secret (alternative to JWT)
    // This function does NOT require JWT authentication
    const INGEST_SECRET = (Deno.env.get("INGEST_SECRET") ?? "").trim();
    if (INGEST_SECRET) {
      const got = (req.headers.get("x-ingest-secret") ?? "").trim();
      if (got !== INGEST_SECRET) return json({ error: "Forbidden" }, 403);
    }

    // Use service role key to bypass RLS and insert/update feed_items
    // No JWT required - this function uses service role authentication
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const maxFeeds = typeof body.maxFeeds === "number" ? Math.min(Math.max(body.maxFeeds, 1), 50) : 25;
    // Per-feed limit: minimum 100 items to increase RSS ingest volume
    // Maximum 200 to prevent excessive memory usage
    const perFeedLimit = typeof body.perFeedLimit === "number" ? Math.min(Math.max(body.perFeedLimit, 100), 200) : 100;

    // Accept URLs directly from request body, OR merge from sources + rss_sources tables
    let feeds: string[] = [];

    // If URLs are provided in the request body, use those (override behavior)
    if (Array.isArray(body.urls) && body.urls.length > 0) {
      feeds = body.urls
        .map((url: any) => cleanText(String(url ?? "")))
        .filter((url: string) => {
          // Basic URL validation
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        })
        .slice(0, maxFeeds);
    } else {
      // Merge URLs from sources table and rss_sources table
      const allUrls = new Set<string>();

      // 1. Query sources table for RSS feeds
      let sourcesQuery = supabase
        .from("sources")
        .select("url, is_active")
        .eq("type", "rss")
        .eq("enabled", true);

      // Filter by user_id if provided in request body
      if (body.user_id) {
        sourcesQuery = sourcesQuery.eq("user_id", body.user_id);
      }

      // Handle is_active column if it exists (treat null as true)
      // Note: We'll filter this in JavaScript after fetching since Supabase doesn't have a direct "IS NULL OR = true" filter
      const { data: sourcesData, error: sourcesErr } = await sourcesQuery;

      if (!sourcesErr && sourcesData && sourcesData.length > 0) {
        // Filter for is_active: treat null as true, only exclude if explicitly false
        const activeSources = sourcesData.filter((s: any) => {
          // If is_active column doesn't exist, include all
          if (!("is_active" in s)) return true;
          // If is_active is null or true, include it
          return s.is_active !== false;
        });

        for (const source of activeSources) {
          const url = cleanText(String(source.url ?? ""));
          if (url) {
            try {
              new URL(url);
              allUrls.add(url);
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }

      // 2. Query rss_sources table (global defaults)
      const { data: defaultSources, error: defaultErr } = await supabase
        .from("rss_sources")
        .select("url")
        .eq("active", true)
        .order("weight", { ascending: false })
        .limit(maxFeeds * 2); // Get more than needed since we'll merge and dedupe

      if (!defaultErr && defaultSources && defaultSources.length > 0) {
        for (const source of defaultSources) {
          const url = cleanText(String(source.url ?? ""));
          if (url) {
            try {
              new URL(url);
              allUrls.add(url);
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }

      // Convert Set to array, validate, and cap to maxFeeds
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
      return json({
        ok: true,
        ingested: 0,
        feeds: 0,
        note: body.urls 
          ? 'No valid URLs provided in request body.'
          : 'No active RSS sources found in sources or rss_sources tables.',
      });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // helps with rss where there’s one item vs array
      isArray: (name) => name === "item" || name === "entry",
    });

    let totalUpserted = 0;
    const feedResults: any[] = [];

    for (const feedUrl of feeds) {
      const started = Date.now();
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

        // RSS 2.0: rss.channel.item[]
        const rssItems = parsed?.rss?.channel?.item ?? [];
        // Atom: feed.entry[]
        const atomEntries = parsed?.feed?.entry ?? [];

        const items = Array.isArray(rssItems) ? rssItems : [];
        const entries = Array.isArray(atomEntries) ? atomEntries : [];

        const unified = [
          ...items.map((it: any) => ({ kind: "rss", it })),
          ...entries.map((it: any) => ({ kind: "atom", it })),
        ].slice(0, perFeedLimit);

        fetched = unified.length;

        const rows = [];
        for (const u of unified) {
          try {
            const it = u.it;

            const title = cleanText(pickFirst(it.title)) || "Untitled";
            const link =
              u.kind === "atom"
                ? cleanText(pickFirst(it.link?.["@_href"] ?? it.link?.href ?? it.link))
                : cleanText(pickFirst(it.link));

            const guid = cleanText(pickFirst(it.guid?.["#text"] ?? it.guid));
            const atomId = cleanText(pickFirst(it.id));

            const externalId = guid || atomId || link || `${feedUrl}:${title}`;

            const author =
              u.kind === "atom"
                ? cleanText(pickFirst(it.author?.name ?? it.author))
                : cleanText(pickFirst(it["dc:creator"] ?? it.author));

            const published =
              toIsoDate(it.pubDate ?? it.published ?? it.updated ?? it["dc:date"]) ??
              null;

            // Store ingested_at timestamp for items missing published_at
            const ingestedAt = new Date().toISOString();

            const summaryRaw =
              it["content:encoded"] ??
              it.content ??
              it.summary ??
              it.description ??
              null;

            const summary = stripHtml(summaryRaw);

            const imageUrl = extractImage(it);

            // Extract tags/topics from RSS item
            // RSS 2.0: category[], Atom: category[]
            const categoryTags: string[] = [];
            const categoryTopics: string[] = [];
            
            // Handle RSS 2.0 categories
            const rssCategories = Array.isArray(it.category) ? it.category : (it.category ? [it.category] : []);
            for (const cat of rssCategories) {
              const catText = cleanText(typeof cat === "string" ? cat : (cat?.["#text"] ?? cat?.term ?? String(cat)));
              if (catText && catText.length > 0) {
                categoryTags.push(catText);
              }
            }
            
            // Handle Atom categories
            const atomCategories = Array.isArray(it["atom:category"]) ? it["atom:category"] : (it["atom:category"] ? [it["atom:category"]] : []);
            for (const cat of atomCategories) {
              const catText = cleanText(cat?.term ?? String(cat));
              if (catText && catText.length > 0) {
                categoryTags.push(catText);
              }
            }

            // Normalize and derive tags (mandatory)
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
              const normalized = tags.map(normalizeTag).filter((tag): tag is string => tag !== null);
              return Array.from(new Set(normalized));
            }
            
            function extractKeywordsFromText(text: string | null | undefined, maxKeywords = 5): string[] {
              if (!text || typeof text !== "string") return [];
              const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
              if (!clean) return [];
              const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those", "it", "its", "they", "them", "their", "what", "which", "who", "when", "where", "why", "how", "all", "each", "every", "some", "any", "no", "not", "only", "just", "more", "most", "very", "too", "so", "than", "then", "there", "here", "up", "down", "out", "off", "over", "under", "again", "further", "once", "twice"]);
              const words = clean.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w.length >= 3 && !stopWords.has(w));
              const freq = new Map<string, number>();
              for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);
              const sorted = Array.from(freq.entries()).sort((a, b) => {
                if (b[1] !== a[1]) return b[1] - a[1];
                return a[0].localeCompare(b[0]);
              }).slice(0, maxKeywords).map(([word]) => word);
              return normalizeTags(sorted);
            }
            
            // Derive tags: categories first, then keyword extraction from title+summary
            let derivedTags = normalizeTags(categoryTags);
            if (derivedTags.length < 3) {
              const text = [title, summary].filter(Boolean).join(" ");
              const keywords = extractKeywordsFromText(text, 5);
              derivedTags = Array.from(new Set([...derivedTags, ...keywords])).slice(0, 10);
            }
            // Ensure tags is never null/empty (mandatory)
            if (derivedTags.length === 0) {
              derivedTags = ["rss"]; // Fallback tag
            }

            // Basic score heuristic: 
            // - Has image: +0.3
            // - Has summary: +0.2
            // - Has author: +0.1
            // - Has published_at: +0.2
            // - Has tags: +0.2
            // Base score: 1.0
            let score = 1.0;
            if (imageUrl) score += 0.3;
            if (summary && summary.length > 50) score += 0.2;
            if (author) score += 0.1;
            if (published) score += 0.2;
            if (derivedTags.length > 0) score += 0.2;

            // IMPORTANT: your social_feed uses this
            const follow_key = `rss:${feedUrl}`;

            // Use source column (not source_type) and external_id for upsert
            // ingested_at column stores when item was ingested (fallback for published_at)
            rows.push({
              source: "rss",
              external_id: externalId,
              url: link || feedUrl,
              title,
              summary: summary ? summary.slice(0, 1200) : null,
              author: author || null,
              image_url: imageUrl || null,
              published_at: published, // Keep null if missing, ingested_at will be used as fallback
              ingested_at: ingestedAt, // Store ingested timestamp for fallback when published_at is missing
              tags: derivedTags, // Always set tags (mandatory, never null)
              topics: categoryTopics.length > 0 ? categoryTopics.slice(0, 10) : null, // Limit to 10 topics
              is_discoverable: true, // All RSS items are discoverable by default
              score: score, // Basic heuristic score
              metadata: {
                feed_url: feedUrl,
                follow_key,
                raw_id: externalId,
              },
            });
          } catch (itemErr: any) {
            // Skip items that fail to parse, but continue with other items
            console.error(`[ingest_rss] Error parsing item from ${feedUrl}:`, itemErr?.message ?? String(itemErr));
            continue;
          }
        }

        if (!rows.length) {
          feedResults.push({ feedUrl, ok: true, fetched: 0, upserted: 0, ms: Date.now() - started });
          continue;
        }

        // Deduplicate within batch BEFORE upserting to prevent ON CONFLICT double-update errors
        // Key by (source, external_id) which matches the unique constraint
        const dedupeMap = new Map<string, typeof rows[0]>();
        for (const row of rows) {
          const key = `${row.source}:${row.external_id}`;
          // If duplicate exists, prefer the one with published_at (more complete data)
          const existing = dedupeMap.get(key);
          if (!existing || (!existing.published_at && row.published_at)) {
            dedupeMap.set(key, row);
          }
        }
        const uniqueRows = Array.from(dedupeMap.values());

        // Upsert by (source, external_id) — unique index exists on these columns
        const { data: upData, error: upErr } = await supabase
          .from("feed_items")
          .upsert(uniqueRows, { onConflict: "source,external_id" })
          .select("id");

        if (upErr) {
          feedResults.push({ feedUrl, ok: false, error: upErr.message, fetched, ms: Date.now() - started });
          continue;
        }

        upserted = upData?.length ?? 0;
        totalUpserted += upserted;
        
        // Log deduplication stats for debugging
        if (rows.length !== uniqueRows.length) {
          console.log(`[ingest_rss] Deduplicated ${rows.length - uniqueRows.length} duplicate items from ${feedUrl}`);
        }

        feedResults.push({
          feedUrl,
          ok: true,
          fetched,
          upserted,
          ms: Date.now() - started,
        });
      } catch (e: any) {
        feedResults.push({ feedUrl, ok: false, error: e?.message ?? String(e), fetched, ms: Date.now() - started });
      }
    }

    const result = {
      ok: true,
      feeds: feeds.length,
      ingested: totalUpserted,
      results: feedResults,
    };

    // Log successful run to job_runs
    try {
      const successfulFeeds = feedResults.filter((r) => r.ok).length;
      const failedFeeds = feedResults.filter((r) => !r.ok).length;
      const summaryMessage = `ingested=${totalUpserted} feeds=${feeds.length} successful=${successfulFeeds} failed=${failedFeeds}`;
      
      await supabase
        .from("job_runs")
        .upsert(
          {
            job_name: "rss_ingest",
            last_run_at: new Date().toISOString(),
            status: "success",
            error_message: summaryMessage,
            result_summary: {
              feeds: feeds.length,
              ingested: totalUpserted,
              successful_feeds: successfulFeeds,
              failed_feeds: failedFeeds,
              results: feedResults,
            },
          },
          { onConflict: "job_name" }
        );
    } catch (logErr) {
      console.error("[ingest_rss] Error logging to job_runs:", logErr);
      // Don't fail the request if logging fails
    }

    return json(result);
  } catch (e: any) {
    const errorMessage = e?.message ?? String(e);
    
    // Log error to job_runs (try to get supabase client if available)
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (SUPABASE_URL && SERVICE_KEY) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });
        await supabase
          .from("job_runs")
          .upsert(
            {
              job_name: "rss_ingest",
              last_run_at: new Date().toISOString(),
              status: "error",
              error_message: errorMessage,
              result_summary: null,
            },
            { onConflict: "job_name" }
          );
      }
    } catch (logErr) {
      console.error("[ingest_rss] Error logging error to job_runs:", logErr);
      // Don't fail the request if logging fails
    }

    return json({ error: errorMessage }, 500);
  }
});
