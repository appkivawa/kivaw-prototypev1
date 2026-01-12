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
    const perFeedLimit = typeof body.perFeedLimit === "number" ? Math.min(Math.max(body.perFeedLimit, 5), 50) : 20;

    // Accept URLs directly from request body, OR pull from user_sources table
    let feeds: string[] = [];

    // If URLs are provided in the request body, use those
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
      // Otherwise, pull RSS sources from user_sources table
      // Assumption: RSS sources stored as:
      // user_sources: { user_id, source_type: "rss", handle: "<feed_url>", is_enabled: true }
      const { data: rssSources, error: srcErr } = await supabase
        .from("user_sources")
        .select("handle")
        .eq("source_type", "rss")
        .eq("is_enabled", true)
        .limit(maxFeeds);

      if (srcErr) return json({ error: srcErr.message }, 500);

      feeds = (rssSources ?? [])
        .map((r: any) => cleanText(String(r.handle ?? "")))
        .filter(Boolean);
    }

    if (!feeds.length) {
      return json({
        ok: true,
        ingested: 0,
        feeds: 0,
        note: body.urls 
          ? 'No valid URLs provided in request body.'
          : 'No enabled RSS sources found in user_sources (source_type="rss").',
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
            const sourceItemId = await sha1(`rss|${feedUrl}|${externalId}`);

            const author =
              u.kind === "atom"
                ? cleanText(pickFirst(it.author?.name ?? it.author))
                : cleanText(pickFirst(it["dc:creator"] ?? it.author));

            const published =
              toIsoDate(it.pubDate ?? it.published ?? it.updated ?? it["dc:date"]) ??
              null;

            const summaryRaw =
              it["content:encoded"] ??
              it.content ??
              it.summary ??
              it.description ??
              null;

            const summary = stripHtml(summaryRaw);

            const imageUrl = extractImage(it);

            // Tags/topics are optional; keep minimal for now
            const tags = [];
            const topics = [];

            // IMPORTANT: your social_feed uses this
            const follow_key = `rss:${feedUrl}`;

            // NOTE: Do NOT insert into generated column "source"
            rows.push({
              source_type: "rss",
              source_item_id: sourceItemId,
              external_id: externalId,
              url: link || feedUrl,
              title,
              summary: summary ? summary.slice(0, 1200) : null,
              author: author || null,
              image_url: imageUrl || null,
              published_at: published,
              tags,
              topics,
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

        // Upsert by (source_type, source_item_id) — you should have a unique index for this.
        const { data: upData, error: upErr } = await supabase
          .from("feed_items")
          .upsert(rows, { onConflict: "source_type,source_item_id" })
          .select("id");

        if (upErr) {
          feedResults.push({ feedUrl, ok: false, error: upErr.message, fetched, ms: Date.now() - started });
          continue;
        }

        upserted = upData?.length ?? 0;
        totalUpserted += upserted;

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

    return json({
      ok: true,
      feeds: feeds.length,
      ingested: totalUpserted,
      results: feedResults,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
