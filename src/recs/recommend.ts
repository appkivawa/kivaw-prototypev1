// ============================================================
// MAIN RECOMMENDATION ENGINE
// ============================================================

import type { ContentItem, Recommendation, RecommendationRequest, UserPreferences } from "./types";
import { scoreItem, getScoreBreakdown } from "./scoring";
import { diversifyRecommendations } from "./diversity";
import { explainRecommendation } from "./explain";
import type { ScoringContext } from "./scoring";

// ============================================================
// Recommendation Engine
// ============================================================

export interface RecommendationResult {
  recommendations: Recommendation[];
  metadata: {
    totalCandidates: number;
    state: string;
    focus: string;
  };
}

export async function generateRecommendations(
  request: RecommendationRequest,
  candidateItems: ContentItem[],
  userPrefs: UserPreferences
): Promise<RecommendationResult> {
  // Build scoring context
  const context: ScoringContext = {
    state: request.state,
    focus: request.focus,
    timeAvailableMin: request.timeAvailableMin,
    energyLevel: request.energyLevel,
    noHeavy: request.noHeavy,
    userPrefs,
  };

  // Filter candidates by focus if needed
  let filteredCandidates = candidateItems;
  if (request.focus !== "music" && request.focus !== "watch" && request.focus !== "read") {
    // For move/create/reset, only include those types
    const focusTypeMap: Record<string, string> = {
      move: "move",
      create: "create",
      reset: "reset",
    };
    const targetType = focusTypeMap[request.focus];
    if (targetType) {
      filteredCandidates = candidateItems.filter((item) => item.type === targetType);
    }
  } else {
    // For music/watch/read, include those types plus some others
    const allowedTypes: string[] = [request.focus];
    if (request.focus === "music") allowedTypes.push("listen");
    if (request.focus === "watch") allowedTypes.push("watch");
    if (request.focus === "read") allowedTypes.push("read");
    filteredCandidates = candidateItems.filter((item) => allowedTypes.includes(item.type));
  }

  // Score all candidates
  const scoredItems = filteredCandidates.map((item) => ({
    item,
    score: scoreItem(item, context),
  }));

  // Diversify and select top N
  const diversified = diversifyRecommendations(scoredItems, 12);

  // Add explanations
  const recommendations: Recommendation[] = diversified.map((rec) => {
    const item = filteredCandidates.find((c) => c.id === rec.id)!;
    const breakdown = getScoreBreakdown(item, context);
    const why = explainRecommendation(item, context, breakdown);

    return {
      ...rec,
      why,
    };
  });

  return {
    recommendations,
    metadata: {
      totalCandidates: filteredCandidates.length,
      state: request.state,
      focus: request.focus,
    },
  };
}









