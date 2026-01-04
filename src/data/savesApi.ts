import { supabase } from "../lib/supabaseClient";
import { isValidUUID } from "../utils/security";

const TABLE = "saves_v2";

export async function getUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

// returns UUIDs of content_items.id
export async function fetchSavedIds(): Promise<string[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("content_item_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r: any) => r.content_item_id as string);
}

export async function saveItem(contentItemId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  // Validate UUID format
  if (!isValidUUID(contentItemId)) {
    throw new Error("Invalid content item ID format");
  }

  const { error } = await supabase.from(TABLE).insert([
    { user_id: userId, content_item_id: contentItemId },
  ]);

  if (error) throw error;
}

export async function unsaveItem(contentItemId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  // Validate UUID format
  if (!isValidUUID(contentItemId)) {
    throw new Error("Invalid content item ID format");
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("content_item_id", contentItemId);

  if (error) throw error;
}

