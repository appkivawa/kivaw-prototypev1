import { supabase } from "../lib/supabaseClient";
import { sanitizeSearchQuery } from "../utils/security";

export type ContentItem = {
  id: string;
  external_id: string;
  kind: string;
  title: string;

  byline: string | null;
  meta: string | null;
  image_url: string | null;
  url: string | null;

  state_tags: string[] | null;
  focus_tags: string[] | null;
  usage_tags: string[] | null;

  source: string | null;
  created_at: string;
};

export async function listContentItems(params?: {
  kind?: string; // "All" | "Playlist" | ...
  q?: string; // search string
  limit?: number;
}) {
  // Sanitize and validate inputs
  const kind = params?.kind && params.kind !== "All" ? sanitizeSearchQuery(params.kind, 50) : null;
  const q = params?.q ? sanitizeSearchQuery(params.q) : "";
  const limit = Math.min(Math.max(1, params?.limit ?? 80), 200); // Limit between 1-200

  let query = supabase
    .from("content_items")
    .select(
      "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (kind) query = query.eq("kind", kind);

  if (q) {
    // Supabase PostgREST safely handles parameterized queries
    query = query.or(`title.ilike.%${q}%,byline.ilike.%${q}%,meta.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ContentItem[];
}


