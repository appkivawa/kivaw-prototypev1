// ============================================================
// KIVAW Recommendation Engine - Scoring Logic
// ============================================================

import { supabase } from "./supabaseClient";

import type {
  Activity,
  RecommendationInput,
  RecommendationResult,
  RecommendationReason,
  EnergyLevel,
} from "../types/recommendations";

/**
 * Get or create anonymous session ID from localStorage
 */
export function getSessionId(): string {
  const stored = localStorage.getItem("kivaw_session_id");
  if (stored) return stored;

  const newId = crypto.randomUUID();
  localStorage.setItem("kivaw_session_id", newId);
  return newId;
}

/**
 * Fetch activities from Supabase (local or hosted depending on env)
 */
export async function fetchActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Activity[];
}

/**
 * Score a single activity against recommendation criteria
 */
function scoreActivity(
  activity: Activity,
  input: RecommendationInput
): { score: number; reasons: RecommendationReason[] } {
  let score = 0;
  const reasons: RecommendationReason[] = [];

  // +50 for mood match
  if (activity.mood === input.mood) {
    score += 50;
    reasons.push({
      reason: `Perfect match for ${input.mood} mood`,
      score: 50,
    });
  }

  // +10 per matching preference tag
  const preferenceTags: string[] = [];

  // ENERGY preference (based on intensity)
  if (input.energy === "low" && activity.intensity <= 2) {
    preferenceTags.push("low-energy");
  } else if (input.energy === "med" && activity.intensity >= 2 && activity.intensity <= 4) {
    preferenceTags.push("med-energy");
  } else if (input.energy === "high" && activity.intensity >= 4) {
    preferenceTags.push("high-energy");
  }

  // SOCIAL preference (based on activity tags)
  if (input.social === "solo") {
    preferenceTags.push("solo");
  } else if (input.social === "social") {
    preferenceTags.push("social");
  }

  // BUDGET preference (based on cost_level)
  if (input.budget === "free" && activity.cost_level === 0) {
    preferenceTags.push("free");
  } else if (input.budget === "low" && activity.cost_level <= 1) {
    preferenceTags.push("low-cost");
  }

  // Score matching tags only if activity actually has them
  preferenceTags.forEach((tag) => {
    if (activity.tags?.includes(tag)) {
      score += 10;
      reasons.push({
        reason: `Matches ${tag} preference`,
        score: 10,
      });
    }
  });

  // +10 if duration fits (within 15 min buffer)
  const timeBuffer = 15;
  if (activity.duration_min <= input.timeAvailable + timeBuffer) {
    score += 10;
    reasons.push({
      reason: `Fits your ${input.timeAvailable}-minute window`,
      score: 10,
    });
  }

  // +10 if cost level fits budget
  if (input.budget === "free" && activity.cost_level === 0) {
    score += 10;
    reasons.push({ reason: "Free activity", score: 10 });
  } else if (input.budget === "low" && activity.cost_level <= 1) {
    score += 10;
    reasons.push({ reason: "Low cost activity", score: 10 });
  } else if (input.budget === "any") {
    score += 10;
    reasons.push({ reason: "Cost fits your budget", score: 10 });
  }

  // +10 if intensity fits energy
  const energyMap: Record<EnergyLevel, { min: number; max: number }> = {
    low: { min: 1, max: 2 },
    med: { min: 2, max: 4 },
    high: { min: 4, max: 5 },
  };

  const energyRange = energyMap[input.energy];
  if (activity.intensity >= energyRange.min && activity.intensity <= energyRange.max) {
    score += 10;
    reasons.push({
      reason: `Intensity matches your ${input.energy} energy level`,
      score: 10,
    });
  }

  return { score, reasons };
}

/**
 * Get recommendations based on input criteria
 * Returns top 12 activities ranked by score
 */
export function getRecommendations(
  activities: Activity[],
  input: RecommendationInput
): RecommendationResult[] {
  // Filter by mood first
  const moodFiltered = activities.filter((a) => a.mood === input.mood);

  // Score each activity
  const scored: RecommendationResult[] = moodFiltered.map((activity) => {
    const { score, reasons } = scoreActivity(activity, input);
    return { activity, score, reasons };
  });

  // Sort by score (descending), then by title for consistency
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.activity.title.localeCompare(b.activity.title);
  });

  // Return top 12
  return scored.slice(0, 12);
}









