import { supabase } from "../lib/supabaseClient";
import { getUserId } from "./savesApi";

const LAST_STATE_KEY = "kivaw_last_state";

/**
 * Get the last state chosen by the user
 * Checks profiles table first, falls back to localStorage
 */
export async function getLastState(): Promise<string | null> {
  try {
    const userId = await getUserId();
    if (!userId) {
      // Fallback to localStorage for non-authenticated users
      return localStorage.getItem(LAST_STATE_KEY);
    }

    // Try to get from profiles table
    const { data, error } = await supabase
      .from("profiles")
      .select("last_state")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data?.last_state) {
      return data.last_state;
    }

    // Fallback to localStorage
    return localStorage.getItem(LAST_STATE_KEY);
  } catch {
    // Fallback to localStorage on error
    return localStorage.getItem(LAST_STATE_KEY);
  }
}

/**
 * Save the last state chosen by the user
 * Saves to profiles table if authenticated, also saves to localStorage
 */
export async function saveLastState(state: string): Promise<void> {
  // Always save to localStorage
  try {
    localStorage.setItem(LAST_STATE_KEY, state);
  } catch {}

  try {
    const userId = await getUserId();
    if (!userId) return;

    // Try to save to profiles table
    const { error } = await supabase
      .from("profiles")
      .update({ last_state: state })
      .eq("id", userId);

    // If column doesn't exist, that's okay - we'll use localStorage
    if (error && !error.message?.includes("column")) {
      console.warn("Could not save last_state to profiles:", error);
    }
  } catch (e) {
    // Silent fail - localStorage is the fallback
    console.warn("Error saving last_state:", e);
  }
}

