import { getDbRecommendationsV2 } from "./recommendationsDb";
import type { ContentItem } from "./contentApi";
import {
  getExternalRecommendations,
  externalToContentItem,
  type RecommendationContext,
  type ScoredExternalContent,
} from "./externalRecommendations";

// ============================================================
// Unified Recommendations
// ============================================================

/**
 * Get unified recommendations from both internal DB and external cached content
 * 
 * @param state - User state (blank, destructive, expansive, minimize)
 * @param focus - User focus (watch, read, create, etc.)
 * @param mode - User mode (reset, beauty, logic, faith, reflect, comfort)
 * @param limit - Maximum number of results (default: 12)
 * @returns Combined array of ContentItem with scores
 */
export async function getUnifiedRecommendations(
  state: string,
  focus: string,
  mode: string,
  limit = 12
): Promise<ContentItem[]> {
  // Normalize inputs
  const normalizedState = state.toLowerCase().trim() as RecommendationContext["state"];
  const normalizedFocus = focus.toLowerCase().trim() as RecommendationContext["focus"];
  const normalizedMode = mode.toLowerCase().trim() as RecommendationContext["mode"];

  // Get internal DB recommendations
  const dbRecs = await getDbRecommendationsV2(normalizedState, normalizedFocus, limit);

  // Get external cached recommendations
  let externalRecs: ScoredExternalContent[] = [];
  try {
    externalRecs = await getExternalRecommendations(
      {
        state: normalizedState,
        mode: normalizedMode,
        focus: normalizedFocus,
      },
      Math.floor(limit / 2) // Get half from external, half from internal
    );
  } catch (err) {
    console.warn("[unifiedRecommendations] Error fetching external recommendations:", err);
    // Continue with DB recommendations only
  }

  // Convert external to ContentItem format
  const externalItems = externalRecs.map(externalToContentItem) as ContentItem[];

  // Combine and deduplicate by ID
  const allItems = [...dbRecs, ...externalItems];
  const seen = new Set<string>();
  const unique: ContentItem[] = [];

  for (const item of allItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }

  // Sort by score if available (external items have _score), then by created_at
  unique.sort((a, b) => {
    const aScore = (a as any)._score || 0;
    const bScore = (b as any)._score || 0;

    if (bScore !== aScore) return bScore - aScore;

    const aCreated = a.created_at || "";
    const bCreated = b.created_at || "";
    return bCreated.localeCompare(aCreated);
  });

  // Return top N
  return unique.slice(0, limit);
}

/**
 * Get recommendations with score breakdown (for admin/debugging)
 */
export async function getUnifiedRecommendationsWithScores(
  state: string,
  focus: string,
  mode: string,
  limit = 12
): Promise<Array<ContentItem & { _score?: number; _scoreBreakdown?: any }>> {
  const normalizedState = state.toLowerCase().trim() as RecommendationContext["state"];
  const normalizedFocus = focus.toLowerCase().trim() as RecommendationContext["focus"];
  const normalizedMode = mode.toLowerCase().trim() as RecommendationContext["mode"];

  // Get internal DB recommendations
  const dbRecs = await getDbRecommendationsV2(normalizedState, normalizedFocus, limit);

  // Get external cached recommendations with scores
  let externalRecs: ScoredExternalContent[] = [];
  try {
    externalRecs = await getExternalRecommendations(
      {
        state: normalizedState,
        mode: normalizedMode,
        focus: normalizedFocus,
      },
      Math.floor(limit / 2)
    );
  } catch (err) {
    console.warn("[unifiedRecommendations] Error fetching external recommendations:", err);
  }

  // Convert external to ContentItem format (preserving score breakdown)
  const externalItems: Array<ContentItem & { _score: number; _scoreBreakdown: any }> = externalRecs.map((item) => {
    const converted = externalToContentItem(item);
    return converted as ContentItem & { _score: number; _scoreBreakdown: any };
  });

  // Combine and deduplicate
  const allItems = [...dbRecs, ...externalItems];
  const seen = new Set<string>();
  const unique: Array<ContentItem & { _score?: number; _scoreBreakdown?: any }> = [];

  for (const item of allItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }

  // Sort by score
  unique.sort((a, b) => {
    const aScore = a._score || 0;
    const bScore = b._score || 0;
    return bScore - aScore;
  });

  return unique.slice(0, limit);
}

