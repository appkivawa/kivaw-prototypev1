import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --------------------
// CORS
// --------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-client-info, content-type, x-ingest-secret",
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
// Types
// --------------------
type TMDBMovie = {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  [key: string]: unknown;
};

type TMDBResponse = {
  results: TMDBMovie[];
  page: number;
  total_pages: number;
  total_results: number;
};

type MovieRow = {
  provider: string;
  external_id: string;
  title: string;
  overview: string | null;
  poster_url: string | null;
  release_date: string | null;
  genres: string[];
  popularity: number;
  rating: number;
  raw: Record<string, unknown>;
};

// --------------------
// TMDB API Helpers
// --------------------
async function fetchTMDBList(apiKey: string, endpoint: string, limit = 20): Promise<TMDBMovie[]> {
  const baseUrl = "https://api.themoviedb.org/3";
  const url = `${baseUrl}${endpoint}?api_key=${encodeURIComponent(apiKey)}&page=1&language=en-US`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  const data: TMDBResponse = await response.json();
  return data.results.slice(0, limit);
}

// Fetch movie details to get full genre names
async function fetchMovieDetails(apiKey: string, movieId: number): Promise<TMDBMovie> {
  const baseUrl = "https://api.themoviedb.org/3";
  const url = `${baseUrl}/movie/${movieId}?api_key=${encodeURIComponent(apiKey)}&language=en-US`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function normalizeMovie(movie: TMDBMovie): MovieRow {
  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  
  // Extract genres
  const genres: string[] = [];
  if (Array.isArray(movie.genres)) {
    genres.push(...movie.genres.map((g) => String(g.name || g.id)));
  } else if (Array.isArray(movie.genre_ids)) {
    // If only genre_ids are present, we'll need to fetch details or use IDs
    // For now, store IDs as strings
    genres.push(...movie.genre_ids.map((id) => String(id)));
  }

  return {
    provider: "tmdb",
    external_id: String(movie.id),
    title: movie.title,
    overview: movie.overview || null,
    poster_url: movie.poster_path ? `${imageBaseUrl}${movie.poster_path}` : null,
    release_date: movie.release_date || null,
    genres,
    popularity: movie.popularity || 0,
    rating: movie.vote_average || 0,
    raw: movie as Record<string, unknown>,
  };
}

// --------------------
// Main
// --------------------
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") {
    return json({ ok: true, fn: "ingest_movies" });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    // Optional: protect ingestion with a secret
    const INGEST_SECRET = (Deno.env.get("INGEST_SECRET") ?? "").trim();
    if (INGEST_SECRET) {
      const got = (req.headers.get("x-ingest-secret") ?? "").trim();
      if (got !== INGEST_SECRET) return json({ error: "Forbidden" }, 403);
    }

    // Get TMDB API key
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";
    if (!TMDB_API_KEY || TMDB_API_KEY.trim() === "") {
      return json({ error: "TMDB_API_KEY not configured" }, 500);
    }

    // Use service role key to bypass RLS
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Check if TMDB provider is enabled
    const { data: providerSettings } = await supabase
      .from("provider_settings")
      .select("enabled")
      .eq("provider", "tmdb")
      .maybeSingle();

    if (!providerSettings || !providerSettings.enabled) {
      return json({ ok: true, ingested: 0, note: "TMDB provider is disabled" });
    }

    const tmdbApiKey = TMDB_API_KEY.trim();
    const allMovies: TMDBMovie[] = [];
    const sourceCounts = { trending: 0, now_playing: 0, upcoming: 0 };

    // Fetch from multiple endpoints
    try {
      console.log("[ingest_movies] Fetching trending movies...");
      const trending = await fetchTMDBList(tmdbApiKey, "/trending/movie/day", 20);
      allMovies.push(...trending);
      sourceCounts.trending = trending.length;
    } catch (e: any) {
      console.error("[ingest_movies] Error fetching trending:", e?.message);
    }

    try {
      console.log("[ingest_movies] Fetching now playing movies...");
      const nowPlaying = await fetchTMDBList(tmdbApiKey, "/movie/now_playing", 20);
      allMovies.push(...nowPlaying);
      sourceCounts.now_playing = nowPlaying.length;
    } catch (e: any) {
      console.error("[ingest_movies] Error fetching now playing:", e?.message);
    }

    try {
      console.log("[ingest_movies] Fetching upcoming movies...");
      const upcoming = await fetchTMDBList(tmdbApiKey, "/movie/upcoming", 20);
      allMovies.push(...upcoming);
      sourceCounts.upcoming = upcoming.length;
    } catch (e: any) {
      console.error("[ingest_movies] Error fetching upcoming:", e?.message);
    }

    // Deduplicate by movie ID
    const movieMap = new Map<number, TMDBMovie>();
    for (const movie of allMovies) {
      if (!movieMap.has(movie.id)) {
        movieMap.set(movie.id, movie);
      }
    }

    const uniqueMovies = Array.from(movieMap.values());

    if (uniqueMovies.length === 0) {
      return json({ ok: true, ingested: 0, note: "No movies fetched from TMDB" });
    }

    // Fetch full details for movies that only have genre_ids (to get genre names)
    const moviesWithDetails: TMDBMovie[] = [];
    for (const movie of uniqueMovies) {
      if (movie.genre_ids && (!movie.genres || movie.genres.length === 0)) {
        try {
          const details = await fetchMovieDetails(tmdbApiKey, movie.id);
          moviesWithDetails.push(details);
        } catch (e: any) {
          console.warn(`[ingest_movies] Error fetching details for movie ${movie.id}:`, e?.message);
          moviesWithDetails.push(movie); // Use original if details fetch fails
        }
      } else {
        moviesWithDetails.push(movie);
      }
    }

    // Normalize movies
    const normalizedMovies = moviesWithDetails.map(normalizeMovie);

    // Prepare rows for upsert
    const rows = normalizedMovies.map((movie) => ({
      provider: movie.provider,
      external_id: movie.external_id,
      title: movie.title,
      overview: movie.overview,
      poster_url: movie.poster_url,
      release_date: movie.release_date,
      genres: movie.genres,
      popularity: movie.popularity,
      rating: movie.rating,
      raw: movie.raw,
      updated_at: new Date().toISOString(),
    }));

    // Upsert to movies table (idempotent via unique constraint on provider, external_id)
    const { data: upsertData, error: upsertError } = await supabase
      .from("movies")
      .upsert(rows, {
        onConflict: "provider,external_id",
        ignoreDuplicates: false,
      })
      .select("external_id");

    if (upsertError) {
      console.error("[ingest_movies] Error upserting movies:", upsertError);
      return json({ error: upsertError.message }, 500);
    }

    const ingested = upsertData?.length ?? 0;

    return json({
      ok: true,
      ingested,
      total_fetched: uniqueMovies.length,
      sources: sourceCounts,
    });
  } catch (e: any) {
    console.error("[ingest_movies] Unhandled error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
