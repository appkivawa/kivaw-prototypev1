// ============================================================
// STATE PROFILES AND MAPPING LOGIC
// ============================================================

import type { StateProfile, UserState } from "./types";

// ============================================================
// State Profiles
// ============================================================

export const STATE_PROFILES: Record<UserState, StateProfile> = {
  blank: {
    intensityRange: [0.05, 0.35],
    noveltyPreference: "low",
    genreBoosts: {
      comedy: 1.3,
      family: 1.2,
      romance: 1.2,
      documentary: 1.1,
    },
    genrePenalties: {
      horror: 0.5,
      thriller: 0.6,
      action: 0.7,
    },
    scoringWeights: {
      mood: 35,
      time: 20,
      energy: 20,
      preference: 15,
      quality: 10,
      novelty: -5, // Small penalty for too weird
    },
  },
  destructive: {
    intensityRange: [0.45, 0.90],
    noveltyPreference: "medium",
    genreBoosts: {
      action: 1.4,
      thriller: 1.3,
      horror: 1.2,
      crime: 1.2,
    },
    genrePenalties: {
      romance: 0.6,
      family: 0.5,
      comedy: 0.7,
    },
    scoringWeights: {
      mood: 30,
      energy: 25,
      time: 15,
      preference: 15,
      quality: 10,
      novelty: 5,
    },
  },
  expansive: {
    intensityRange: [0.25, 0.75],
    noveltyPreference: "high",
    genreBoosts: {
      "science fiction": 1.4,
      documentary: 1.3,
      mystery: 1.2,
      fantasy: 1.2,
      adventure: 1.1,
    },
    genrePenalties: {
      romance: 0.7,
      family: 0.8,
    },
    scoringWeights: {
      mood: 25,
      novelty: 20,
      quality: 15,
      time: 15,
      preference: 15,
      energy: 10,
    },
  },
  minimize: {
    intensityRange: [0.0, 0.25],
    noveltyPreference: "low",
    genreBoosts: {
      poetry: 1.4,
      meditation: 1.3,
      mindfulness: 1.3,
      family: 1.2,
      romance: 1.1,
    },
    genrePenalties: {
      action: 0.3,
      horror: 0.2,
      thriller: 0.4,
      "science fiction": 0.7,
    },
    scoringWeights: {
      mood: 35,
      time: 25,
      energy: 15,
      preference: 15,
      quality: 10,
      novelty: -10, // Negative if too stimulating
    },
  },
};

// ============================================================
// Focus Multipliers
// ============================================================

export const FOCUS_MULTIPLIERS: Record<string, Record<string, number>> = {
  music: {
    listen: 1.5,
    watch: 0.8,
    read: 0.7,
    move: 0.9,
    create: 1.1,
    reset: 1.0,
  },
  watch: {
    watch: 1.5,
    listen: 0.7,
    read: 0.6,
    move: 0.8,
    create: 0.9,
    reset: 1.0,
  },
  read: {
    read: 1.5,
    watch: 0.7,
    listen: 0.8,
    move: 0.7,
    create: 1.0,
    reset: 0.9,
  },
  move: {
    move: 1.5,
    watch: 0.8,
    read: 0.7,
    listen: 1.1,
    create: 0.9,
    reset: 1.0,
  },
  create: {
    create: 1.5,
    listen: 1.2,
    read: 1.0,
    watch: 0.8,
    move: 0.9,
    reset: 1.0,
  },
  reset: {
    reset: 1.5,
    listen: 1.2,
    watch: 1.1,
    read: 0.8,
    move: 0.9,
    create: 0.9,
  },
};

export function getFocusMultiplier(focus: string, contentType: string): number {
  return FOCUS_MULTIPLIERS[focus]?.[contentType] || 1.0;
}

// ============================================================
// Helper: Check if intensity is in target range
// ============================================================

export function intensityInRange(intensity: number, range: [number, number]): boolean {
  return intensity >= range[0] && intensity <= range[1];
}

// ============================================================
// Helper: Get novelty preference score
// ============================================================

export function getNoveltyPreferenceScore(novelty: number, preference: "low" | "medium" | "high"): number {
  switch (preference) {
    case "low":
      // Prefer lower novelty (0.0-0.4)
      if (novelty <= 0.4) return 1.0;
      if (novelty <= 0.6) return 0.7;
      return 0.4;
    case "medium":
      // Prefer medium novelty (0.3-0.7)
      if (novelty >= 0.3 && novelty <= 0.7) return 1.0;
      if (novelty >= 0.2 && novelty <= 0.8) return 0.8;
      return 0.5;
    case "high":
      // Prefer higher novelty (0.6-1.0)
      if (novelty >= 0.6) return 1.0;
      if (novelty >= 0.4) return 0.7;
      return 0.4;
  }
}



