// ============================================================
// EXPLAINABILITY - Generate "why" strings
// ============================================================

import type { ContentItem, UserState } from "./types";
import { getScoreBreakdown, type ScoreBreakdown } from "./scoring";
import type { ScoringContext } from "./scoring";

// ============================================================
// Generate "why" explanation
// ============================================================

export function explainRecommendation(
  item: ContentItem,
  context: ScoringContext,
  breakdown: ScoreBreakdown
): string {
  const { state, timeAvailableMin, energyLevel, noHeavy } = context;

  // Find top 2 contributing factors
  const factors = [
    { name: "mood", score: breakdown.mood, weight: 35 },
    { name: "time", score: breakdown.time, weight: 20 },
    { name: "energy", score: breakdown.energy, weight: 20 },
    { name: "preference", score: breakdown.preference, weight: 15 },
    { name: "quality", score: breakdown.quality, weight: 10 },
  ];

  // Sort by weighted contribution
  const sortedFactors = factors
    .map((f) => ({
      name: f.name,
      contribution: f.score * (f.weight / 100),
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const topFactor = sortedFactors[0];
  const secondFactor = sortedFactors[1];

  // Build explanation based on top factors and state
  const parts: string[] = [];

  // State-specific opening
  switch (state) {
    case "blank":
      if (item.intensity < 0.3) {
        parts.push("Gentle");
      } else {
        parts.push("Low-stakes");
      }
      break;
    case "destructive":
      if (item.intensity > 0.6) {
        parts.push("High-energy");
      } else {
        parts.push("Cathartic");
      }
      break;
    case "expansive":
      if (item.novelty > 0.6) {
        parts.push("Curiosity-forward");
      } else {
        parts.push("Growth-oriented");
      }
      break;
    case "minimize":
      if (item.intensity < 0.2) {
        parts.push("Calming");
      } else {
        parts.push("Simple");
      }
      break;
  }

  // Add top contributing factors
  if (topFactor.name === "time" && item.duration_min) {
    if (item.duration_min <= timeAvailableMin) {
      parts.push(`fits your ${item.duration_min}-min window`);
    } else {
      parts.push(`within your time range`);
    }
  } else if (topFactor.name === "energy") {
    if (energyLevel <= 2 && item.intensity < 0.4) {
      parts.push("matches your energy");
    } else if (energyLevel >= 4 && item.intensity > 0.5) {
      parts.push("matches your energy");
    }
  } else if (topFactor.name === "quality" && item.rating) {
    if (item.rating > 0.7) {
      parts.push("high-rated");
    } else {
      parts.push("well-regarded");
    }
  } else if (topFactor.name === "preference") {
    parts.push("aligns with your preferences");
  }

  // Add second factor if significant
  if (secondFactor && secondFactor.contribution > 10) {
    if (secondFactor.name === "time" && topFactor.name !== "time") {
      parts.push(`+ fits your time`);
    } else if (secondFactor.name === "quality" && topFactor.name !== "quality") {
      parts.push(`+ quality content`);
    }
  }

  // Add intensity descriptor if relevant
  if (item.intensity < 0.25 && state === "minimize") {
    parts.push("low-stimulation");
  } else if (item.intensity > 0.7 && state === "destructive") {
    parts.push("high-intensity");
  }

  // Fallback if no good explanation
  if (parts.length === 0) {
    return `Good fit for ${state}`;
  }

  return parts.join(" + ") + ".";
}






