import { supabase } from "../lib/supabaseClient";
import { fetchMovies, fetchBooks } from "./providers/externalProviders";

// ============================================================
// Types
// ============================================================

export type State = "blank" | "destructive" | "expansive" | "minimize";
export type Mode = "reset" | "beauty" | "logic" | "faith" | "reflect" | "comfort";
export type Focus = "watch" | "read" | "create" | "move" | "music" | "reflect" | "reset";

export type RecommendationContext = {
  state: State;
  mode: Mode;
  focus: Focus;
};

export type ScoreBreakdown = {
  modeMatch: number; // +50 if mode matches
  focusMatch: number; // +25 if focus matches
  stateWeight: number; // State->mode compatibility bonus
  freshness: number; // Newer content gets boost
  popularity: number; // From raw data (TMDB vote_count, etc.)
  total: number;
};

export type ScoredExternalContent = {
  id: string;
  provider: string;
  provider_id: string;
  type: "watch" | "read" | "listen" | "event";
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  fetched_at: string | null;
  raw: Record<string, unknown>;
  tags: {
    modes: Mode[];
    focus: Focus[];
  };
  score: number;
  scoreBreakdown: ScoreBreakdown;
};

// ============================================================
// State->Mode Compatibility Table (editable)
// ============================================================

/**
 * State->Mode compatibility weights
 * Higher values = stronger compatibility
 * Edit this table to adjust state-mode relationships
 */
const STATE_MODE_WEIGHTS: Record<State, Partial<Record<Mode, number>>> = {
  blank: {
    reset: 20,
    comfort: 15,
    reflect: 10,
    beauty: 5,
  },
  destructive: {
    reflect: 20,
    reset: 15,
    comfort: 10,
    logic: 5,
  },
  expansive: {
    beauty: 20,
    logic: 15,
    reflect: 10,
    faith: 5,
  },
  minimize: {
    reset: 20,
    comfort: 15,
    reflect: 10,
    beauty: 5,
  },
};

// ============================================================
// Scoring Functions
// ============================================================

/**
 * Calculate freshness bonus based on fetched_at timestamp
 * Newer content gets higher bonus (max 10 points)
 */
function calculateFreshnessBonus(fetchedAt: string | null): number {
  if (!fetchedAt) return 0;

  try {
    const fetched = new Date(fetchedAt).getTime();
    const now = Date.now();
    const ageDays = (now - fetched) / (1000 * 60 * 60 * 24);

    // Content fetched in last 7 days gets full bonus
    if (ageDays <= 7) return 10;
    // Content fetched in last 30 days gets partial bonus
    if (ageDays <= 30) return 5;
    // Content older than 30 days gets minimal bonus
    if (ageDays <= 90) return 2;
    // Very old content gets no bonus
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Extract popularity score from raw data
 * Supports TMDB (vote_average, vote_count) and other providers
 * Returns normalized score (0-15 points)
 */
function calculatePopularityBonus(raw: Record<string, unknown>): number {
  let score = 0;

  // TMDB format: vote_average (0-10) and vote_count
  if (raw.vote_average && typeof raw.vote_average === "number") {
    const voteAvg = raw.vote_average;
    const voteCount = (raw.vote_count as number) || 0;

    // Normalize vote_average (0-10) to (0-10 points)
    score += voteAvg;

    // Add bonus for high vote count (indicates popularity)
    if (voteCount > 1000) score += 3;
    else if (voteCount > 500) score += 2;
    else if (voteCount > 100) score += 1;

    // Cap at 15 points
    return Math.min(score, 15);
  }

  // Google Books: averageRating (0-5) and ratingsCount
  const volumeInfo = raw.volumeInfo as Record<string, unknown> | undefined;
  if (volumeInfo?.averageRating && typeof volumeInfo.averageRating === "number") {
    const avgRating = volumeInfo.averageRating;
    const ratingsCount = (volumeInfo.ratingsCount as number) || 0;

    // Normalize averageRating (0-5) to (0-10 points)
    score += avgRating * 2;

    // Add bonus for high ratings count
    if (ratingsCount > 1000) score += 3;
    else if (ratingsCount > 500) score += 2;
    else if (ratingsCount > 100) score += 1;

    return Math.min(score, 15);
  }

  return 0;
}

/**
 * Calculate state->mode compatibility weight
 */
function calculateStateWeight(state: State, modes: Mode[]): number {
  const weights = STATE_MODE_WEIGHTS[state] || {};
  let totalWeight = 0;

  for (const mode of modes) {
    totalWeight += weights[mode] || 0;
  }

  return totalWeight;
}

/**
 * Score a single content item based on context
 */
export function scoreContent(
  item: {
    tags: { modes: Mode[]; focus: Focus[] };
    fetched_at: string | null;
    raw: Record<string, unknown>;
  },
  context: RecommendationContext
): ScoreBreakdown {
  const { state, mode, focus } = context;
  const { tags } = item;

  // +50 if content has selected mode tag
  const modeMatch = tags.modes.includes(mode) ? 50 : 0;

  // +25 if content focus matches selected focus
  const focusMatch = tags.focus.includes(focus) ? 25 : 0;

  // +state weights based on state->mode compatibility
  const stateWeight = calculateStateWeight(state, tags.modes);

  // +freshness bonus (newer content gets boost)
  const freshness = calculateFreshnessBonus(item.fetched_at);

  // +popularity if available from raw
  const popularity = calculatePopularityBonus(item.raw);

  const total = modeMatch + focusMatch + stateWeight + freshness + popularity;

  return {
    modeMatch,
    focusMatch,
    stateWeight,
    freshness,
    popularity,
    total,
  };
}

// ============================================================
// Recommendation Functions
// ============================================================

/**
 * Get cached external content with tags
 */
async function getCachedContentWithTags(
  focus?: Focus,
  mode?: Mode
): Promise<ScoredExternalContent[]> {
  // Step 1: Query content_tags to find matching cache_ids
  let tagQuery = supabase.from("content_tags").select("cache_id, mode, focus");

  if (focus) {
    tagQuery = tagQuery.eq("focus", focus);
  }
  if (mode) {
    tagQuery = tagQuery.eq("mode", mode);
  }

  const { data: tagData, error: tagError } = await tagQuery;

  if (tagError) {
    console.error("[externalRecommendations] Error fetching tags:", tagError);
    return [];
  }

  if (!tagData || tagData.length === 0) {
    return [];
  }

  // Step 2: Get unique cache_ids
  const cacheIds = Array.from(new Set(tagData.map((t) => t.cache_id)));

  // Step 3: Query external_content_cache for those IDs
  const { data: cacheData, error: cacheError } = await supabase
    .from("external_content_cache")
    .select("id, provider, provider_id, type, title, description, image_url, url, fetched_at, raw")
    .in("id", cacheIds);

  if (cacheError) {
    console.error("[externalRecommendations] Error fetching cached content:", cacheError);
    return [];
  }

  if (!cacheData) return [];

  // Step 4: Build map of cache_id -> tags
  const tagsByCacheId = new Map<string, { modes: Mode[]; focus: Focus[] }>();

  for (const tag of tagData) {
    const cacheId = tag.cache_id;
    if (!tagsByCacheId.has(cacheId)) {
      tagsByCacheId.set(cacheId, { modes: [], focus: [] });
    }
    const tags = tagsByCacheId.get(cacheId)!;
    if (tag.mode && !tags.modes.includes(tag.mode as Mode)) {
      tags.modes.push(tag.mode as Mode);
    }
    if (tag.focus && !tags.focus.includes(tag.focus as Focus)) {
      tags.focus.push(tag.focus as Focus);
    }
  }

  // Step 5: Combine cache data with tags
  const items: ScoredExternalContent[] = cacheData.map((row) => {
    const tags = tagsByCacheId.get(row.id) || { modes: [], focus: [] };

    return {
      id: row.id,
      provider: row.provider,
      provider_id: row.provider_id,
      type: row.type as "watch" | "read" | "listen" | "event",
      title: row.title,
      description: row.description,
      image_url: row.image_url,
      url: row.url,
      fetched_at: row.fetched_at,
      raw: row.raw as Record<string, unknown>,
      tags,
      score: 0,
      scoreBreakdown: {
        modeMatch: 0,
        focusMatch: 0,
        stateWeight: 0,
        freshness: 0,
        popularity: 0,
        total: 0,
      },
    };
  });

  return items;
}

/**
 * Get recommendations from external cached content
 * 
 * @param context - Recommendation context (state, mode, focus)
 * @param limit - Maximum number of results (default: 12)
 * @param fetchFresh - If true, fetch fresh content from edge functions before querying cache
 * @returns Array of scored external content items
 */
export async function getExternalRecommendations(
  context: RecommendationContext,
  limit = 12,
  fetchFresh = false
): Promise<ScoredExternalContent[]> {
  const { mode, focus } = context;

  // Optionally fetch fresh content to populate cache
  if (fetchFresh) {
    try {
      if (focus === "watch") {
        await fetchMovies({ limit: 20 });
      } else if (focus === "read") {
        await fetchBooks({ limit: 20 });
      }
    } catch (err) {
      console.warn("[externalRecommendations] Error fetching fresh content:", err);
      // Continue with cache query even if fresh fetch fails
    }
  }

  // Try to get content matching both mode and focus
  let items = await getCachedContentWithTags(focus, mode);

  // Fallback: if no results, try matching focus only
  if (items.length === 0) {
    items = await getCachedContentWithTags(focus);
  }

  // Score all items
  const scored = items.map((item) => {
    const breakdown = scoreContent(item, context);
    return {
      ...item,
      score: breakdown.total,
      scoreBreakdown: breakdown,
    };
  });

  // Sort by score (descending), then by freshness
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    // Tie-breaker: prefer newer content
    const aFetched = a.fetched_at ? new Date(a.fetched_at).getTime() : 0;
    const bFetched = b.fetched_at ? new Date(b.fetched_at).getTime() : 0;
    return bFetched - aFetched;
  });

  // Return top N
  return scored.slice(0, limit);
}

/**
 * Get recommendations with explainability (score breakdown)
 * Same as getExternalRecommendations but with explicit score breakdown
 */
export async function getExternalRecommendationsWithBreakdown(
  context: RecommendationContext,
  limit = 12
): Promise<ScoredExternalContent[]> {
  return getExternalRecommendations(context, limit);
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Convert ScoredExternalContent to ContentItem format for UI compatibility
 */
export function externalToContentItem(item: ScoredExternalContent) {
  return {
    id: `${item.provider}_${item.provider_id}`,
    external_id: item.provider_id,
    kind: item.type === "watch" ? "Visual" : item.type === "read" ? "Book" : "Other",
    title: item.title,
    byline: item.provider === "tmdb" ? "TMDB" : "Google Books",
    meta: item.type,
    image_url: item.image_url,
    url: item.url,
    source: item.provider,
    state_tags: null, // External content doesn't have state_tags
    focus_tags: item.tags.focus,
    usage_tags: null, // External content doesn't have usage_tags
    created_at: item.fetched_at || new Date().toISOString(),
    _score: item.score,
    _scoreBreakdown: item.scoreBreakdown,
  };
}

/**
 * Get state->mode compatibility weights (for admin UI)
 */
export function getStateModeWeights(): Record<State, Partial<Record<Mode, number>>> {
  return STATE_MODE_WEIGHTS;
}

