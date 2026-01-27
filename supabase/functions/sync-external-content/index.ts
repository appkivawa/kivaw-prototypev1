/**
 * ============================================================
 * SYNC EXTERNAL CONTENT EDGE FUNCTION (FIXED)
 * ============================================================
 *
 * - TMDB: trending + popular (movies + tv)
 * - Open Library: trending-ish via Search API sorted by trending
 * - Fixes Open Library URL construction (work IDs vs /works paths)
 * - Adds better book byline/description using author_name
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logHealthEvent } from "./_shared/logHealthEvent.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

// ============================================================
// Types
// ============================================================

type NormalizedContent = {
  provider: string;
  provider_id: string;
  type: "watch" | "read";
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  raw: Record<string, unknown>;
};

type TMDBItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number;
  media_type?: string;
  [key: string]: unknown;
};

type TMDBResponse = {
  results: TMDBItem[];
};

type OpenLibraryDoc = {
  key?: string; // Often "OL27448W" (work id), sometimes "/works/OL..."
  title?: string;
  author_name?: string[];
  first_sentence?: string | string[];
  cover_i?: number;
  edition_key?: string[];
  [key: string]: unknown;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

// ============================================================
// Config
// ============================================================

const ITEMS_PER_SECTION = 25;

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// “Trending/popular” book slices by subject (feel free to tweak)
const OPEN_LIBRARY_SUBJECT_QUERIES = [
  "subject:fantasy",
  "subject:romance",
  "subject:science_fiction",
  "subject:mystery",
  "subject:thriller",
  "subject:young_adult",
  "subject:history",
  "subject:self-help",
];

// ============================================================
// TMDB
// ============================================================

async function fetchTMDB(
  apiKey: string,
  path: string,
  limit: number
): Promise<TMDBItem[]> {
  const url = `https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`TMDB error ${resp.status}: ${text}`);
  }
  const data: TMDBResponse = await resp.json();
  return (data.results || []).slice(0, limit);
}

function normalizeTMDB(item: TMDBItem, kind: "movie" | "tv"): NormalizedContent {
  const title = (kind === "movie" ? item.title : item.name) || "Untitled";
  const poster = item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null;
  const url =
    kind === "movie"
      ? `https://www.themoviedb.org/movie/${item.id}`
      : `https://www.themoviedb.org/tv/${item.id}`;

  return {
    provider: "tmdb",
    provider_id: `${kind}:${item.id}`, // avoids collisions movie vs tv
    type: "watch",
    title,
    description: item.overview ? String(item.overview) : null,
    image_url: poster,
    url,
    raw: item as Record<string, unknown>,
  };
}

// ============================================================
// Open Library (Search API)
// ============================================================

function normalizeOpenLibraryKeyToUrl(keyRaw?: string | null): string | null {
  if (!keyRaw) return null;

  // Key can be:
  // - "OL27448W" (work id)  <-- common in search docs
  // - "/works/OL27448W"
  // - "/books/OL....M"
  const key = String(keyRaw).trim();

  if (key.startsWith("/works/") || key.startsWith("/books/")) {
    return `https://openlibrary.org${key}`;
  }

  // If it looks like a Work ID, assume /works
  if (/^OL\d+W$/i.test(key)) {
    return `https://openlibrary.org/works/${key}`;
  }

  // If it looks like an Edition ID, assume /books
  if (/^OL\d+M$/i.test(key)) {
    return `https://openlibrary.org/books/${key}`;
  }

  // Fallback: at least make it a valid path
  return `https://openlibrary.org/works/${encodeURIComponent(key)}`;
}

function normalizeOpenLibraryBook(doc: OpenLibraryDoc): NormalizedContent | null {
  const providerId =
    (doc.key ? String(doc.key) : null) ||
    (doc.edition_key?.[0] ? String(doc.edition_key[0]) : null);

  if (!providerId) return null;

  const title = doc.title ? String(doc.title) : "Untitled";
  const author = doc.author_name?.length ? doc.author_name.join(", ") : null;

  let firstSentence: string | null = null;
  if (doc.first_sentence) {
    firstSentence = Array.isArray(doc.first_sentence)
      ? doc.first_sentence.join(" ")
      : String(doc.first_sentence);
  }

  const description = author
    ? (firstSentence ? `${author} — ${firstSentence}` : author)
    : (firstSentence || null);

  const image_url = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    : null;

  const url = normalizeOpenLibraryKeyToUrl(doc.key ?? null);

  // Extract first_publish_year from raw doc
  const firstPublishYear = (doc as any).first_publish_year;

  return {
    provider: "open_library",
    provider_id: providerId,
    type: "read",
    title,
    description,
    image_url,
    url,
    raw: {
      ...(doc as Record<string, unknown>),
      first_publish_year: firstPublishYear,
    },
  };
}

async function fetchOpenLibraryTrendingish(query: string, limit: number): Promise<OpenLibraryDoc[]> {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(Math.min(limit * 3, 100))); // Fetch more to filter by year
  params.set("sort", "new"); // Sort by newest first
  params.set("fields", "key,title,author_name,first_sentence,cover_i,edition_key,first_publish_year");

  const url = `https://openlibrary.org/search.json?${params.toString()}`;

  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenLibrary error ${resp.status}: ${text}`);
  }

  const data: OpenLibraryResponse = await resp.json();
  const allDocs = data.docs || [];
  
  // Filter to modern books (2000+), exclude obvious classics (< 1950)
  // Prioritize very recent (2020+), then 2010+, then 2000+
  const veryRecent = allDocs.filter((doc) => {
    const year = (doc as any).first_publish_year;
    return year && typeof year === "number" && year >= 2020 && year >= 1950;
  });
  
  // Sort by year descending (newest first)
  veryRecent.sort((a, b) => {
    const yearA = ((a as any).first_publish_year as number) || 0;
    const yearB = ((b as any).first_publish_year as number) || 0;
    return yearB - yearA;
  });
  
  if (veryRecent.length >= limit) {
    return veryRecent.slice(0, limit);
  }
  
  // Fallback to 2010+ if not enough 2020+ books
  const modern2010 = allDocs.filter((doc) => {
    const year = (doc as any).first_publish_year;
    return year && typeof year === "number" && year >= 2010 && year >= 1950;
  });
  
  // Sort by year descending
  modern2010.sort((a, b) => {
    const yearA = ((a as any).first_publish_year as number) || 0;
    const yearB = ((b as any).first_publish_year as number) || 0;
    return yearB - yearA;
  });
  
  if (modern2010.length >= limit) {
    return modern2010.slice(0, limit);
  }
  
  // Final fallback to 2000+ if still not enough (but still exclude < 1950)
  const modern2000 = allDocs.filter((doc) => {
    const year = (doc as any).first_publish_year;
    return year && typeof year === "number" && year >= 2000 && year >= 1950;
  });
  
  modern2000.sort((a, b) => {
    const yearA = ((a as any).first_publish_year as number) || 0;
    const yearB = ((b as any).first_publish_year as number) || 0;
    return yearB - yearA;
  });
  
  return modern2000.slice(0, limit);
}

// Fetch Work or Edition details for description
async function fetchOpenLibraryDetails(workKey: string): Promise<{ description?: string | { value?: string } } | null> {
  try {
    // Try Work endpoint first (e.g., /works/OL27448W.json)
    const workUrl = `https://openlibrary.org${workKey.startsWith("/") ? workKey : `/${workKey}`}.json`;
    const response = await fetch(workUrl, {
      headers: { "Accept": "application/json" },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (e) {
    // Fail silently
  }
  return null;
}

// ============================================================
// Handler
// ============================================================

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") {
    return jsonResponse({ ok: true, fn: "sync-external-content", version: "2026-01-27" });
  }

  const startTime = Date.now();
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    // Check CRON_SECRET if set (for internal cron calls)
    const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim();
    if (CRON_SECRET) {
      const got = (req.headers.get("x-cron-secret") ?? "").trim();
      if (got !== CRON_SECRET) {
        // Allow service role key as fallback (for direct calls)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.includes("Bearer")) {
          return jsonResponse({ error: "Forbidden: Missing or invalid x-cron-secret" }, 403);
        }
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const tmdbApiKey = (Deno.env.get("TMDB_API_KEY") || "").trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }
    if (!tmdbApiKey) {
      return jsonResponse({ error: "TMDB_API_KEY not configured (Edge Function secret missing)" }, 500);
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    let inserted = 0;
    let updated = 0;
    let errorsCount = 0;

    const all: NormalizedContent[] = [];

    // --------------------
    // TMDB: trending + popular
    // --------------------
    try {
      const trendingAll = await fetchTMDB(tmdbApiKey, "/trending/all/week", ITEMS_PER_SECTION);
      for (const it of trendingAll) {
        const mt = String(it.media_type || "");
        if (mt === "movie") all.push(normalizeTMDB(it, "movie"));
        if (mt === "tv") all.push(normalizeTMDB(it, "tv"));
      }
    } catch (e) {
      console.error("[TMDB] trending/all/week failed:", e);
      errorsCount++;
    }

    try {
      const popularMovies = await fetchTMDB(tmdbApiKey, "/movie/popular", ITEMS_PER_SECTION);
      all.push(...popularMovies.map((m) => normalizeTMDB(m, "movie")));
    } catch (e) {
      console.error("[TMDB] movie/popular failed:", e);
      errorsCount++;
    }

    try {
      const popularTv = await fetchTMDB(tmdbApiKey, "/tv/popular", ITEMS_PER_SECTION);
      all.push(...popularTv.map((t) => normalizeTMDB(t, "tv")));
    } catch (e) {
      console.error("[TMDB] tv/popular failed:", e);
      errorsCount++;
    }

    // --------------------
    // Open Library: subject + sort=trending
    // --------------------
    for (const q of OPEN_LIBRARY_SUBJECT_QUERIES) {
      try {
        const docs = await fetchOpenLibraryTrendingish(q, 12);
        let normalized = docs
          .map(normalizeOpenLibraryBook)
          .filter((x): x is NormalizedContent => !!x)
          // keep only "real" cards (cover or url)
          .filter((x) => !!x.url && (!!x.image_url || x.title.length > 0));

        // For selected items, fetch Work details to get descriptions
        // Only fetch for final selected set (not all results)
        for (const content of normalized) {
          const workKey = content.raw?.key as string | undefined;
          if (workKey && !content.description) {
            try {
              const details = await fetchOpenLibraryDetails(workKey);
              if (details?.description) {
                // Extract description - can be string or {value: string}
                let desc: string | null = null;
                if (typeof details.description === "string") {
                  desc = details.description;
                } else if (details.description && typeof details.description === "object" && "value" in details.description) {
                  desc = String(details.description.value || "");
                }
                
                if (desc) {
                  content.description = desc;
                  // Also update raw
                  content.raw = {
                    ...content.raw,
                    description: desc,
                  };
                }
              }
            } catch (e) {
              // Fail silently - continue with existing description or null
            }
          }
        }

        all.push(...normalized);
      } catch (e) {
        console.error(`[OpenLibrary] query failed "${q}":`, e);
        errorsCount++;
      }
    }

    // --------------------
    // Deduplicate: provider + provider_id
    // --------------------
    const scoreItem = (x: NormalizedContent) => (x.url ? 10 : 0) + (x.image_url ? 5 : 0) + (x.description ? 2 : 0);
    const map = new Map<string, NormalizedContent>();

    for (const x of all) {
      const key = `${x.provider}:${x.provider_id}`;
      const existing = map.get(key);
      if (!existing || scoreItem(x) > scoreItem(existing)) map.set(key, x);
    }

    const deduped = Array.from(map.values());

    // --------------------
    // Upsert
    // --------------------
    // Determine insert vs update
    const existingKeys = new Set<string>();
    if (deduped.length) {
      const byProvider = new Map<string, string[]>();
      for (const x of deduped) {
        const arr = byProvider.get(x.provider) || [];
        arr.push(x.provider_id);
        byProvider.set(x.provider, arr);
      }

      for (const [provider, ids] of byProvider.entries()) {
        const { data } = await supabase
          .from("external_content_cache")
          .select("provider, provider_id")
          .eq("provider", provider)
          .in("provider_id", ids);

        (data || []).forEach((r) => existingKeys.add(`${r.provider}:${r.provider_id}`));
      }
    }

    const rows = deduped.map((x) => ({
      provider: x.provider,
      provider_id: x.provider_id,
      type: x.type,
      title: x.title,
      description: x.description,
      image_url: x.image_url,
      url: x.url,
      raw: x.raw,
      fetched_at: new Date().toISOString(),
    }));

    const { data: upserted, error: upsertErr } = await supabase
      .from("external_content_cache")
      .upsert(rows, { onConflict: "provider,provider_id" })
      .select("provider, provider_id");

    if (upsertErr) {
      console.error("[Sync] upsert error:", upsertErr);
      return jsonResponse({ error: upsertErr.message }, 500);
    }

    for (const r of upserted || []) {
      const k = `${r.provider}:${r.provider_id}`;
      if (existingKeys.has(k)) updated++;
      else inserted++;
    }

    return jsonResponse({
      inserted,
      updated,
      errorsCount,
      details: {
        total_written: (upserted || []).length,
        total_deduped: deduped.length,
      },
    });
    
    const durationMs = Date.now() - startTime;
    await logHealthEvent(supabase, {
      jobName: "sync-external-content",
      status: "ok",
      durationMs,
      metadata: {
        inserted,
        updated,
        errorsCount,
      },
    });
    
    return jsonResponse({
      ok: true,
      inserted,
      updated,
      errorsCount,
      details: {
        total_written: (upserted || []).length,
        total_deduped: deduped.length,
      },
    });
  } catch (e: any) {
    console.error("[sync-external-content] fatal:", e);
    const durationMs = Date.now() - startTime;
    const errorMsg = e?.message || String(e);
    
    if (supabase) {
      await logHealthEvent(supabase, {
        jobName: "sync-external-content",
        status: "fail",
        durationMs,
        errorMessage: errorMsg,
      });
    }
    
    return jsonResponse({ error: errorMsg }, 500);
  }
});



