/**
 * Recommendation Engine
 * Core logic layer for generating personalized recommendations
 */

export type FocusMode = "music" | "watch" | "read" | "move" | "create" | "reset";
export type MoodState = "blank" | "destructive" | "expansive" | "minimize";

export type RecommendationInput = {
  mood?: MoodState;
  focus?: FocusMode;
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
  seedTags?: string[];
  recentItemIds?: string[];
  trendingTags?: string[];
  isAuthed?: boolean;
};

export type Recommendation = {
  id: string;
  kind: "movie" | "book" | "playlist" | "video" | "activity";
  title: string;
  subtitle?: string;
  tags: string[];
  score: number;
  reason: string;
  externalUrl?: string;
  imageUrl?: string;
};

// Mood-to-focus compatibility weights
const MOOD_FOCUS_WEIGHTS: Record<MoodState, Partial<Record<FocusMode, number>>> = {
  blank: { reset: 1.0, music: 0.8, read: 0.6 },
  destructive: { move: 1.0, music: 0.7, watch: 0.5 },
  expansive: { read: 1.0, create: 0.9, watch: 0.7 },
  minimize: { music: 1.0, reset: 0.9, read: 0.6 },
};

// Time-of-day boosts
const TIME_BOOSTS: Record<string, number> = {
  morning: 1.1,
  afternoon: 1.0,
  evening: 1.15,
  night: 1.2,
};

// Tag diversity penalty threshold
const DIVERSITY_THRESHOLD = 3; // Max same tag count before penalty

/**
 * Get recommendations based on input context
 */
export function getRecommendations(input: RecommendationInput): Recommendation[] {
  const {
    mood = "blank",
    focus,
    timeOfDay,
    seedTags = [],
    recentItemIds = [],
    trendingTags = [],
  } = input;

  // Generate candidate recommendations (placeholder for now)
  // In production, this would fetch from unifiedRecommendations or external APIs
  const candidates = generateCandidateRecommendations(mood, focus);

  // Score each candidate
  const scored = candidates.map((candidate) => {
    let score = 0;
    const reasons: string[] = [];

    // Mood match weight
    if (mood) {
      const moodWeight = MOOD_FOCUS_WEIGHTS[mood]?.[candidate.focus as FocusMode] || 0;
      if (moodWeight > 0) {
        score += moodWeight * 40;
        reasons.push(`Matches ${mood} mood`);
      }
    }

    // Focus match weight
    if (focus && candidate.focus === focus) {
      score += 30;
      reasons.push(`Perfect ${focus} match`);
    } else if (focus && candidate.tags.some((t) => t.toLowerCase().includes(focus))) {
      score += 15;
      reasons.push(`Related to ${focus}`);
    }

    // Time-of-day boost
    if (timeOfDay) {
      const boost = TIME_BOOSTS[timeOfDay] || 1.0;
      score = Math.round(score * boost);
      if (boost > 1.0) {
        reasons.push(`Great for ${timeOfDay}`);
      }
    }

    // Trending tag boost
    const trendingMatches = candidate.tags.filter((tag) =>
      trendingTags.some((tt) => tag.toLowerCase().includes(tt.toLowerCase()))
    ).length;
    if (trendingMatches > 0) {
      score += trendingMatches * 10;
      reasons.push(`Trending now`);
    }

    // Seed tag boost
    const seedMatches = candidate.tags.filter((tag) =>
      seedTags.some((st) => tag.toLowerCase().includes(st.toLowerCase()))
    ).length;
    if (seedMatches > 0) {
      score += seedMatches * 8;
      reasons.push(`Matches your interests`);
    }

    // Recent item penalty (avoid showing same items)
    if (recentItemIds.includes(candidate.id)) {
      score -= 20;
      reasons.push(`Recently viewed`);
    }

    return {
      ...candidate,
      score,
      reason: reasons.length > 0 ? reasons.join(" • ") : "Recommended for you",
    };
  });

  // Apply diversity penalty
  const tagCounts = new Map<string, number>();
  const diversified = scored.map((rec) => {
    // Count tags
    rec.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });

    // Apply penalty if too many items share same tags
    let diversityPenalty = 0;
    rec.tags.forEach((tag) => {
      const count = tagCounts.get(tag) || 0;
      if (count > DIVERSITY_THRESHOLD) {
        diversityPenalty += (count - DIVERSITY_THRESHOLD) * 5;
      }
    });

    return {
      ...rec,
      score: Math.max(0, rec.score - diversityPenalty),
    };
  });

  // Sort by score (highest first)
  diversified.sort((a, b) => b.score - a.score);

  return diversified;
}

/**
 * Generate candidate recommendations (placeholder - replace with real data source)
 */
function generateCandidateRecommendations(
  mood: MoodState,
  focus?: FocusMode
): Array<Omit<Recommendation, "score" | "reason"> & { focus?: FocusMode }> {
  // Placeholder candidates - in production, fetch from unifiedRecommendations
  const candidates: Array<Omit<Recommendation, "score" | "reason"> & { focus?: FocusMode }> = [];

  // Mood-based suggestions
  if (mood === "blank") {
    candidates.push(
      {
        id: "blank-1",
        kind: "playlist",
        title: "Ambient Reset",
        subtitle: "Calm instrumental music",
        tags: ["ambient", "reset", "calm"],
        externalUrl: "#",
        focus: "music",
      },
      {
        id: "blank-2",
        kind: "book",
        title: "Meditation Guide",
        subtitle: "Mindfulness practices",
        tags: ["meditation", "mindfulness", "reset"],
        externalUrl: "#",
        focus: "read",
      }
    );
  } else if (mood === "destructive") {
    candidates.push(
      {
        id: "destructive-1",
        kind: "activity",
        title: "High-Intensity Workout",
        subtitle: "Release energy",
        tags: ["movement", "fitness", "intense"],
        externalUrl: "#",
        focus: "move",
      },
      {
        id: "destructive-2",
        kind: "music",
        title: "Energetic Playlist",
        subtitle: "Powerful beats",
        tags: ["electronic", "energetic", "movement"],
        externalUrl: "#",
        focus: "music",
      }
    );
  } else if (mood === "expansive") {
    candidates.push(
      {
        id: "expansive-1",
        kind: "book",
        title: "Learning Resource",
        subtitle: "Expand your knowledge",
        tags: ["learning", "education", "growth"],
        externalUrl: "#",
        focus: "read",
      },
      {
        id: "expansive-2",
        kind: "video",
        title: "Creative Tutorial",
        subtitle: "Build something new",
        tags: ["creative", "tutorial", "learning"],
        externalUrl: "#",
        focus: "create",
      }
    );
  } else if (mood === "minimize") {
    candidates.push(
      {
        id: "minimize-1",
        kind: "playlist",
        title: "Peaceful Sounds",
        subtitle: "Gentle music for rest",
        tags: ["calm", "peaceful", "rest"],
        externalUrl: "#",
        focus: "music",
      },
      {
        id: "minimize-2",
        kind: "book",
        title: "Restful Reading",
        subtitle: "Light, calming content",
        tags: ["light", "calm", "rest"],
        externalUrl: "#",
        focus: "read",
      }
    );
  }

  // Filter by focus if specified
  if (focus) {
    return candidates.filter((c) => {
      const focusMap: Record<FocusMode, string[]> = {
        music: ["playlist", "music"],
        watch: ["video", "movie"],
        read: ["book"],
        move: ["activity"],
        create: ["video", "activity"],
        reset: ["playlist", "book"],
      };
      const allowedKinds = focusMap[focus] || [];
      return allowedKinds.includes(c.kind);
    });
  }

  return candidates;
}

/**
 * Debug function to show scored recommendations (dev only)
 */
export function debugRecommendations(input: RecommendationInput): {
  recommendations: Recommendation[];
  input: RecommendationInput;
} {
  const recommendations = getRecommendations(input);
  return {
    recommendations,
    input,
  };
}

