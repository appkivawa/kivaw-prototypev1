// ============================================================
// Shared Tagging Module for Edge Functions
// ============================================================
// Simple, editable keyword-based tagging rules
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Types
// ============================================================

export type Mode = "reset" | "beauty" | "logic" | "faith" | "reflect" | "comfort";
export type Focus = "watch" | "read" | "create" | "move" | "music" | "reflect" | "reset";
export type TagResult = { modes: Mode[]; focus: Focus[] };

// ============================================================
// Editable Keyword Rules
// ============================================================
// To edit: Simply modify the arrays below
// ============================================================

export const MODE_KEYWORDS: Record<Mode, string[]> = {
  reset: [
    "reset", "calm", "peace", "quiet", "zen", "meditation", "mindfulness",
    "relax", "rest", "pause", "break", "breathe", "stillness", "silence"
  ],
  beauty: [
    "beauty", "aesthetic", "art", "visual", "design", "nature", "landscape",
    "photography", "cinematography", "gorgeous", "stunning", "breathtaking",
    "scenic", "picturesque", "elegant", "graceful"
  ],
  logic: [
    "science", "logic", "reason", "analysis", "thinking", "philosophy", "theory",
    "research", "study", "academic", "intellectual", "rational", "critical thinking",
    "problem solving", "mathematics", "physics", "engineering"
  ],
  faith: [
    "faith", "spiritual", "religion", "prayer", "god", "divine", "sacred",
    "bible", "scripture", "worship", "devotion", "blessing", "grace", "salvation",
    "heaven", "soul", "spirit", "holy"
  ],
  reflect: [
    "reflection", "introspection", "self", "awareness", "mindfulness", "journal",
    "diary", "thought", "contemplation", "meditation", "inner", "personal",
    "growth", "development", "insight", "wisdom"
  ],
  comfort: [
    "comfort", "cozy", "warm", "safe", "home", "family", "love", "care",
    "support", "healing", "recovery", "nurture", "gentle", "soft", "tender",
    "compassion", "empathy", "kindness", "hug"
  ],
};

// ============================================================
// Helper Functions
// ============================================================

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text.toLowerCase().trim();
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword));
}

// ============================================================
// Tagging Logic
// ============================================================

/**
 * Infer focus from content type
 * Simple rule: watch -> Watch, read -> Read
 */
export function inferFocusFromType(type: "watch" | "read" | "listen" | "event"): Focus {
  switch (type) {
    case "watch": return "watch";
    case "read": return "read";
    case "listen": return "music";
    case "event": return "move";
    default: return "watch";
  }
}

/**
 * Infer modes from content metadata
 * Searches title, description, genres, and categories for keyword matches
 */
export function inferModesFromContent(
  title: string | null,
  description: string | null,
  genres?: string[],
  categories?: string[]
): Mode[] {
  const modes: Set<Mode> = new Set();
  
  // Combine all searchable text
  const searchText = [
    normalizeText(title),
    normalizeText(description),
    ...(genres || []).map(normalizeText),
    ...(categories || []).map(normalizeText),
  ].join(" ");

  // Check each mode's keywords
  for (const [mode, keywords] of Object.entries(MODE_KEYWORDS)) {
    if (matchesKeywords(searchText, keywords)) {
      modes.add(mode as Mode);
    }
  }

  // Default to "comfort" if no modes matched
  if (modes.size === 0) {
    modes.add("comfort");
  }

  return Array.from(modes);
}

/**
 * Get tag overrides from database
 */
export async function getTagOverrides(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  providerId: string
): Promise<TagResult | null> {
  try {
    const { data, error } = await supabase
      .from("tag_overrides")
      .select("mode, focus")
      .eq("provider", provider)
      .eq("provider_id", providerId);

    if (error || !data || data.length === 0) return null;

    const modes = new Set<Mode>();
    const focus = new Set<Focus>();

    for (const row of data) {
      if (row.mode) modes.add(row.mode as Mode);
      if (row.focus) focus.add(row.focus as Focus);
    }

    return { modes: Array.from(modes), focus: Array.from(focus) };
  } catch {
    return null;
  }
}

/**
 * Compute tags for content (auto-tags + overrides merged)
 */
export async function computeTagsForContent(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  providerId: string,
  type: "watch" | "read" | "listen" | "event",
  title: string | null,
  description: string | null,
  genres?: string[],
  categories?: string[]
): Promise<TagResult> {
  // Step 1: Compute auto-tags
  const inferredFocus = inferFocusFromType(type);
  const inferredModes = inferModesFromContent(title, description, genres, categories);
  const autoTags: TagResult = { modes: inferredModes, focus: [inferredFocus] };

  // Step 2: Get overrides from database
  const overrides = await getTagOverrides(supabase, provider, providerId);
  
  if (!overrides) {
    // No overrides, return auto-tags
    return autoTags;
  }

  // Step 3: Merge auto-tags with overrides
  // Overrides are additive - they add to auto-tags, not replace them
  const mergedModes = new Set<Mode>([...autoTags.modes, ...overrides.modes]);
  const mergedFocus = new Set<Focus>([...autoTags.focus, ...overrides.focus]);
  
  return {
    modes: Array.from(mergedModes),
    focus: Array.from(mergedFocus),
  };
}

/**
 * Store tags in content_tags table
 * Deletes existing tags for the cache_id and inserts new ones
 */
export async function storeTagsForCache(
  supabase: ReturnType<typeof createClient>,
  cacheId: string,
  tags: TagResult
): Promise<void> {
  // Delete existing tags for this cache item
  await supabase.from("content_tags").delete().eq("cache_id", cacheId);

  // Build tag rows (cartesian product of modes × focus)
  const tagRows = [];
  for (const mode of tags.modes) {
    for (const focus of tags.focus) {
      tagRows.push({ cache_id: cacheId, mode, focus });
    }
  }

  // Insert new tags
  if (tagRows.length > 0) {
    await supabase.from("content_tags").upsert(tagRows, {
      onConflict: "cache_id,mode,focus",
      ignoreDuplicates: false,
    });
  }
}
