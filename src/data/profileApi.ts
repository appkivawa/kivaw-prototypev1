// src/data/profileApi.ts
import { supabase } from "../lib/supabaseClient";

export type Profile = {
  id: string;
  email: string | null;
  onboarded: boolean | null;
  interests: string[] | null;
  created_at: string;
  updated_at: string;
};

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Get current user's profile
 */
export async function getMyProfile(): Promise<Profile | null> {
  const uid = await getUserId();
  if (!uid) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();

  if (error) {
    // Profile might not exist yet - that's ok, we'll create it on first login
    if (error.code === "PGRST116" || error.code === "42P01") return null; // 42P01 = table doesn't exist
    // Log other errors but don't throw - return null to allow graceful degradation
    console.warn("[getMyProfile] Error fetching profile:", error);
    return null;
  }

  return data as Profile;
}

/**
 * Ensure profile exists for current user (called after login)
 */
export async function ensureProfile(): Promise<Profile> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const uid = session.user.id;
  const email = session.user.email;

  // Upsert profile (create if doesn't exist, update if it does)
  // Ensure onboarded and interests are set with correct types
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: uid,
        email: email || null,
        onboarded: false, // Boolean: false for new users
        interests: [], // text[]: empty array for new users
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

/**
 * Check if user needs onboarding
 */
export async function needsOnboarding(): Promise<boolean> {
  const profile = await getMyProfile();
  if (!profile) return true; // No profile = needs onboarding
  return profile.onboarded !== true;
}

