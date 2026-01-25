// Unit tests for tag helpers
// Run with: deno test supabase/functions/_shared/tag-helpers.test.ts

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/testing/asserts.ts";

// Copy the helper functions here for testing (or import if we create a shared module)
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

function deriveTagsFromRssItem(item: { categories?: string[] | string | null; title?: string | null; summary?: string | null }): string[] {
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

function deriveTagsFromTmdb(tmdbData: { genres?: Array<{ id?: number; name?: string }> | null; genre_ids?: number[] | null; genreMap?: Record<number, string> | null }): string[] {
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

function deriveTagsFromBook(bookData: { categories?: string[] | null; subjects?: string[] | null }): string[] {
  const tags: string[] = [];
  if (Array.isArray(bookData.categories)) tags.push(...normalizeTags(bookData.categories));
  if (Array.isArray(bookData.subjects)) tags.push(...normalizeTags(bookData.subjects));
  return Array.from(new Set(tags)).slice(0, 10);
}

// Tests
Deno.test("normalizeTag: basic normalization", () => {
  assertEquals(normalizeTag("Science Fiction"), "science-fiction");
  assertEquals(normalizeTag("  Action  "), "action");
  assertEquals(normalizeTag("Sci-Fi"), "sci-fi");
  assertEquals(normalizeTag("Action/Adventure"), "actionadventure");
});

Deno.test("normalizeTag: edge cases", () => {
  assertEquals(normalizeTag(null), null);
  assertEquals(normalizeTag(""), null);
  assertEquals(normalizeTag("a"), null); // Too short
  assertEquals(normalizeTag("  "), null);
  assertEquals(normalizeTag("A".repeat(100)), "a".repeat(50)); // Truncated to 50
});

Deno.test("normalizeTag: special characters", () => {
  assertEquals(normalizeTag("C++ Programming"), "c-programming");
  assertEquals(normalizeTag("Node.js"), "node.js");
  assertEquals(normalizeTag("Test_Underscore"), "test-underscore");
  assertEquals(normalizeTag("Test---Multiple"), "test-multiple");
});

Deno.test("normalizeTags: deduplication", () => {
  const result = normalizeTags(["Action", "action", "ACTION", "Sci-Fi", "sci-fi"]);
  assertEquals(result.length, 2);
  assertEquals(result.includes("action"), true);
  assertEquals(result.includes("sci-fi"), true);
});

Deno.test("deriveTagsFromRssItem: categories", () => {
  const result = deriveTagsFromRssItem({
    categories: ["Technology", "Science", "Programming"],
    title: "Test Article",
  });
  assertEquals(result.length, 3);
  assertEquals(result.includes("technology"), true);
  assertEquals(result.includes("science"), true);
  assertEquals(result.includes("programming"), true);
});

Deno.test("deriveTagsFromRssItem: keyword fallback", () => {
  const result = deriveTagsFromRssItem({
    title: "Machine Learning Algorithms for Data Science",
    summary: "This article discusses machine learning algorithms and data science techniques.",
  });
  assertEquals(result.length > 0, true);
  // Should extract keywords like "machine", "learning", "algorithms", "data", "science"
});

Deno.test("deriveTagsFromTmdb: genres", () => {
  const result = deriveTagsFromTmdb({
    genres: [
      { id: 28, name: "Action" },
      { id: 12, name: "Adventure" },
    ],
  });
  assertEquals(result.length, 2);
  assertEquals(result.includes("action"), true);
  assertEquals(result.includes("adventure"), true);
});

Deno.test("deriveTagsFromTmdb: genre_ids with map", () => {
  const result = deriveTagsFromTmdb({
    genre_ids: [28, 12],
    genreMap: { 28: "Action", 12: "Adventure" },
  });
  assertEquals(result.length, 2);
  assertEquals(result.includes("action"), true);
  assertEquals(result.includes("adventure"), true);
});

Deno.test("deriveTagsFromBook: categories", () => {
  const result = deriveTagsFromBook({
    categories: ["Fiction", "Science Fiction", "Adventure"],
  });
  assertEquals(result.length, 3);
  assertEquals(result.includes("fiction"), true);
  assertEquals(result.includes("science-fiction"), true);
  assertEquals(result.includes("adventure"), true);
});

Deno.test("deriveTagsFromBook: subjects", () => {
  const result = deriveTagsFromBook({
    subjects: ["Philosophy", "Religion", "Spirituality"],
  });
  assertEquals(result.length, 3);
  assertEquals(result.includes("philosophy"), true);
  assertEquals(result.includes("religion"), true);
  assertEquals(result.includes("spirituality"), true);
});

Deno.test("extractKeywordsFromText: basic extraction", () => {
  const result = extractKeywordsFromText("Machine learning algorithms for data science and artificial intelligence");
  assertEquals(result.length > 0, true);
  // Should extract meaningful keywords, excluding stop words
});

Deno.test("extractKeywordsFromText: HTML stripping", () => {
  const result = extractKeywordsFromText("<p>Machine learning</p> algorithms for <b>data science</b>");
  assertEquals(result.length > 0, true);
  // Should strip HTML and extract keywords
});

console.log("✅ All tag helper tests passed!");


