// src/lib/itemTypes.ts
// Shared item type system for consistent counting and filtering across feed items, saved items, and echoes.

/**
 * Normalized item types used throughout the application.
 * These are the canonical types that all item type strings should map to.
 */
export type ItemType =
  | "NEWS"
  | "SOCIAL"
  | "PODCAST"
  | "MUSIC"
  | "MOVIE"
  | "TV"
  | "BOOK"
  | "ARTICLE"
  | "ALBUM"
  | "EVENT";

/**
 * Type map for easy lookup and iteration
 */
export const ITEM_TYPES: Record<ItemType, ItemType> = {
  NEWS: "NEWS",
  SOCIAL: "SOCIAL",
  PODCAST: "PODCAST",
  MUSIC: "MUSIC",
  MOVIE: "MOVIE",
  TV: "TV",
  BOOK: "BOOK",
  ARTICLE: "ARTICLE",
  ALBUM: "ALBUM",
  EVENT: "EVENT",
};

/**
 * Normalizes an item's type/kind/source into a canonical ItemType.
 * 
 * This function handles various input formats:
 * - kind field: "watch", "read", "listen", "event", "book", "movie", etc.
 * - source field: "tmdb", "open_library", "spotify", "rss", "reddit", etc.
 * - Combined inference from title, tags, and other metadata
 * 
 * @param item - Object with kind, source, title, tags, or other type indicators
 * @returns Normalized ItemType
 */
export function normalizeItemType(item: {
  kind?: string | null;
  source?: string | null;
  title?: string | null;
  tags?: string[] | null;
  [key: string]: any; // Allow additional fields for inference
}): ItemType {
  const kind = (item.kind || "").toLowerCase().trim();
  const source = (item.source || "").toLowerCase().trim();
  const title = (item.title || "").toLowerCase().trim();
  const tags = Array.isArray(item.tags) ? item.tags.map((t) => String(t).toLowerCase()).join(" ") : "";
  
  // Combined haystack for pattern matching
  const hay = `${kind} ${source} ${title} ${tags}`.toLowerCase();

  // Explicit kind mappings (most reliable)
  if (kind === "watch" || kind === "movie" || kind === "tv" || kind === "film") {
    if (hay.includes("tv") || hay.includes("show") || hay.includes("series")) return "TV";
    return "MOVIE";
  }
  if (kind === "read" || kind === "book") return "BOOK";
  if (kind === "listen" || kind === "music" || kind === "album" || kind === "track" || kind === "song") {
    if (hay.includes("album") || hay.includes("spotify")) return "ALBUM";
    return "MUSIC";
  }
  if (kind === "event" || kind === "activity") return "EVENT";
  if (kind === "podcast" || kind === "episode") return "PODCAST";
  if (kind === "article" || kind === "news") return "ARTICLE";
  if (kind === "social" || kind === "post") return "SOCIAL";

  // Source-based inference
  if (source.includes("tmdb")) {
    if (hay.includes("tv") || hay.includes("show") || hay.includes("series")) return "TV";
    return "MOVIE";
  }
  if (source.includes("open_library") || source.includes("google_books") || source.includes("book")) return "BOOK";
  if (source.includes("spotify") || source.includes("music")) {
    if (hay.includes("album")) return "ALBUM";
    return "MUSIC";
  }
  if (source.includes("reddit") || source.includes("twitter") || source.includes("social")) return "SOCIAL";
  if (source.includes("rss") || source.includes("news")) return "NEWS";
  if (source.includes("podcast") || source.includes("episode")) return "PODCAST";
  if (source.includes("youtube") || source.includes("video")) {
    // YouTube could be various types, check content
    if (hay.includes("podcast")) return "PODCAST";
    if (hay.includes("music") || hay.includes("song")) return "MUSIC";
    return "MOVIE"; // Default YouTube to video content
  }

  // Pattern-based inference (fallback)
  if (hay.includes("podcast") || hay.includes("episode")) return "PODCAST";
  if (hay.includes("album") && (hay.includes("music") || hay.includes("spotify"))) return "ALBUM";
  if (hay.includes("music") || hay.includes("song") || hay.includes("track") || hay.includes("spotify")) return "MUSIC";
  if (hay.includes("tv") || hay.includes("show") || hay.includes("series")) return "TV";
  if (hay.includes("movie") || hay.includes("film") || hay.includes("cinema")) return "MOVIE";
  if (hay.includes("book") || hay.includes("read") || hay.includes("novel") || hay.includes("author")) return "BOOK";
  if (hay.includes("article") || hay.includes("news") || hay.includes("rss")) return "ARTICLE";
  if (hay.includes("reddit") || hay.includes("twitter") || hay.includes("social") || hay.includes("post")) return "SOCIAL";
  if (hay.includes("event") || hay.includes("activity") || hay.includes("calendar")) return "EVENT";

  // Default fallback
  return "NEWS";
}

/**
 * Maps ItemType to channel filter type (for Timeline sidebar)
 */
export function itemTypeToChannel(itemType: ItemType): "news" | "social" | "podcast" | "music" | "tv_movies" {
  switch (itemType) {
    case "NEWS":
    case "ARTICLE":
      return "news";
    case "SOCIAL":
      return "social";
    case "PODCAST":
      return "podcast";
    case "MUSIC":
    case "ALBUM":
      return "music";
    case "MOVIE":
    case "TV":
      return "tv_movies";
    default:
      return "news";
  }
}

/**
 * Maps ItemType to library filter type (for Collection sidebar)
 */
export function itemTypeToLibrary(itemType: ItemType): "books" | "movies_tv" | "music" | null {
  switch (itemType) {
    case "BOOK":
      return "books";
    case "MOVIE":
    case "TV":
      return "movies_tv";
    case "MUSIC":
    case "ALBUM":
      return "music";
    default:
      return null; // Not a library item
  }
}

/**
 * Gets a display label for an ItemType
 */
export function getItemTypeLabel(itemType: ItemType): string {
  switch (itemType) {
    case "NEWS":
      return "News";
    case "SOCIAL":
      return "Social";
    case "PODCAST":
      return "Podcast";
    case "MUSIC":
      return "Music";
    case "MOVIE":
      return "Movie";
    case "TV":
      return "TV";
    case "BOOK":
      return "Book";
    case "ARTICLE":
      return "Article";
    case "ALBUM":
      return "Album";
    case "EVENT":
      return "Event";
  }
}
