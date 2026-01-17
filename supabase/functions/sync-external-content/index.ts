/**
 * ============================================================
 * SYNC EXTERNAL CONTENT EDGE FUNCTION
 * ============================================================
 * 
 * This function syncs content from external providers (TMDB and Open Library)
 * into public.external_content_cache table.
 * 
 * REQUIRED SECRETS:
 * - TMDB_API_KEY: Must be set in Supabase secrets dashboard
 *   (Settings > Edge Functions > Secrets)
 * 
 * USAGE:
 * POST /functions/v1/sync-external-content
 * Body: {} (no parameters needed)
 * 
 * The function will:
 * 1. Fetch watch content from TMDB (movies + TV) using predefined queries
 * 2. Fetch read content from Open Library using predefined queries
 * 3. Upsert results into external_content_cache (using service role for RLS bypass)
 * 
 * Returns: { inserted, updated, errorsCount }
 * 
 * ============================================================
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

// ============================================================
// Types
// ============================================================

type TMDBMovie = {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  [key: string]: unknown;
};

type TMDBTV = {
  id: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  [key: string]: unknown;
};

type TMDBResponse = {
  results: (TMDBMovie | TMDBTV)[];
  page: number;
  total_pages: number;
  total_results: number;
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  first_sentence?: string | string[];
  cover_i?: number;
  edition_key?: string[];
  [key: string]: unknown;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
  numFound?: number;
  start?: number;
  [key: string]: unknown;
};

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

// ============================================================
// Predefined Queries
// ============================================================

const TMDB_MOVIE_QUERIES = ["comfort", "cozy", "feel good", "reflection", "faith"];
const TMDB_TV_QUERIES = ["comfort", "cozy", "feel good", "reflection", "faith"];
const OPEN_LIBRARY_QUERIES = ["cozy fiction", "self help", "inspiration", "faith", "journaling"];

const ITEMS_PER_QUERY = 10;

// ============================================================
// TMDB API Integration
// ============================================================

async function fetchTMDBMovies(
  apiKey: string,
  query: string,
  limit = 10
): Promise<TMDBMovie[]> {
  const baseUrl = "https://api.themoviedb.org/3";
  const url = `${baseUrl}/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&page=1`;

  console.log(`[TMDB Movies] Fetching query: "${query}"`);
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  console.log(`[TMDB Movies] Status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[TMDB Movies] API error: ${response.status}`, errorText);
    throw new Error(`TMDB Movies API error: ${response.status}`);
  }

  const data: TMDBResponse = await response.json();
  const results = (data.results as TMDBMovie[]).slice(0, limit);
  console.log(`[TMDB Movies] Fetched ${results.length} items for "${query}"`);
  return results;
}

async function fetchTMDBTV(
  apiKey: string,
  query: string,
  limit = 10
): Promise<TMDBTV[]> {
  const baseUrl = "https://api.themoviedb.org/3";
  const url = `${baseUrl}/search/tv?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&page=1`;

  console.log(`[TMDB TV] Fetching query: "${query}"`);
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  console.log(`[TMDB TV] Status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[TMDB TV] API error: ${response.status}`, errorText);
    throw new Error(`TMDB TV API error: ${response.status}`);
  }

  const data: TMDBResponse = await response.json();
  const results = (data.results as TMDBTV[]).slice(0, limit);
  console.log(`[TMDB TV] Fetched ${results.length} items for "${query}"`);
  return results;
}

function normalizeTMDBMovie(movie: TMDBMovie): NormalizedContent {
  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  
  return {
    provider: "tmdb",
    provider_id: String(movie.id), // Use just the ID, not "movie_" prefix
    type: "watch",
    title: movie.title,
    description: movie.overview || null,
    image_url: movie.poster_path ? `${imageBaseUrl}${movie.poster_path}` : null,
    url: `https://www.themoviedb.org/movie/${movie.id}`,
    raw: movie as Record<string, unknown>,
  };
}

function normalizeTMDBTV(tv: TMDBTV): NormalizedContent {
  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  
  return {
    provider: "tmdb",
    provider_id: String(tv.id), // Use just the ID, not "tv_" prefix
    type: "watch",
    title: tv.name,
    description: tv.overview || null,
    image_url: tv.poster_path ? `${imageBaseUrl}${tv.poster_path}` : null,
    url: `https://www.themoviedb.org/tv/${tv.id}`,
    raw: tv as Record<string, unknown>,
  };
}

// ============================================================
// Open Library API Integration
// ============================================================

async function fetchOpenLibrary(
  query: string,
  limit = 10
): Promise<OpenLibraryDoc[]> {
  const baseUrl = "https://openlibrary.org/search.json";
  const params = new URLSearchParams();
  params.append("q", query);
  params.append("limit", String(Math.min(limit, 100)));

  const url = `${baseUrl}?${params.toString()}`;

  console.log(`[Open Library] Fetching query: "${query}"`);
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  console.log(`[Open Library] Status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[Open Library] API error: ${response.status}`, errorText);
    throw new Error(`Open Library API error: ${response.status}`);
  }

  const data: OpenLibraryResponse = await response.json();
  const results = (data.docs || []).slice(0, limit);
  console.log(`[Open Library] Fetched ${results.length} items for "${query}"`);
  return results;
}

function normalizeOpenLibraryBook(doc: OpenLibraryDoc): NormalizedContent {
  const providerId = doc.key || (doc.edition_key && doc.edition_key[0] ? doc.edition_key[0] : null);
  
  if (!providerId) {
    throw new Error("Open Library doc missing both key and edition_key");
  }

  const title = doc.title || "Untitled";

  let description: string | null = null;
  if (doc.first_sentence) {
    if (Array.isArray(doc.first_sentence)) {
      description = doc.first_sentence.join(" ");
    } else {
      description = String(doc.first_sentence);
    }
  }

  const imageUrl = doc.cover_i 
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    : null;

  const url = doc.key 
    ? `https://openlibrary.org${doc.key}`
    : null;

  return {
    provider: "open_library",
    provider_id: providerId,
    type: "read",
    title: title,
    description: description,
    image_url: imageUrl,
    url: url,
    raw: doc as Record<string, unknown>,
  };
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get Supabase client with SERVICE ROLE KEY (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return jsonResponse({ 
        error: "Missing Supabase configuration",
        inserted: 0,
        updated: 0,
        errorsCount: 1,
      }, 500);
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("[Sync] Using service role key for RLS bypass");

    // Get TMDB API key from secrets
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    
    if (!TMDB_API_KEY || TMDB_API_KEY.trim() === "") {
      console.error("TMDB_API_KEY is missing or empty");
      return jsonResponse({ 
        error: "TMDB_API_KEY not configured. Please set the secret in Supabase dashboard (Settings > Edge Functions > Secrets)." 
      }, 500);
    }
    
    const tmdbApiKey = TMDB_API_KEY.trim();

    // Counters for results
    let tmdbMoviesCount = 0;
    let tmdbTVCount = 0;
    let openLibraryCount = 0;
    let inserted = 0;
    let updated = 0;
    let errorsCount = 0;

    // ============================================================
    // Fetch TMDB Movies
    // ============================================================
    const allTMDBMovies: NormalizedContent[] = [];
    
    for (const query of TMDB_MOVIE_QUERIES) {
      try {
        const movies = await fetchTMDBMovies(tmdbApiKey, query, ITEMS_PER_QUERY);
        const normalized = movies.map(normalizeTMDBMovie);
        allTMDBMovies.push(...normalized);
        tmdbMoviesCount += normalized.length;
      } catch (error) {
        console.error(`[TMDB Movies] Error fetching for query "${query}":`, error);
        errorsCount++;
      }
    }

    // ============================================================
    // Fetch TMDB TV
    // ============================================================
    const allTMDBTV: NormalizedContent[] = [];
    
    for (const query of TMDB_TV_QUERIES) {
      try {
        const tvShows = await fetchTMDBTV(tmdbApiKey, query, ITEMS_PER_QUERY);
        const normalized = tvShows.map(normalizeTMDBTV);
        allTMDBTV.push(...normalized);
        tmdbTVCount += normalized.length;
      } catch (error) {
        console.error(`[TMDB TV] Error fetching for query "${query}":`, error);
        errorsCount++;
      }
    }

    // ============================================================
    // Fetch Open Library Books
    // ============================================================
    const allOpenLibrary: NormalizedContent[] = [];
    
    for (const query of OPEN_LIBRARY_QUERIES) {
      try {
        const books = await fetchOpenLibrary(query, ITEMS_PER_QUERY);
        const normalized = books
          .map((doc) => {
            try {
              return normalizeOpenLibraryBook(doc);
            } catch (error) {
              console.error("[Open Library] Error normalizing doc:", error, doc);
              errorsCount++;
              return null;
            }
          })
          .filter((item): item is NormalizedContent => item !== null);
        allOpenLibrary.push(...normalized);
        openLibraryCount += normalized.length;
      } catch (error) {
        console.error(`[Open Library] Error fetching for query "${query}":`, error);
        errorsCount++;
      }
    }

    // ============================================================
    // Combine all content
    // ============================================================
    const allContent = [...allTMDBMovies, ...allTMDBTV, ...allOpenLibrary];
    const totalFetched = allContent.length;
    console.log(`[Sync] Total fetched: ${totalFetched} items`);

    // ============================================================
    // Deduplicate by (provider, provider_id) before upsert
    // ============================================================
    // Helper to score an item (prefer items with more complete data)
    function scoreItem(item: NormalizedContent): number {
      let score = 0;
      if (item.url) score += 10;
      if (item.description) score += 5;
      if (item.image_url) score += 3;
      return score;
    }

    // Deduplicate using Map, keeping the best item for each (provider, provider_id)
    const dedupeMap = new Map<string, NormalizedContent>();
    const duplicateKeys: string[] = [];

    for (const content of allContent) {
      const key = `${content.provider}:${content.provider_id}`;
      
      if (dedupeMap.has(key)) {
        duplicateKeys.push(key);
        // Keep the item with higher score (more complete data)
        const existing = dedupeMap.get(key)!;
        if (scoreItem(content) > scoreItem(existing)) {
          dedupeMap.set(key, content);
        }
      } else {
        dedupeMap.set(key, content);
      }
    }

    const deduplicatedContent = Array.from(dedupeMap.values());
    const totalAfterDedupe = deduplicatedContent.length;
    const duplicatesRemoved = totalFetched - totalAfterDedupe;

    console.log(`[Sync] After deduplication: ${totalAfterDedupe} items (removed ${duplicatesRemoved} duplicates)`);
    if (duplicateKeys.length > 0) {
      console.log(`[Sync] Sample duplicate keys (first 5): ${duplicateKeys.slice(0, 5).join(", ")}`);
    }

    // ============================================================
    // Upsert to external_content_cache
    // ============================================================
    console.log(`[Sync] Preparing to upsert ${totalAfterDedupe} items to external_content_cache`);
    
    const cacheInserts = deduplicatedContent.map((content) => ({
      provider: content.provider,
      provider_id: content.provider_id,
      type: content.type,
      title: content.title,
      description: content.description,
      image_url: content.image_url,
      url: content.url,
      raw: content.raw,
      fetched_at: new Date().toISOString(),
    }));

    // Check which items already exist to determine inserted vs updated
    const existingProviderIds = new Set<string>();
    if (deduplicatedContent.length > 0) {
      const providers = [...new Set(deduplicatedContent.map(c => c.provider))];
      for (const provider of providers) {
        const providerItems = deduplicatedContent.filter(c => c.provider === provider);
        const providerIds = providerItems.map(c => c.provider_id);
        
        const { data: existing } = await supabase
          .from("external_content_cache")
          .select("provider, provider_id")
          .eq("provider", provider)
          .in("provider_id", providerIds);
        
        if (existing) {
          existing.forEach(item => {
            existingProviderIds.add(`${item.provider}:${item.provider_id}`);
          });
        }
      }
    }

    const { data: cachedData, error: cacheError } = await supabase
      .from("external_content_cache")
      .upsert(cacheInserts, {
        onConflict: "provider,provider_id",
        ignoreDuplicates: false,
      })
      .select("id, provider, provider_id, title, url");

    if (cacheError) {
      console.error("[Sync] Error upserting to external_content_cache:", cacheError);
      errorsCount++;
      return jsonResponse({ 
        error: "Failed to upsert to cache", 
        details: cacheError.message,
        inserted: 0,
        updated: 0,
        errorsCount: 1,
      }, 500);
    }

    // Count inserted vs updated
    if (cachedData) {
      for (const item of cachedData) {
        const key = `${item.provider}:${item.provider_id}`;
        if (existingProviderIds.has(key)) {
          updated++;
        } else {
          inserted++;
        }
      }
    }

    console.log(`[Sync] Cache upsert complete: ${inserted} inserted, ${updated} updated`);

    // ============================================================
    // Return results
    // ============================================================
    console.log(`[Sync] Complete: ${inserted} inserted, ${updated} updated, ${errorsCount} errors`);
    
    const result = {
      inserted,
      updated,
      errorsCount,
      details: {
        tmdb_movies: tmdbMoviesCount,
        tmdb_tv: tmdbTVCount,
        open_library_read: openLibraryCount,
        total_fetched: totalFetched,
        total_after_dedupe: totalAfterDedupe,
        duplicates_removed: duplicatesRemoved,
      },
    };

    // Log successful run to job_runs
    try {
      const summaryMessage = `inserted=${inserted} updated=${updated} errors=${errorsCount}`;
      
      await supabase
        .from("job_runs")
        .upsert(
          {
            job_name: "sync_external_content",
            last_run_at: new Date().toISOString(),
            status: "success",
            error_message: summaryMessage,
            result_summary: {
              inserted,
              updated,
              errorsCount,
              tmdb_movies: tmdbMoviesCount,
              tmdb_tv: tmdbTVCount,
              open_library_read: openLibraryCount,
              total_fetched: totalFetched,
              total_after_dedupe: totalAfterDedupe,
              duplicates_removed: duplicatesRemoved,
            },
          },
          { onConflict: "job_name" }
        );
    } catch (logErr) {
      console.error("[sync-external-content] Error logging to job_runs:", logErr);
      // Don't fail the request if logging fails
    }
    
    return jsonResponse(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in sync-external-content:", error);
    
    // Log error to job_runs
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("job_runs")
          .upsert(
            {
              job_name: "sync_external_content",
              last_run_at: new Date().toISOString(),
              status: "error",
              error_message: errorMessage,
              result_summary: null,
            },
            { onConflict: "job_name" }
          );
      }
    } catch (logErr) {
      console.error("[sync-external-content] Error logging error to job_runs:", logErr);
      // Don't fail the request if logging fails
    }
    
    return jsonResponse(
      {
        error: errorMessage,
      },
      500
    );
  }
});

