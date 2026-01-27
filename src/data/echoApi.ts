import { supabase } from "../lib/supabaseClient";
import { sanitizeTag, sanitizeTextContent, isValidUUID } from "../utils/security";

export type ContentItemLite = {
  id: string;
  kind: string | null;
  title: string;
  image_url: string | null;
};

export type EchoRow = {
  id: string;
  user_id: string;
  content_id: string | null; // ✅ allow null
  usage_tag: string;
  note: string | null;
  shared_to_waves: boolean;
  created_at: string;
};

export type EchoWithContent = EchoRow & {
  content_items: ContentItemLite | null;
};

export type WaveEcho = EchoWithContent & {
  profiles: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

import { sanitizeSearchQuery } from "../utils/security";

export async function listContentItemsLite(params?: { q?: string; limit?: number }) {
  // Sanitize and validate input
  const q = params?.q ? sanitizeSearchQuery(params.q) : "";
  const limit = Math.min(Math.max(1, params?.limit ?? 30), 100); // Limit between 1-100

  let query = supabase
    .from("content_items")
    .select("id,kind,title,image_url")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    // Supabase PostgREST safely handles parameterized queries
    query = query.or(`title.ilike.%${q}%,meta.ilike.%${q}%,byline.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ContentItemLite[];
}

export async function getContentItemLiteById(contentId: string) {
  // Validate UUID format
  if (!isValidUUID(contentId)) {
    throw new Error("Invalid content ID format");
  }

  const { data, error } = await supabase
    .from("content_items")
    .select("id,kind,title,image_url")
    .eq("id", contentId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as ContentItemLite | null;
}

export async function createEcho(input: {
  contentId: string | null; // ✅ allow null
  note: string; // Required - this is the reflection text
  usageTag?: string; // Optional - legacy support
  shareToWaves?: boolean; // Visibility toggle
}) {
  const uid = await getUserId();
  if (!uid) throw new Error("Auth session missing!");

  // Validate note (required)
  const note = input.note ? sanitizeTextContent(input.note.trim()) : null;
  if (!note || note.length === 0) {
    throw new Error("Reflection text is required");
  }

  // Validate contentId if provided
  if (input.contentId && !isValidUUID(input.contentId)) {
    throw new Error("Invalid content ID format");
  }

  // Optional usage tag (sanitize if provided)
  const usageTag = input.usageTag ? sanitizeTag(input.usageTag) : null;

  const payload = {
    user_id: uid,
    content_id: input.contentId ?? null,
    usage_tag: usageTag || "", // Default to empty string if not provided
    note: note,
    shared_to_waves: !!input.shareToWaves,
  };

  const { error } = await supabase.from("echoes").insert(payload);
  if (error) throw error;

  // Also save the item if contentId is provided
  if (input.contentId) {
    await supabase
      .from("saved_items")
      .upsert(
        [
          {
            user_id: uid,
            content_id: input.contentId,
          },
        ],
        { onConflict: "user_id,content_id" }
      )
      .then(null, () => {
        // Ignore errors - item might already be saved or table might not exist
      });
  }
}

export async function listMyEchoes(limit = 100) {
  const uid = await getUserId();
  if (!uid) throw new Error("Auth session missing!");

  const { data, error } = await supabase
    .from("echoes")
    .select(
      "id,user_id,content_id,usage_tag,note,shared_to_waves,created_at,content_items(id,kind,title,image_url)"
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Supabase can return content_items as an array depending on relationship shape.
  // Normalize it to the type we want.
  const rows = (data || []).map((r: any) => ({
    ...r,
    content_items: Array.isArray(r.content_items) ? r.content_items[0] ?? null : r.content_items ?? null,
  }));

  return rows as EchoWithContent[];
}

export async function deleteEcho(echoId: string) {
  const uid = await getUserId();
  if (!uid) throw new Error("Auth session missing!");

  // Validate UUID format
  if (!isValidUUID(echoId)) {
    throw new Error("Invalid echo ID format");
  }

  const { error } = await supabase.from("echoes").delete().eq("id", echoId).eq("user_id", uid);

  if (error) throw error;
}

/**
 * Get a single echo by content_id for the current user
 */
export async function getEchoByContentId(contentId: string): Promise<EchoWithContent | null> {
  const uid = await getUserId();
  if (!uid) return null;

  if (!isValidUUID(contentId)) {
    return null;
  }

  const { data, error } = await supabase
    .from("echoes")
    .select("id,user_id,content_id,usage_tag,note,shared_to_waves,created_at,content_items(id,kind,title,image_url)")
    .eq("user_id", uid)
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching echo by content_id:", error);
    return null;
  }

  if (!data) return null;

  // Normalize content_items
  const row = {
    ...data,
    content_items: Array.isArray(data.content_items) ? data.content_items[0] ?? null : data.content_items ?? null,
  };

  return row as EchoWithContent;
}

/**
 * List all Echoes that are shared as Waves (public reflections)
 */
export async function listWaves(limit = 100) {
  const { data, error } = await supabase
    .from("echoes")
    .select(
      `
      id,
      user_id,
      content_id,
      note,
      shared_to_waves,
      created_at,
      content_items(id,kind,title,image_url),
      profiles(username,avatar_url)
    `
    )
    .eq("shared_to_waves", true)
    .not("note", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Normalize content_items and profiles
  const rows = (data || []).map((r: any) => ({
    ...r,
    content_items: Array.isArray(r.content_items) ? r.content_items[0] ?? null : r.content_items ?? null,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
  }));

  return rows as WaveEcho[];
}











