import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS Headers
// ============================================================

// CORS Headers - ALWAYS return these for browser compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// Types
// ============================================================

type TMDBRequest = {
  query?: string;
  mode?: string; // Not used in API call, but included in request type
  limit?: number;
};

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

type TMDBResponse = {
  results: TMDBMovie[];
  page: number;
  total_pages: number;
  total_results: number;
};

type NormalizedContent = {
  provider: string;
  provider_id: string;
  type: "watch" | "read" | "listen" | "event";
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  raw: Record<string, unknown>;
};

// ============================================================
// TMDB API Integration
// ============================================================

async function fetchTMDBMovies(
  apiKey: string,
  query?: string,
  limit = 20
): Promise<TMDBMovie[]> {
  // TMDB v3 API base URL
  const baseUrl = "https://api.themoviedb.org/3";
  let url: string;

  if (query) {
    // Search movies endpoint (v3)
    url = `${baseUrl}/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&page=1`;
  } else {
    // Popular movies endpoint (v3)
    url = `${baseUrl}/movie/popular?api_key=${encodeURIComponent(apiKey)}&page=1`;
  }

  // DEV-only debug logging
  if (Deno.env.get("ENVIRONMENT") === "development" || Deno.env.get("DENO_ENV") === "development") {
    console.log("[DEV] TMDB API URL (key redacted):", url.replace(/api_key=[^&]+/, "api_key=***"));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`TMDB API error: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  const data: TMDBResponse = await response.json();
  return data.results.slice(0, limit);
}

function normalizeTMDBMovie(movie: TMDBMovie): NormalizedContent {
  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  
  return {
    provider: "tmdb",
    provider_id: String(movie.id),
    type: "watch",
    title: movie.title,
    description: movie.overview || null,
    image_url: movie.poster_path ? `${imageBaseUrl}${movie.poster_path}` : null,
    url: `https://www.themoviedb.org/movie/${movie.id}`,
    raw: movie as Record<string, unknown>,
  };
}

// ============================================================
// Tagging Logic (shared module)
// ============================================================

import {
  computeTagsForContent,
  storeTagsForCache,
} from "../_shared/tagging.ts";

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: TMDBRequest = await req.json().catch(() => ({}));
    const query = body.query;
    const limit = body.limit || 20;

    // Check if TMDB provider is enabled
    const { data: providerSettings, error: settingsError } = await supabase
      .from("provider_settings")
      .select("enabled")
      .eq("provider", "tmdb")
      .maybeSingle();

    if (settingsError) {
      console.error("Error checking provider settings:", settingsError);
      return jsonResponse({ error: "Failed to check provider settings" }, 500);
    }

    if (!providerSettings || !providerSettings.enabled) {
      return jsonResponse({ disabled: true, items: [] }, 200);
    }

    // Get TMDB API key from secrets
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    
    // DEV-only debug logging (never log the key value)
    if (Deno.env.get("ENVIRONMENT") === "development" || Deno.env.get("DENO_ENV") === "development") {
      console.log("[DEV] TMDB_API_KEY exists:", !!TMDB_API_KEY);
    }
    
    if (!TMDB_API_KEY || TMDB_API_KEY.trim() === "") {
      console.error("TMDB_API_KEY is missing or empty");
      return jsonResponse({ error: "TMDB_API_KEY not configured. Please set the secret in Supabase dashboard." }, 500);
    }
    
    const tmdbApiKey = TMDB_API_KEY.trim();

    // Fetch movies from TMDB
    const movies = await fetchTMDBMovies(tmdbApiKey, query, limit);

    // Normalize and upsert to cache
    const normalizedContent = movies.map(normalizeTMDBMovie);
    
    const cacheInserts = normalizedContent.map((content) => ({
      provider: content.provider,
      provider_id: content.provider_id,
      type: content.type,
      title: content.title,
      description: content.description,
      image_url: content.image_url,
      url: content.url,
      raw: content.raw,
    }));

    // Upsert to external_content_cache and get cache IDs
    const { data: cachedData, error: upsertError } = await supabase
      .from("external_content_cache")
      .upsert(cacheInserts, {
        onConflict: "provider,provider_id",
        ignoreDuplicates: false,
      })
      .select("id, provider, provider_id");

    if (upsertError) {
      console.error("Error upserting to cache:", upsertError);
      // Continue anyway - return results even if cache update fails
    }

    // Compute and store tags for each cached item
    if (cachedData && cachedData.length > 0) {
      for (const cachedItem of cachedData) {
        try {
          const content = normalizedContent.find(
            (c) => c.provider === cachedItem.provider && c.provider_id === cachedItem.provider_id
          );
          
          if (content) {
            // Extract genres from raw TMDB data
            const genres: string[] = [];
            if (content.raw && Array.isArray(content.raw.genres)) {
              content.raw.genres.forEach((g: any) => {
                if (g?.name) genres.push(String(g.name));
              });
            }

            // Compute tags (auto-tags + overrides merged)
            const tags = await computeTagsForContent(
              supabase,
              content.provider,
              content.provider_id,
              content.type,
              content.title,
              content.description,
              genres, // TMDB genres
              [] // No categories for movies
            );
            
            // Store tags in content_tags table
            await storeTagsForCache(supabase, cachedItem.id, tags);
          }
        } catch (tagError) {
          console.error(`Error tagging content ${cachedItem.id}:`, tagError);
          // Continue with other items even if one fails
        }
      }
    }

    // Return normalized content
    return jsonResponse({
      items: normalizedContent,
    });
  } catch (error) {
    console.error("Error in fetch-tmdb:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

