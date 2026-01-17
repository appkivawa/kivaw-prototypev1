// ============================================================
// Shared Tag Helpers for Feed Items
// ============================================================
// Provides normalizeTag() and derivation functions for RSS, TMDB, Books
// ============================================================

/**
 * Normalize a tag: lowercase, trim, replace spaces with hyphens, dedupe
 */
export function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag || typeof tag !== "string") return null;
  let normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  normalized = normalized.replace(/[\s_]+/g, "-");
  normalized = normalized.replace(/[^a-z0-9\-\.]/g, "");
  normalized = normalized.replace(/^[\-\.]+|[\-\.]+$/g, "");
  if (normalized.length < 2) return null;
  if (normalized.length > 50) normalized = normalized.slice(0, 50);
  return normalized;
}

/**
 * Normalize and dedupe an array of tags
 */
export function normalizeTags(tags: (string | null | undefined)[]): string[] {
  const normalized = tags.map(normalizeTag).filter((tag): tag is string => tag !== null);
  return Array.from(new Set(normalized));
}

/**
 * Extract keywords from text (simple word-based extraction)
 */
export function extractKeywordsFromText(text: string | null | undefined, maxKeywords = 5): string[] {
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

/**
 * Derive tags from RSS item
 */
export function deriveTagsFromRssItem(item: { categories?: string[] | string | null; title?: string | null; summary?: string | null }): string[] {
  const tags: string[] = [];
  if (item.categories) {
    const cats = Array.isArray(item.categories) ? item.categories : [item.categories];
    tags.push(...normalizeTags(cats));
  }
  if (tags.length < 3) {
    const text = [item.title, item.summary].filter(Boolean).join(" ");
    const keywords = extractKeywordsFromText(text, 5);
    tags.push(...keywords);
  }
  return Array.from(new Set(tags)).slice(0, 10);
}

/**
 * Derive tags from TMDB movie/TV data
 */
export function deriveTagsFromTmdb(tmdbData: { genres?: Array<{ id?: number; name?: string }> | null; genre_ids?: number[] | null; genreMap?: Record<number, string> | null }): string[] {
  const tags: string[] = [];
  if (Array.isArray(tmdbData.genres)) {
    for (const genre of tmdbData.genres) {
      if (genre?.name) {
        const normalized = normalizeTag(genre.name);
        if (normalized) tags.push(normalized);
      }
    }
  }
  if (tags.length === 0 && Array.isArray(tmdbData.genre_ids) && tmdbData.genreMap) {
    for (const id of tmdbData.genre_ids) {
      const genreName = tmdbData.genreMap[id];
      if (genreName) {
        const normalized = normalizeTag(genreName);
        if (normalized) tags.push(normalized);
      }
    }
  }
  return Array.from(new Set(tags)).slice(0, 10);
}

/**
 * Derive tags from book data
 */
export function deriveTagsFromBook(bookData: { categories?: string[] | null; subjects?: string[] | null }): string[] {
  const tags: string[] = [];
  if (Array.isArray(bookData.categories)) tags.push(...normalizeTags(bookData.categories));
  if (Array.isArray(bookData.subjects)) tags.push(...normalizeTags(bookData.subjects));
  return Array.from(new Set(tags)).slice(0, 10);
}

// Shared Tag Helpers for Feed Items
// ============================================================
// Provides normalizeTag() and derivation functions for RSS, TMDB, Books
// ============================================================

/**
 * Normalize a tag: lowercase, trim, replace spaces with hyphens, dedupe
 * @param tag Raw tag string
 * @returns Normalized tag or null if invalid
 */
export function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag || typeof tag !== "string") return null;
  
  // Trim and lowercase
  let normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  
  // Replace spaces and underscores with hyphens
  normalized = normalized.replace(/[\s_]+/g, "-");
  
  // Remove invalid characters (keep alphanumeric, hyphens, dots)
  normalized = normalized.replace(/[^a-z0-9\-\.]/g, "");
  
  // Remove leading/trailing hyphens and dots
  normalized = normalized.replace(/^[\-\.]+|[\-\.]+$/g, "");
  
  // Must be at least 2 characters
  if (normalized.length < 2) return null;
  
  // Max length 50
  if (normalized.length > 50) normalized = normalized.slice(0, 50);
  
  return normalized;
}

/**
 * Normalize and dedupe an array of tags
 * @param tags Array of raw tag strings
 * @returns Array of normalized, unique tags
 */
export function normalizeTags(tags: (string | null | undefined)[]): string[] {
  const normalized = tags
    .map(normalizeTag)
    .filter((tag): tag is string => tag !== null);
  
  // Dedupe using Set
  return Array.from(new Set(normalized));
}

/**
 * Extract keywords from text (simple word-based extraction)
 * @param text Text to extract keywords from
 * @param maxKeywords Maximum number of keywords to return
 * @returns Array of normalized keywords
 */
export function extractKeywordsFromText(
  text: string | null | undefined,
  maxKeywords = 5
): string[] {
  if (!text || typeof text !== "string") return [];
  
  // Remove HTML tags
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  
  // Common stop words to filter out
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "can", "this",
    "that", "these", "those", "it", "its", "they", "them", "their", "what",
    "which", "who", "when", "where", "why", "how", "all", "each", "every",
    "some", "any", "no", "not", "only", "just", "more", "most", "very",
    "too", "so", "than", "then", "there", "here", "up", "down", "out",
    "off", "over", "under", "again", "further", "once", "twice", "about",
    "above", "across", "after", "against", "along", "among", "around",
    "before", "behind", "below", "beneath", "beside", "between", "beyond",
    "during", "except", "inside", "into", "near", "outside", "through",
    "throughout", "toward", "towards", "underneath", "upon", "within",
    "without", "i", "you", "he", "she", "we", "me", "him", "her", "us",
  ]);
  
  // Split into words, filter stop words and short words
  const words = clean
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  
  // Count word frequencies
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  // Sort by frequency (desc) then alphabetically
  const sorted = Array.from(freq.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // Higher frequency first
      return a[0].localeCompare(b[0]); // Then alphabetically
    })
    .slice(0, maxKeywords)
    .map(([word]) => word);
  
  // Normalize each keyword
  return normalizeTags(sorted);
}

/**
 * Derive tags from RSS item
 * Priority: categories → keywords from title
 * @param item RSS item with categories and title
 * @returns Array of normalized tags
 */
export function deriveTagsFromRssItem(item: {
  categories?: string[] | string | null;
  title?: string | null;
  summary?: string | null;
}): string[] {
  const tags: string[] = [];
  
  // 1. Extract from categories
  if (item.categories) {
    const cats = Array.isArray(item.categories) ? item.categories : [item.categories];
    tags.push(...normalizeTags(cats));
  }
  
  // 2. If no categories or too few, extract keywords from title + summary
  if (tags.length < 3) {
    const text = [item.title, item.summary].filter(Boolean).join(" ");
    const keywords = extractKeywordsFromText(text, 5);
    tags.push(...keywords);
  }
  
  // Dedupe and limit to 10 tags
  return Array.from(new Set(tags)).slice(0, 10);
}

/**
 * Derive tags from TMDB movie/TV data
 * Maps TMDB genres to tags
 * @param tmdbData TMDB movie or TV data with genres
 * @returns Array of normalized tags
 */
export function deriveTagsFromTmdb(tmdbData: {
  genres?: Array<{ id?: number; name?: string }> | null;
  genre_ids?: number[] | null;
  genreMap?: Record<number, string> | null;
}): string[] {
  const tags: string[] = [];
  
  // Extract genre names
  if (Array.isArray(tmdbData.genres)) {
    for (const genre of tmdbData.genres) {
      if (genre?.name) {
        const normalized = normalizeTag(genre.name);
        if (normalized) tags.push(normalized);
      }
    }
  }
  
  // If genre_ids provided but no genre names, use genreMap
  if (tags.length === 0 && Array.isArray(tmdbData.genre_ids) && tmdbData.genreMap) {
    for (const id of tmdbData.genre_ids) {
      const genreName = tmdbData.genreMap[id];
      if (genreName) {
        const normalized = normalizeTag(genreName);
        if (normalized) tags.push(normalized);
      }
    }
  }
  
  // Dedupe and limit to 10 tags
  return Array.from(new Set(tags)).slice(0, 10);
}

/**
 * Derive tags from book data (Open Library or Google Books)
 * Maps categories/subjects to tags
 * @param bookData Book data with categories or subjects
 * @returns Array of normalized tags
 */
export function deriveTagsFromBook(bookData: {
  categories?: string[] | null;
  subjects?: string[] | null;
}): string[] {
  const tags: string[] = [];
  
  // Extract from categories (Google Books)
  if (Array.isArray(bookData.categories)) {
    tags.push(...normalizeTags(bookData.categories));
  }
  
  // Extract from subjects (Open Library)
  if (Array.isArray(bookData.subjects)) {
    tags.push(...normalizeTags(bookData.subjects));
  }
  
  // Dedupe and limit to 10 tags
  return Array.from(new Set(tags)).slice(0, 10);
}

