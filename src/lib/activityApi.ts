// ============================================================
// KIVAW Activity Recommendations - Supabase API
// ============================================================

import { supabase } from './supabaseClient';
import { getSessionId } from './recommend';
import type {
  Activity,
  SavedActivity,
  RecommendationInput,
  RecommendationResult,
} from '../types/recommendations';
import { getRecommendations } from './recommend';

/**
 * Get current user ID (authenticated) or null
 */
async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/**
 * Fetch all activities from database
 */
export async function fetchAllActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[activityApi] Error fetching activities:', error);
    throw error;
  }

  return (data || []) as Activity[];
}

/**
 * Get recommendations based on input criteria
 */
export async function getActivityRecommendations(
  input: RecommendationInput
): Promise<RecommendationResult[]> {
  // Fetch all activities
  const activities = await fetchAllActivities();

  // Score and rank them
  return getRecommendations(activities, input);
}

/**
 * Save an activity for the current user/session
 */
export async function saveActivity(activityId: string): Promise<void> {
  const userId = await getUserId();
  const sessionId = userId ? null : getSessionId();

  // Check if already saved
  let query = supabase.from('saved_activities').select('id');

  if (userId) {
    query = query.eq('user_id', userId).eq('activity_id', activityId);
  } else {
    query = query.eq('session_id', sessionId).eq('activity_id', activityId);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    // Already saved
    return;
  }

  // Insert new save
  const insertData: any = {
    activity_id: activityId,
  };

  if (userId) {
    insertData.user_id = userId;
  } else {
    insertData.session_id = sessionId;
  }

  const { error } = await supabase.from('saved_activities').insert(insertData);

  if (error) {
    console.error('[activityApi] Error saving activity:', error);
    throw error;
  }
}

/**
 * Unsave an activity
 */
export async function unsaveActivity(activityId: string): Promise<void> {
  const userId = await getUserId();
  const sessionId = userId ? null : getSessionId();

  let query = supabase.from('saved_activities').delete();

  if (userId) {
    query = query.eq('user_id', userId).eq('activity_id', activityId);
  } else {
    query = query.eq('session_id', sessionId).eq('activity_id', activityId);
  }

  const { error } = await query;

  if (error) {
    console.error('[activityApi] Error unsaving activity:', error);
    throw error;
  }
}

/**
 * Check if an activity is saved
 */
export async function isActivitySaved(activityId: string): Promise<boolean> {
  const userId = await getUserId();
  const sessionId = userId ? null : getSessionId();

  let query = supabase.from('saved_activities').select('id').eq('activity_id', activityId);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('session_id', sessionId);
  }

  const { data } = await query.maybeSingle();
  return !!data;
}

/**
 * Record feedback event (like, skip, complete, dismiss)
 */
export async function recordFeedback(
  activityId: string,
  eventType: 'like' | 'skip' | 'complete' | 'dismiss'
): Promise<void> {
  const userId = await getUserId();
  const sessionId = userId ? null : getSessionId();

  const insertData: any = {
    activity_id: activityId,
    event_type: eventType,
  };

  if (userId) {
    insertData.user_id = userId;
  } else {
    insertData.session_id = sessionId;
  }

  const { error } = await supabase.from('feedback_events').insert(insertData);

  if (error) {
    console.error('[activityApi] Error recording feedback:', error);
    throw error;
  }
}

/**
 * Fetch saved activities for current user/session
 */
export async function fetchSavedActivities(): Promise<SavedActivity[]> {
  const userId = await getUserId();
  const sessionId = userId ? null : getSessionId();

  let query = supabase
    .from('saved_activities')
    .select(
      `
      id,
      user_id,
      session_id,
      activity_id,
      saved_at,
      activity:activities(*)
    `
    )
    .order('saved_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[activityApi] Error fetching saved activities:', error);
    throw error;
  }

  // Transform data to handle joined activity object
  return (data || []).map((item: any) => {
    // If activity is an array (shouldn't happen with our query), take first
    const activity = Array.isArray(item.activity) ? item.activity[0] : item.activity;
    return {
      ...item,
      activity,
    } as SavedActivity;
  });
}


