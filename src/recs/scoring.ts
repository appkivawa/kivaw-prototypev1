// ============================================================
// SCORING FUNCTION
// ============================================================

import type { ContentItem, UserPreferences, UserState, Focus } from "./types";
import { STATE_PROFILES, getFocusMultiplier, intensityInRange, getNoveltyPreferenceScore } from "./stateProfiles";

interface ScoringContext {
  state: UserState;
  focus: Focus;
  timeAvailableMin: number;
  energyLevel: number; // 1-5
  noHeavy?: boolean;
  userPrefs: UserPreferences;
}

// ============================================================
// Individual Factor Scores (0-100)
// ============================================================

function moodFitScore(item: ContentItem, state: UserState): number {
  const profile = STATE_PROFILES[state];
  let score = 0;

  // Intensity fit (0-40 points)
  const intensityDistance = intensityInRange(item.intensity, profile.intensityRange)
    ? 0
    : item.intensity < profile.intensityRange[0]
    ? profile.intensityRange[0] - item.intensity
    : item.intensity - profile.intensityRange[1];
  const intensityScore = Math.max(0, 40 - intensityDistance * 100);
  score += intensityScore;

  // Genre boosts/penalties (0-30 points)
  let genreScore = 20; // Base
  for (const genre of item.genres) {
    if (profile.genreBoosts[genre]) {
      genreScore += 5 * (profile.genreBoosts[genre] - 1);
    }
    if (profile.genrePenalties[genre]) {
      genreScore -= 10 * (1 - profile.genrePenalties[genre]);
    }
  }
  score += Math.max(0, Math.min(30, genreScore));

  // Tag alignment (0-30 points)
  // Check if item tags align with state-appropriate tags
  const stateTags: Record<UserState, string[]> = {
    blank: ["gentle", "light", "comfort", "safe"],
    destructive: ["cathartic", "intense", "energetic", "release"],
    expansive: ["curiosity", "learning", "growth", "exploration"],
    minimize: ["calm", "minimal", "simple", "peaceful"],
  };
  const relevantTags = stateTags[state];
  const matchingTags = item.tags.filter((tag) => relevantTags.some((rt) => tag.includes(rt) || rt.includes(tag)));
  score += (matchingTags.length / relevantTags.length) * 30;

  return Math.min(100, Math.max(0, score));
}

function timeFitScore(item: ContentItem, timeAvailableMin: number): number {
  if (!item.duration_min) return 50; // Neutral if unknown

  const duration = item.duration_min;
  const difference = Math.abs(duration - timeAvailableMin);
  const grace = timeAvailableMin * 0.2; // 20% grace period

  if (difference <= grace) return 100; // Perfect fit
  if (duration <= timeAvailableMin) {
    // Shorter is okay, but not too short
    const ratio = duration / timeAvailableMin;
    return Math.max(60, ratio * 100);
  } else {
    // Longer is penalized more
    const excess = duration - timeAvailableMin;
    const excessRatio = excess / timeAvailableMin;
    return Math.max(0, 100 - excessRatio * 150);
  }
}

function energyFitScore(item: ContentItem, energyLevel: number, noHeavy?: boolean): number {
  // Energy level 1-5 maps to intensity tolerance
  const energyTolerance = (energyLevel - 1) / 4; // 0-1 scale

  // If noHeavy flag, heavily penalize high intensity
  if (noHeavy && item.intensity > 0.5) {
    return Math.max(0, 30 - (item.intensity - 0.5) * 100);
  }

  // Prefer items where intensity matches energy tolerance
  const distance = Math.abs(item.intensity - energyTolerance);
  return Math.max(0, 100 - distance * 150);
}

function preferenceFitScore(item: ContentItem, prefs: UserPreferences): number {
  let score = 50; // Neutral base

  // Liked tags boost
  const likedTagMatches = item.tags.filter((tag) => prefs.liked_tags.includes(tag)).length;
  score += likedTagMatches * 10;

  // Disliked tags penalty
  const dislikedTagMatches = item.tags.filter((tag) => prefs.disliked_tags.includes(tag)).length;
  score -= dislikedTagMatches * 15;

  // Liked genres boost
  const likedGenreMatches = item.genres.filter((genre) => prefs.liked_genres.includes(genre)).length;
  score += likedGenreMatches * 8;

  // Disliked genres penalty
  const dislikedGenreMatches = item.genres.filter((genre) => prefs.disliked_genres.includes(genre)).length;
  score -= dislikedGenreMatches * 12;

  return Math.min(100, Math.max(0, score));
}

function qualityScore(item: ContentItem): number {
  let score = 50; // Base

  // Rating contributes 0-30 points
  if (item.rating !== null) {
    score += item.rating * 30;
  }

  // Popularity contributes 0-20 points
  score += item.popularity * 20;

  return Math.min(100, Math.max(0, score));
}

function noveltyFitScore(item: ContentItem, state: UserState): number {
  const profile = STATE_PROFILES[state];
  const preferenceScore = getNoveltyPreferenceScore(item.novelty, profile.noveltyPreference);
  return preferenceScore * 100;
}

// ============================================================
// Main Scoring Function
// ============================================================

export function scoreItem(item: ContentItem, context: ScoringContext): number {
  const profile = STATE_PROFILES[context.state];
  const weights = profile.scoringWeights;

  // Calculate individual factor scores
  const moodScore = moodFitScore(item, context.state);
  const timeScore = timeFitScore(item, context.timeAvailableMin);
  const energyScore = energyFitScore(item, context.energyLevel, context.noHeavy);
  const prefScore = preferenceFitScore(item, context.userPrefs);
  const qualitySc = qualityScore(item);
  const noveltySc = noveltyFitScore(item, context.state);

  // Weighted sum
  let totalScore =
    (moodScore * weights.mood +
      timeScore * weights.time +
      energyScore * weights.energy +
      prefScore * weights.preference +
      qualitySc * weights.quality +
      noveltySc * Math.abs(weights.novelty)) /
    100;

  // Apply focus multiplier
  const focusMultiplier = getFocusMultiplier(context.focus, item.type);
  totalScore *= focusMultiplier;

  // Normalize to 0-100
  return Math.min(100, Math.max(0, totalScore));
}

// ============================================================
// Score Breakdown (for explainability)
// ============================================================

export interface ScoreBreakdown {
  mood: number;
  time: number;
  energy: number;
  preference: number;
  quality: number;
  novelty: number;
  focusMultiplier: number;
  total: number;
}

export function getScoreBreakdown(item: ContentItem, context: ScoringContext): ScoreBreakdown {
  const profile = STATE_PROFILES[context.state];
  const weights = profile.scoringWeights;

  const mood = moodFitScore(item, context.state);
  const time = timeFitScore(item, context.timeAvailableMin);
  const energy = energyFitScore(item, context.energyLevel, context.noHeavy);
  const preference = preferenceFitScore(item, context.userPrefs);
  const quality = qualityScore(item);
  const novelty = noveltyFitScore(item, context.state);
  const focusMultiplier = getFocusMultiplier(context.focus, item.type);

  const weightedSum =
    (mood * weights.mood +
      time * weights.time +
      energy * weights.energy +
      preference * weights.preference +
      quality * weights.quality +
      novelty * Math.abs(weights.novelty)) /
    100;

  const total = weightedSum * focusMultiplier;

  return {
    mood,
    time,
    energy,
    preference,
    quality,
    novelty,
    focusMultiplier,
    total: Math.min(100, Math.max(0, total)),
  };
}









