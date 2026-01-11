// ============================================================
// RECOMMENDATION ENGINE TYPES
// ============================================================

export type UserState = "blank" | "destructive" | "expansive" | "minimize";
export type Focus = "music" | "watch" | "read" | "move" | "create" | "reset";
export type ContentType = "watch" | "read" | "listen" | "move" | "create" | "reset";

export interface RecommendationRequest {
  userId: string;
  state: UserState;
  focus: Focus;
  timeAvailableMin: number;
  energyLevel: number; // 1-5
  intent?: string;
  noHeavy?: boolean;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  tags: string[];
  genres: string[];
  intensity: number; // 0-1
  cognitive_load: number; // 0-1
  novelty: number; // 0-1
  duration_min: number | null;
  popularity: number; // 0-1
  rating: number | null; // 0-1
  link: string | null;
  source: string;
  description?: string | null;
  image_url?: string | null;
}

export interface Recommendation {
  id: string;
  type: ContentType;
  title: string;
  link: string | null;
  score: number;
  why: string;
  tags: string[];
  source: string;
  description?: string | null;
  image_url?: string | null;
}

export interface UserPreferences {
  user_id: string;
  liked_tags: string[];
  disliked_tags: string[];
  liked_genres: string[];
  disliked_genres: string[];
  intensity_tolerance: number;
  novelty_tolerance: number;
}

export interface StateProfile {
  intensityRange: [number, number];
  noveltyPreference: "low" | "medium" | "high";
  genreBoosts: Record<string, number>; // genre -> boost multiplier
  genrePenalties: Record<string, number>; // genre -> penalty multiplier
  scoringWeights: {
    mood: number;
    time: number;
    energy: number;
    preference: number;
    quality: number;
    novelty: number;
  };
}






