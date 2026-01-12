import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ============================================================
// Version
// ============================================================
const VERSION = "feed-v7-tmdb-ol-googlebooks-2026-01-09";

// ============================================================
// CORS
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
type FeedCard = {
  id: string;
  kind: "movie" | "book";
  title: string;

  byline?: string | null;
  meta?: string | null;
  image_url?: string | null;
  url?: string | null;

  // source can now be googlebooks too
  source: "tmdb" | "openlibrary" | "googlebooks";

  tags?: string[] | null;

  // Keep these for forward-compat (even if Explore doesn’t use them)
  headline?: string | null;
  story?: string | null;
  prompts?: string[] | null;
  opener?: string | null;

  // Main description you display
  bio?: string | null;
};

type TMDBMovie = {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number;
  genre_ids?: number[];
};

type TMDBResponse = { results: TMDBMovie[] };

type TMDBGenre = { id: number; name: string };
type TMDBGenresResponse = { genres: TMDBGenre[] };

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
};

type OpenLibraryResponse = { docs?: OpenLibraryDoc[] };

type OpenLibraryWork = {
  description?: string | { value?: string };
  subjects?: string[];
};

type GoogleBooksVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    categories?: string[];
    pageCount?: number;
    averageRating?: number;
    ratingsCount?: number;
    infoLink?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    language?: string;
  };
};

type GoogleBooksResponse = { items?: GoogleBooksVolume[] };

// ============================================================
// Small safe helpers
// ============================================================
function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function clampStr(s: string, max = 220) {
  const trimmed = (s ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

function normalizeForCompare(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(arr: T[]) {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (x == null) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function firstSentences(text: string, max = 520) {
  const t = (text ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!t) return "";
  if (t.length <= max) return t;

  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  if (lastStop > 120) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

// ============================================================
// Tag cleaning
// ============================================================
function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function cleanSubject(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const low = s.toLowerCase();

  if (
    low.startsWith("nyt:") ||
    low.includes("new york times") ||
    low.includes("trade-fiction") ||
    low.includes("paperback") ||
    low.includes("hardcover") ||
    low.includes("kindle") ||
    low.includes("isbn") ||
    low.includes("bestseller") ||
    low.includes("large type") ||
    low.includes("textbook")
  ) return null;

  s = s.replace(/\([^)]*\)/g, " ").trim();
  s = s.replace(/[-_]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  const generic = new Set(["fiction", "novel", "books", "literature", "general"]);
  if (generic.has(s.toLowerCase())) return null;

  if (s.length < 3) return null;
  if (s.length > 42) return null;

  return titleCase(s);
}

function cleanTags(tags?: string[] | null, max = 6): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const t of tags ?? []) {
    const c = cleanSubject(String(t ?? ""));
    if (!c) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

// ============================================================
// Fetch with timeout
// ============================================================
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6500,
): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

// Concurrency limiter
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}

// ============================================================
// TMDB
// ============================================================
async function fetchMovieGenres(apiKey: string): Promise<Record<number, string>> {
  const url =
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${encodeURIComponent(apiKey)}&language=en-US`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 6500);
  if (!res.ok) return {};
  const data: TMDBGenresResponse = await res.json();
  const map: Record<number, string> = {};
  for (const g of data.genres ?? []) map[g.id] = g.name;
  return map;
}

async function fetchTrendingMovies(apiKey: string, limit = 25): Promise<TMDBMovie[]> {
  const url =
    `https://api.themoviedb.org/3/trending/movie/day?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 6500);
  if (!res.ok) throw new Error(`TMDB error: ${res.status} ${res.statusText}`);
  const data: TMDBResponse = await res.json();
  return (data.results ?? []).slice(0, limit);
}

function normalizeTMDBMovie(movie: TMDBMovie, genreMap: Record<number, string>): FeedCard {
  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;

  const metaParts: string[] = [];
  if (year) metaParts.push(String(year));
  if (rating) metaParts.push(`⭐ ${rating}`);

  const tags =
    (movie.genre_ids ?? [])
      .map((id) => genreMap[id])
      .filter(Boolean)
      .slice(0, 6) ?? [];

  return {
    id: `tmdb:${movie.id}`,
    kind: "movie",
    title: movie.title,
    byline: null,
    meta: metaParts.length ? metaParts.join(" • ") : null,
    image_url: movie.poster_path ? `${imageBaseUrl}${movie.poster_path}` : null,
    url: `https://www.themoviedb.org/movie/${movie.id}`,
    source: "tmdb",
    tags: tags.length ? cleanTags(tags, 6) : null,
    bio: movie.overview ? firstSentences(movie.overview, 520) : null,
  };
}

// ============================================================
// Open Library
// ============================================================
const MIN_YEAR = 2010;

async function fetchOpenLibrarySearchPage(query: string, limit: number, offset: number) {
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 6500);
  if (!res.ok) throw new Error(`OpenLibrary error: ${res.status} ${res.statusText}`);
  const data: OpenLibraryResponse = await res.json();
  return data;
}

async function fetchOpenLibraryBooks(limit = 16): Promise<OpenLibraryDoc[]> {
  const queries = [
    "award winning fiction 2019",
    "thriller 2020",
    "romance 2021",
    "fantasy 2022",
    "mystery 2023",
    "debut novel 2024",
  ];

  const PAGE_SIZE = 25;
  const MAX_REQUESTS = 6;

  const modern: OpenLibraryDoc[] = [];
  const seen = new Set<string>();

  let reqs = 0;
  let qIndex = 0;
  let offset = 0;

  while (modern.length < limit && reqs < MAX_REQUESTS && qIndex < queries.length) {
    const q = queries[qIndex];
    const data = await fetchOpenLibrarySearchPage(q, PAGE_SIZE, offset);
    const docs = data.docs ?? [];

    if (!docs.length) {
      qIndex++;
      offset = 0;
      continue;
    }

    for (const doc of docs) {
      if (!doc.key || !doc.title) continue;
      const workKey = doc.key;
      if (seen.has(workKey)) continue;
      seen.add(workKey);

      const y = doc.first_publish_year ?? null;
      if (!y || y < MIN_YEAR) continue;

      modern.push(doc);
      if (modern.length >= limit) break;
    }

    offset += PAGE_SIZE;
    reqs++;

    if (docs.length < PAGE_SIZE) {
      qIndex++;
      offset = 0;
    }
  }

  return modern.slice(0, limit);
}

async function fetchOpenLibraryWork(workKey: string): Promise<OpenLibraryWork | null> {
  const key = workKey.startsWith("/works/") ? workKey : workKey;
  const url = `https://openlibrary.org${key}.json`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 6500);
  if (!res.ok) return null;
  return await res.json();
}

function extractWorkDescription(work: OpenLibraryWork | null): string | null {
  if (!work?.description) return null;
  const d = work.description;
  if (typeof d === "string") return d;
  if (typeof d === "object" && d?.value) return d.value;
  return null;
}

function normalizeOpenLibraryBook(doc: OpenLibraryDoc): FeedCard {
  const docKey = doc.key || "unknown";
  const byline =
    doc.author_name && doc.author_name.length ? doc.author_name.slice(0, 2).join(", ") : null;
  const year = doc.first_publish_year ?? null;
  const tags = doc.subject?.length ? cleanTags(doc.subject, 6) : null;

  return {
    id: `ol:${docKey}`,
    kind: "book",
    title: doc.title || "Untitled",
    byline,
    meta: year ? `Published: ${year}` : null,
    image_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    url: doc.key ? `https://openlibrary.org${doc.key}` : null,
    source: "openlibrary",
    tags,
    bio: null,
  };
}

// ============================================================
// Google Books helper (best-match description)
// ============================================================
async function fetchGoogleBooksBestMatch(args: {
  title: string;
  author: string | null;
  apiKey: string | null;
  timeoutMs?: number;
}) {
  const { title, author, apiKey, timeoutMs = 6500 } = args;

  const qParts = [
    `intitle:${title}`,
    author ? `inauthor:${author.split(",")[0].trim()}` : null,
  ].filter(Boolean);

  const q = qParts.join("+");
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books&langRestrict=en` +
    (apiKey ? `&key=${encodeURIComponent(apiKey)}` : "");

  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, timeoutMs);
  if (!res.ok) return null;

  const data: GoogleBooksResponse = await res.json();
  const items = data.items ?? [];
  if (!items.length) return null;

  // pick first item with description; fallback to first
  const best = items.find((x) => (x.volumeInfo?.description ?? "").trim().length > 80) ?? items[0];
  const vi = best.volumeInfo ?? {};

  const descRaw = (vi.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const description = descRaw ? firstSentences(descRaw, 520) : null;

  const image =
    vi.imageLinks?.thumbnail ??
    vi.imageLinks?.smallThumbnail ??
    null;

  return {
    id: best.id,
    description,
    categories: vi.categories ?? null,
    pageCount: typeof vi.pageCount === "number" ? vi.pageCount : null,
    averageRating: typeof vi.averageRating === "number" ? vi.averageRating : null,
    ratingsCount: typeof vi.ratingsCount === "number" ? vi.ratingsCount : null,
    url: vi.infoLink ?? null,
    image,
  };
}

// ============================================================
// Main
// ============================================================
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const started = Date.now();

  try {
    const TMDB_API_KEY = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
    if (!TMDB_API_KEY) return jsonResponse({ error: "TMDB_API_KEY not configured", version: VERSION }, 500);

    const GOOGLE_BOOKS_API_KEY = (Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "").trim(); // optional but recommended

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Safe mode = skip Google Books + OL work lookups
    const safeMode = Boolean(body?.safeMode);

    const debug: Record<string, unknown> = {
      version: VERSION,
      minYear: MIN_YEAR,
      safeMode,
      movies: 0,
      books: 0,
      googleBooksUsed: false,
      googleBooksHits: 0,
      olWorkDescHits: 0,
      ms: 0,
    };

    // 1) Fetch base lists
    const [genresRes, moviesRes, booksRes] = await Promise.allSettled([
      fetchMovieGenres(TMDB_API_KEY),
      fetchTrendingMovies(TMDB_API_KEY, 26),
      fetchOpenLibraryBooks(18),
    ]);

    // Handle errors gracefully - don't throw, log and continue
    if (genresRes.status !== "fulfilled") {
      console.error("Failed to fetch movie genres:", genresRes.reason);
      debug.genresError = String(genresRes.reason);
    }
    if (moviesRes.status !== "fulfilled") {
      console.error("Failed to fetch movies:", moviesRes.reason);
      debug.moviesError = String(moviesRes.reason);
    }
    if (booksRes.status !== "fulfilled") {
      console.error("Failed to fetch books:", booksRes.reason);
      debug.openLibraryError = String(booksRes.reason);
    }

    const genreMap = genresRes.status === "fulfilled" ? genresRes.value : {};
    const movies = moviesRes.status === "fulfilled" ? moviesRes.value : [];
    const booksDocs = booksRes.status === "fulfilled" ? booksRes.value : [];

    // If both sources failed, return empty feed with error info
    if (movies.length === 0 && booksDocs.length === 0) {
      debug.allSourcesFailed = true;
      return jsonResponse({
        feed: [],
        debug,
        error: "All content sources failed. Check API keys and network connectivity.",
      });
    }

    // 2) Normalize
    const movieCards = movies.map((m) => normalizeTMDBMovie(m, genreMap)).slice(0, 20);
    let bookCards = booksDocs.map(normalizeOpenLibraryBook).slice(0, 16);

    debug.movies = movieCards.length;
    debug.books = bookCards.length;

    // 3) Enrich books: OpenLibrary work description + Google Books description
    const toEnrich = bookCards.slice(0, 12);

    const enriched = await mapLimit(toEnrich, 3, async (card) => {
      try {
        const workKey = card.id.startsWith("ol:") ? card.id.slice(3) : card.id;

        let olDesc: string | null = null;
        let olSubjects: string[] | null = null;

        if (!safeMode) {
          try {
            const work = await fetchOpenLibraryWork(workKey);
            const desc = extractWorkDescription(work);
            olDesc = desc ? firstSentences(desc, 520) : null;
            olSubjects = work?.subjects?.slice(0, 18) ?? null;
          } catch (e) {
            console.error(`Failed to enrich OL work for ${card.id}:`, e);
            // Continue without enrichment
          }
        }

        let gb = null as Awaited<ReturnType<typeof fetchGoogleBooksBestMatch>>;
        if (!safeMode) {
          try {
            gb = await fetchGoogleBooksBestMatch({
              title: card.title,
              author: card.byline ?? null,
              apiKey: GOOGLE_BOOKS_API_KEY || null,
              timeoutMs: 6500,
            });
          } catch (e) {
            console.error(`Failed to enrich GB for ${card.id}:`, e);
            // Continue without enrichment
          }
        }

        return { id: card.id, olDesc, olSubjects, gb };
      } catch (e) {
        console.error(`Failed to enrich card ${card.id}:`, e);
        // Return empty enrichment
        return { id: card.id, olDesc: null, olSubjects: null, gb: null };
      }
    });

    let gbHits = 0;
    let olHits = 0;
    const enrichMap: Record<string, { olDesc: string | null; olSubjects: string[] | null; gb: any | null }> = {};
    for (const e of enriched) {
      enrichMap[e.id] = { olDesc: e.olDesc, olSubjects: e.olSubjects, gb: e.gb };
      if (e.olDesc) olHits++;
      if (e.gb?.description) gbHits++;
    }

    debug.googleBooksUsed = !safeMode;
    debug.googleBooksHits = gbHits;
    debug.olWorkDescHits = olHits;

    // 4) Merge enrichment back into books
    bookCards = bookCards.map((c) => {
      const e = enrichMap[c.id];

      const gbDesc = e?.gb?.description ?? null;
      const olDesc = e?.olDesc ?? null;

      // prefer GB desc if present (it’s usually cleaner)
      const bio = gbDesc || olDesc || null;

      const mergedTags = cleanTags(
        [
          ...(c.tags ?? []),
          ...((e?.olSubjects ?? []) as string[]),
          ...((e?.gb?.categories ?? []) as string[]),
        ],
        8,
      );

      const metaParts: string[] = [];
      if (c.meta) metaParts.push(c.meta);

      if (typeof e?.gb?.pageCount === "number") metaParts.push(`${e.gb.pageCount} pages`);
      if (typeof e?.gb?.averageRating === "number") {
        const rc = typeof e?.gb?.ratingsCount === "number" ? ` (${e.gb.ratingsCount})` : "";
        metaParts.push(`⭐ ${e.gb.averageRating.toFixed(1)}${rc}`);
      }

      return {
        ...c,
        source: e?.gb?.description ? "googlebooks" : c.source,
        bio,
        tags: mergedTags.length ? mergedTags : c.tags ?? null,
        meta: metaParts.length ? uniq(metaParts).join(" • ") : c.meta ?? null,
        image_url: c.image_url || e?.gb?.image || null,
        url: e?.gb?.url || c.url || null,
      } as FeedCard;
    });

    // 5) Final list: de-dupe similar titles across sources
    const all = movieCards.concat(bookCards);

    const seenTitle = new Set<string>();
    const deduped: FeedCard[] = [];
    for (const c of all) {
      const key = normalizeForCompare(c.title);
      if (!key) continue;
      if (seenTitle.has(key)) continue;
      seenTitle.add(key);
      deduped.push(c);
    }

    // quick shuffle
    const feed = deduped.sort(() => Math.random() - 0.5);

    debug.ms = Date.now() - started;
    return jsonResponse({ feed, debug });
  } catch (e) {
    const err = e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) };
    console.error("feed function error:", err);
    
    // Return proper error response but include debug info
    return jsonResponse({
      feed: [],
      error: err.message,
      debug: {
        version: VERSION,
        error: true,
        errorMessage: err.message,
        ms: Date.now() - started,
        ...(err.stack ? { stack: err.stack.substring(0, 500) } : {}), // Limit stack trace length
      },
    }, 500);
  }
});


















