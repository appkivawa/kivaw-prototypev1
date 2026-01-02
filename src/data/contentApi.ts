import { supabase } from "../lib/supabaseClient";

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
  const kind = params?.kind && params.kind !== "All" ? params.kind : null;
  const q = (params?.q || "").trim();
  const limit = params?.limit ?? 80;

  let query = supabase
    .from("content_items")
    .select(
      "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (kind) query = query.eq("kind", kind);

  if (q) {
    query = query.or(`title.ilike.%${q}%,byline.ilike.%${q}%,meta.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ContentItem[];
}


