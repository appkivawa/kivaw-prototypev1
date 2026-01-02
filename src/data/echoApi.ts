import { supabase } from "../lib/supabaseClient";

/* ---------- Types ---------- */

export type EchoRow = {
  id: string;
  user_id: string;
  content_id: string;
  usage_tag: string;
  note: string | null;
  used_on: string; // yyyy-mm-dd
  shared_to_waves: boolean;
  created_at: string;
};

export type EchoWithContent = EchoRow & {
  content_items: {
    id: string;
    kind: string;
    title: string;
    byline: string | null;
    meta: string | null;
    image_url: string | null;
    url: string | null;
  } | null;
};

export type WaveRow = {
  id: string;
  content_id: string;
  usage_tag: string;
  created_at: string;
  content_items: {
    id: string;
    title: string;
    kind: string;
    image_url: string | null;
  } | null;
};

export type WaveSummaryRow = {
  usage_tag: string;
  content_id: string;
  uses: number;
  last_used_at: string;
  content_items: {
    id: string;
    title: string;
    kind: string;
    image_url: string | null;
  } | null;
};

/** Lite content item used for the Echo "Change item" picker */
export type ContentItemLite = {
  id: string;
  title: string;
  kind: string;
  byline: string | null;
  meta: string | null;
  image_url: string | null;
};

/* ---------- Helpers ---------- */

export async function getUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

// Supabase nested selects sometimes return an array even when the relationship
// is effectively 1:1. Normalize joins to a single object.
function firstOrNull<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

/* ---------- Content Items (for picker) ---------- */

/** Fetch one item for the "Linked item" mini card */
export async function getContentItem(
  contentId: string
): Promise<ContentItemLite | null> {
  const id = (contentId || "").trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("content_items")
    .select("id,title,kind,byline,meta,image_url")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ContentItemLite | null;
}

/** List items for dropdown/search */
export async function listContentItemsLite(params?: {
  q?: string;
  limit?: number;
}): Promise<ContentItemLite[]> {
  const q = (params?.q || "").trim();
  const limit = params?.limit ?? 30;

  let query = supabase
    .from("content_items")
    .select("id,title,kind,byline,meta,image_url")
    .limit(limit);

  // If your content_items table does NOT have created_at, delete the next line.
  query = query.order("created_at", { ascending: false });

  if (q) {
    // Search across title/meta/byline
    query = query.or(
      `title.ilike.%${q}%,meta.ilike.%${q}%,byline.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContentItemLite[];
}

/* ---------- Echo (private) ---------- */

export async function listMyEchoes(limit = 80): Promise<EchoWithContent[]> {
  const uid = await getUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("echoes")
    .select(
      `
      id,
      user_id,
      content_id,
      usage_tag,
      note,
      used_on,
      shared_to_waves,
      created_at,
      content_items (
        id,
        kind,
        title,
        byline,
        meta,
        image_url,
        url
      )
    `
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    ...r,
    content_items: firstOrNull(r.content_items),
  })) as EchoWithContent[];
}

export async function listMyEchoesForItem(
  contentId: string,
  limit = 30
): Promise<EchoRow[]> {
  const uid = await getUserId();
  if (!uid) return [];

  const content_id = (contentId || "").trim();
  if (!content_id) return [];

  const { data, error } = await supabase
    .from("echoes")
    .select(
      "id,user_id,content_id,usage_tag,note,used_on,shared_to_waves,created_at"
    )
    .eq("user_id", uid)
    .eq("content_id", content_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as EchoRow[];
}

export async function createEcho(input: {
  contentId: string; // must be a real UUID from content_items
  usageTag: string;
  note?: string;
  usedOn?: string; // yyyy-mm-dd
  shareToWaves?: boolean;
}) {
  const uid = await getUserId();
  if (!uid) throw new Error("Not signed in");

  const content_id = (input.contentId || "").trim();
  if (!content_id) throw new Error("Missing content id");

  const usage_tag = (input.usageTag || "").trim();
  if (!usage_tag) throw new Error("Usage tag required");

  const used_on = input.usedOn || new Date().toISOString().slice(0, 10);
  const shared_to_waves = !!input.shareToWaves;

  const { error } = await supabase.from("echoes").insert([
    {
      user_id: uid,
      content_id,
      usage_tag,
      note: input.note?.trim() || null,
      used_on,
      shared_to_waves,
    },
  ]);

  if (error) throw error;

  // If sharing: also add anonymized public wave event
  if (shared_to_waves) {
    const { error: werr } = await supabase.from("waves_events").insert([
      { content_id, usage_tag },
    ]);
    if (werr) throw werr;
  }
}

export async function deleteEcho(echoId: string) {
  const uid = await getUserId();
  if (!uid) throw new Error("Not signed in");

  const { error } = await supabase
    .from("echoes")
    .delete()
    .eq("id", echoId)
    .eq("user_id", uid);

  if (error) throw error;
}

/* ---------- Waves (public) ---------- */

export async function listWaves(limit = 60): Promise<WaveRow[]> {
  const { data, error } = await supabase
    .from("waves_events")
    .select(
      `
      id,
      content_id,
      usage_tag,
      created_at,
      content_items (
        id,
        title,
        kind,
        image_url
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    ...r,
    content_items: firstOrNull(r.content_items),
  })) as WaveRow[];
}

export async function listWavesSummary(limit = 40): Promise<WaveSummaryRow[]> {
  const { data, error } = await supabase
    .from("waves_summary")
    .select(
      `
      usage_tag,
      content_id,
      uses,
      last_used_at,
      content_items (
        id,
        title,
        kind,
        image_url
      )
    `
    )
    .order("uses", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    ...r,
    content_items: firstOrNull(r.content_items),
  })) as WaveSummaryRow[];
}




