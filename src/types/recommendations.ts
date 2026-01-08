// ============================================================
// KIVAW Recommendation Engine - TypeScript Types
// ============================================================

export type Mood = 'destructive' | 'blank' | 'expansive' | 'minimize';

export type EnergyLevel = 'low' | 'med' | 'high';

export type SocialPreference = 'solo' | 'social' | 'either';

export type BudgetLevel = 'free' | 'low' | 'any';

export interface Activity {
  id: string;
  title: string;
  description: string;
  mood: Mood;
  tags: string[];
  duration_min: number;
  cost_level: number; // 0-3
  intensity: number; // 1-5
  steps: string[];
  created_at: string;
  updated_at?: string;
}

export interface RecommendationInput {
  mood: Mood;
  timeAvailable: number; // minutes
  energy: EnergyLevel;
  social: SocialPreference;
  budget: BudgetLevel;
}

export interface RecommendationReason {
  reason: string;
  score: number;
}

export interface RecommendationResult {
  activity: Activity;
  score: number;
  reasons: RecommendationReason[];
}

export interface SavedActivity {
  id: string;
  user_id: string | null;
  session_id: string | null;
  activity_id: string;
  saved_at: string;
  activity?: Activity; // Joined from activities table
}

export interface FeedbackEvent {
  id: string;
  user_id: string | null;
  session_id: string | null;
  activity_id: string;
  event_type: 'like' | 'skip' | 'complete' | 'dismiss';
  created_at: string;
}


