import { supabase } from "../lib/supabaseClient";
import type { ContentItem } from "./contentApi";

export type WaveSummaryRow = {
  content_id: string;
  usage_tag: string;
  uses: number;
  last_used_at: string;
};

export type WavesFeedItem = {
  content: ContentItem;
  usage_tag: string;
  uses: number;
  last_used_at: string;
};

export async function listWavesFeed(limit = 60): Promise<WavesFeedItem[]> {
  const { data: rows, error } = await supabase
    .from("waves_summary")
    .select("content_id,usage_tag,uses,last_used_at")
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const summary = (rows || []) as WaveSummaryRow[];
  const ids = Array.from(new Set(summary.map((r) => r.content_id)));

  if (ids.length === 0) return [];

  const { data: items, error: ierr } = await supabase
    .from("content_items")
    .select(
      "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,source,created_at"
    )
    .in("id", ids);

  if (ierr) throw ierr;

  const index = new Map<string, ContentItem>();
  for (const it of (items || []) as ContentItem[]) index.set(it.id, it);

  return summary
    .map((s) => {
      const content = index.get(s.content_id);
      if (!content) return null;
      return {
        content,
        usage_tag: s.usage_tag,
        uses: s.uses,
        last_used_at: s.last_used_at,
      } as WavesFeedItem;
    })
    .filter(Boolean) as WavesFeedItem[];
}

export async function listWavesForItem(contentId: string, limit = 25) {
  const { data, error } = await supabase
    .from("waves_summary")
    .select("content_id,usage_tag,uses,last_used_at")
    .eq("content_id", contentId)
    .order("uses", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as WaveSummaryRow[];
}



