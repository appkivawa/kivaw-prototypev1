// ============================================================
// CONTENT NORMALIZATION LAYER
// ============================================================
// Normalizes TMDB and Open Library data into unified ContentItem format
// ============================================================

import type { ContentItem } from "./types";

// ============================================================
// TMDB Normalization
// ============================================================

type TMDBMovie = {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  runtime?: number;
  [key: string]: unknown;
};

type TMDBTV = {
  id: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  episode_run_time?: number[];
  [key: string]: unknown;
};

// TMDB genre ID to name mapping (common genres)
const TMDB_GENRES: Record<number, string> = {
  28: "action",
  12: "adventure",
  16: "animation",
  35: "comedy",
  80: "crime",
  99: "documentary",
  18: "drama",
  10751: "family",
  14: "fantasy",
  36: "history",
  27: "horror",
  10402: "music",
  9648: "mystery",
  10749: "romance",
  878: "science fiction",
  10770: "tv movie",
  53: "thriller",
  10752: "war",
  37: "western",
};

// Infer tags from TMDB genres and content
function inferTagsFromTMDB(genres: string[], overview: string | null, title: string): string[] {
  const tags: string[] = [];
  const lowerOverview = (overview || "").toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Genre-based tags
  if (genres.includes("comedy")) tags.push("light", "fun");
  if (genres.includes("drama")) tags.push("reflection", "emotional");
  if (genres.includes("horror") || genres.includes("thriller")) tags.push("intense", "cathartic");
  if (genres.includes("romance")) tags.push("comfort", "warm");
  if (genres.includes("documentary")) tags.push("curiosity", "learning");
  if (genres.includes("family")) tags.push("gentle", "safe");

  // Content-based tags
  if (lowerOverview.includes("faith") || lowerTitle.includes("faith")) tags.push("faith");
  if (lowerOverview.includes("spiritual") || lowerTitle.includes("spiritual")) tags.push("faith", "reflection");
  if (lowerOverview.includes("cozy") || lowerOverview.includes("comfort")) tags.push("comfort");
  if (lowerOverview.includes("mindful") || lowerOverview.includes("meditation")) tags.push("calm", "minimal");
  if (lowerOverview.includes("action") || lowerOverview.includes("adventure")) tags.push("energetic");

  return [...new Set(tags)]; // Deduplicate
}

// Normalize TMDB vote average (0-10) to 0-1
function normalizeRating(voteAverage: number): number {
  return Math.min(1, Math.max(0, voteAverage / 10));
}

// Normalize TMDB popularity (rough heuristic: 0-1000 -> 0-1)
function normalizePopularity(popularity: number): number {
  return Math.min(1, Math.max(0, popularity / 1000));
}

// Infer intensity from genres and content
function inferIntensity(genres: string[], overview: string | null): number {
  let intensity = 0.5; // Default

  // High intensity genres
  if (genres.includes("action") || genres.includes("horror") || genres.includes("thriller")) {
    intensity = 0.7;
  }
  // Medium intensity
  else if (genres.includes("drama") || genres.includes("adventure") || genres.includes("science fiction")) {
    intensity = 0.5;
  }
  // Low intensity
  else if (genres.includes("comedy") || genres.includes("family") || genres.includes("romance")) {
    intensity = 0.3;
  }

  // Adjust based on content
  const lowerOverview = (overview || "").toLowerCase();
  if (lowerOverview.includes("intense") || lowerOverview.includes("violent") || lowerOverview.includes("dark")) {
    intensity = Math.min(1, intensity + 0.2);
  }
  if (lowerOverview.includes("gentle") || lowerOverview.includes("calm") || lowerOverview.includes("peaceful")) {
    intensity = Math.max(0, intensity - 0.2);
  }

  return Math.min(1, Math.max(0, intensity));
}

// Infer cognitive load from genres and content
function inferCognitiveLoad(genres: string[], overview: string | null): number {
  let load = 0.5; // Default

  // High cognitive load
  if (genres.includes("mystery") || genres.includes("science fiction") || genres.includes("documentary")) {
    load = 0.7;
  }
  // Low cognitive load
  else if (genres.includes("comedy") || genres.includes("family") || genres.includes("romance")) {
    load = 0.3;
  }

  // Adjust based on content
  const lowerOverview = (overview || "").toLowerCase();
  if (lowerOverview.includes("complex") || lowerOverview.includes("philosophical") || lowerOverview.includes("intellectual")) {
    load = Math.min(1, load + 0.2);
  }
  if (lowerOverview.includes("simple") || lowerOverview.includes("light") || lowerOverview.includes("easy")) {
    load = Math.max(0, load - 0.2);
  }

  return Math.min(1, Math.max(0, load));
}

// Infer novelty (heuristic: newer = more novel, but also genre-dependent)
function inferNovelty(releaseDate: string | null, genres: string[]): number {
  let novelty = 0.5; // Default

  // Newer content is more novel
  if (releaseDate) {
    const releaseYear = new Date(releaseDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - releaseYear;
    if (age < 2) novelty = 0.7;
    else if (age < 5) novelty = 0.5;
    else if (age < 10) novelty = 0.4;
    else novelty = 0.3;
  }

  // Some genres are inherently more novel
  if (genres.includes("science fiction") || genres.includes("fantasy") || genres.includes("mystery")) {
    novelty = Math.min(1, novelty + 0.1);
  }

  return Math.min(1, Math.max(0, novelty));
}

export function normalizeTMDBMovie(movie: TMDBMovie): ContentItem {
  const genres = (movie.genres || [])
    .map((g) => g.name.toLowerCase())
    .concat((movie.genre_ids || []).map((id) => TMDB_GENRES[id]?.toLowerCase() || "").filter(Boolean));

  const tags = inferTagsFromTMDB(genres, movie.overview, movie.title);
  const intensity = inferIntensity(genres, movie.overview);
  const cognitiveLoad = inferCognitiveLoad(genres, movie.overview);
  const novelty = inferNovelty(movie.release_date, genres);

  return {
    id: `tmdb_movie_${movie.id}`,
    type: "watch",
    title: movie.title,
    tags,
    genres: [...new Set(genres)],
    intensity,
    cognitive_load: cognitiveLoad,
    novelty,
    duration_min: movie.runtime || null,
    popularity: normalizePopularity(movie.popularity || 0),
    rating: movie.vote_average ? normalizeRating(movie.vote_average) : null,
    link: `https://www.themoviedb.org/movie/${movie.id}`,
    source: "tmdb",
    description: movie.overview,
    image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
  };
}

export function normalizeTMDBTV(tv: TMDBTV): ContentItem {
  const genres = (tv.genres || [])
    .map((g) => g.name.toLowerCase())
    .concat((tv.genre_ids || []).map((id) => TMDB_GENRES[id]?.toLowerCase() || "").filter(Boolean));

  const tags = inferTagsFromTMDB(genres, tv.overview, tv.name);
  const intensity = inferIntensity(genres, tv.overview);
  const cognitiveLoad = inferCognitiveLoad(genres, tv.overview);
  const novelty = inferNovelty(tv.first_air_date, genres);

  // TV shows: use average episode runtime or default to 45min
  const durationMin = tv.episode_run_time && tv.episode_run_time.length > 0
    ? tv.episode_run_time[0]
    : 45;

  return {
    id: `tmdb_tv_${tv.id}`,
    type: "watch",
    title: tv.name,
    tags,
    genres: [...new Set(genres)],
    intensity,
    cognitive_load: cognitiveLoad,
    novelty,
    duration_min: durationMin,
    popularity: normalizePopularity(tv.popularity || 0),
    rating: tv.vote_average ? normalizeRating(tv.vote_average) : null,
    link: `https://www.themoviedb.org/tv/${tv.id}`,
    source: "tmdb",
    description: tv.overview,
    image_url: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : null,
  };
}

// ============================================================
// Open Library Normalization
// ============================================================

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  first_sentence?: string | string[];
  cover_i?: number;
  subject?: string[];
  isbn?: string[];
  [key: string]: unknown;
};

// Infer tags from Open Library subjects and content
function inferTagsFromOpenLibrary(subjects: string[], description: string | null, title: string): string[] {
  const tags: string[] = [];
  const lowerDesc = (description || "").toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerSubjects = subjects.map((s) => s.toLowerCase());

  // Subject-based tags
  if (lowerSubjects.some((s) => s.includes("fiction"))) tags.push("story", "narrative");
  if (lowerSubjects.some((s) => s.includes("self-help") || s.includes("self help"))) tags.push("growth", "practical");
  if (lowerSubjects.some((s) => s.includes("spiritual") || s.includes("religion"))) tags.push("faith", "reflection");
  if (lowerSubjects.some((s) => s.includes("philosophy"))) tags.push("reflection", "deep");
  if (lowerSubjects.some((s) => s.includes("poetry"))) tags.push("beauty", "minimal");
  if (lowerSubjects.some((s) => s.includes("biography"))) tags.push("curiosity", "learning");

  // Content-based tags
  if (lowerDesc.includes("cozy") || lowerDesc.includes("comfort")) tags.push("comfort");
  if (lowerDesc.includes("faith") || lowerTitle.includes("faith")) tags.push("faith");
  if (lowerDesc.includes("mindful") || lowerDesc.includes("meditation")) tags.push("calm", "minimal");
  if (lowerDesc.includes("inspiration") || lowerDesc.includes("motivation")) tags.push("growth", "expansive");

  return [...new Set(tags)];
}

// Infer intensity for books (generally lower than video content)
function inferBookIntensity(subjects: string[], description: string | null): number {
  let intensity = 0.3; // Books are generally calmer

  const lowerSubjects = subjects.map((s) => s.toLowerCase()).join(" ");
  const lowerDesc = (description || "").toLowerCase();

  // Higher intensity genres
  if (lowerSubjects.includes("thriller") || lowerSubjects.includes("horror") || lowerSubjects.includes("mystery")) {
    intensity = 0.5;
  }
  // Very low intensity
  if (lowerSubjects.includes("poetry") || lowerSubjects.includes("meditation") || lowerSubjects.includes("mindfulness")) {
    intensity = 0.1;
  }

  // Adjust based on content
  if (lowerDesc.includes("intense") || lowerDesc.includes("dark") || lowerDesc.includes("violent")) {
    intensity = Math.min(1, intensity + 0.2);
  }
  if (lowerDesc.includes("gentle") || lowerDesc.includes("calm") || lowerDesc.includes("peaceful")) {
    intensity = Math.max(0, intensity - 0.1);
  }

  return Math.min(1, Math.max(0, intensity));
}

// Infer cognitive load for books
function inferBookCognitiveLoad(subjects: string[], description: string | null): number {
  let load = 0.6; // Books generally require more cognitive engagement

  const lowerSubjects = subjects.map((s) => s.toLowerCase()).join(" ");
  const lowerDesc = (description || "").toLowerCase();

  // High cognitive load
  if (lowerSubjects.includes("philosophy") || lowerSubjects.includes("science") || lowerSubjects.includes("academic")) {
    load = 0.8;
  }
  // Lower cognitive load
  if (lowerSubjects.includes("fiction") || lowerSubjects.includes("romance") || lowerSubjects.includes("young adult")) {
    load = 0.4;
  }
  // Very low (poetry, simple guides)
  if (lowerSubjects.includes("poetry") || lowerSubjects.includes("self-help") || lowerSubjects.includes("guide")) {
    load = 0.3;
  }

  // Adjust based on content
  if (lowerDesc.includes("complex") || lowerDesc.includes("intellectual") || lowerDesc.includes("academic")) {
    load = Math.min(1, load + 0.2);
  }
  if (lowerDesc.includes("simple") || lowerDesc.includes("easy") || lowerDesc.includes("light")) {
    load = Math.max(0, load - 0.2);
  }

  return Math.min(1, Math.max(0, load));
}

// Infer novelty for books (heuristic: newer publications or unique subjects)
function inferBookNovelty(subjects: string[]): number {
  let novelty = 0.4; // Books are generally less novel than new media

  const lowerSubjects = subjects.map((s) => s.toLowerCase()).join(" ");

  // More novel genres
  if (lowerSubjects.includes("science fiction") || lowerSubjects.includes("fantasy") || lowerSubjects.includes("speculative")) {
    novelty = 0.6;
  }
  // Less novel (classics, traditional)
  if (lowerSubjects.includes("classic") || lowerSubjects.includes("traditional") || lowerSubjects.includes("historical")) {
    novelty = 0.2;
  }

  return Math.min(1, Math.max(0, novelty));
}

export function normalizeOpenLibraryBook(doc: OpenLibraryDoc): ContentItem {
  const providerId = doc.key || (doc.isbn && doc.isbn[0] ? doc.isbn[0] : null);
  if (!providerId) {
    throw new Error("Open Library doc missing key and isbn");
  }

  const title = doc.title || "Untitled";
  const subjects = (doc.subject || []).map((s) => s.toLowerCase());
  const description = Array.isArray(doc.first_sentence)
    ? doc.first_sentence.join(" ")
    : doc.first_sentence || null;

  const tags = inferTagsFromOpenLibrary(subjects, description, title);
  const intensity = inferBookIntensity(subjects, description);
  const cognitiveLoad = inferBookCognitiveLoad(subjects, description);
  const novelty = inferBookNovelty(subjects);

  // Books: estimate reading time (rough: 200 words per minute, average book ~80k words = 400min)
  // For simplicity, default to 300min (5 hours) unless we have better data
  const durationMin = 300;

  return {
    id: `open_library_${providerId.replace(/[^a-zA-Z0-9]/g, "_")}`,
    type: "read",
    title,
    tags,
    genres: [...new Set(subjects.slice(0, 5))], // Limit to first 5 subjects
    intensity,
    cognitive_load: cognitiveLoad,
    novelty,
    duration_min: durationMin,
    popularity: 0.5, // Default for books (no popularity metric from Open Library)
    rating: null, // Open Library doesn't provide ratings
    link: doc.key ? `https://openlibrary.org${doc.key}` : null,
    source: "open_library",
    description,
    image_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
  };
}



