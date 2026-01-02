import { supabase } from "../lib/supabaseClient";
import type { ContentItem } from "./contentApi";

type Scored = ContentItem & { _score: number };

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

function scoreItem(item: ContentItem, state: string) {
  const st = (item.state_tags || []).map(norm);
  const hasState = st.includes(state);
  const isUniversal = st.length === 0;

  let score = 0;
  if (hasState) score += 3;
  if (isUniversal) score += 1;

  // tiny nudge so your own picks win ties
  if ((item.source || "").toLowerCase() === "kivaw") score += 0.25;

  return score;
}

function pickVaried(list: Scored[], target = 12) {
  // Greedy variety: rotate across kinds first, then fill remainder.
  const byKind = new Map<string, Scored[]>();
  for (const x of list) {
    const k = x.kind || "Other";
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(x);
  }

  // Ensure each kind list is already sorted by score desc
  for (const [k, arr] of byKind) {
    arr.sort((a, b) => b._score - a._score);
    byKind.set(k, arr);
  }

  const kinds = Array.from(byKind.keys());
  const out: Scored[] = [];

  // Round-robin
  while (out.length < target) {
    let addedThisRound = false;
    for (const k of kinds) {
      const arr = byKind.get(k)!;
      if (arr.length > 0 && out.length < target) {
        out.push(arr.shift()!);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break; // nothing left
  }

  return out;
}

/**
 * v2:
 * - focus match required first
 * - state match preferred, universal allowed
 * - variety across kinds
 * - fallback if not enough
 */
export async function getDbRecommendationsV2(
  stateRaw: string,
  focusRaw: string,
  limit = 12
) {
  const state = norm(stateRaw);
  const focus = norm(focusRaw);

  // 1) Pull focus matches
  const { data: focusRows, error: focusErr } = await supabase
    .from("content_items")
    .select(
      // ✅ added usage_tags
      "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
    )
    .contains("focus_tags", [focus])
    .limit(200);

  if (focusErr) throw focusErr;

  const focusItems = (focusRows || []) as ContentItem[];

  // Score + keep only valid for this state (state match OR universal)
  const scored: Scored[] = focusItems
    .map((x) => ({ ...x, _score: scoreItem(x, state) }))
    .filter((x) => x._score > 0); // >0 means state match or universal

  // Sort by score desc, then recency
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  // 2) Variety pick
  let picked = pickVaried(scored, limit);

  // 3) Fallback: if we still don’t have enough, grab universal items from any focus
  if (picked.length < limit) {
    const need = limit - picked.length;
    const existing = new Set(picked.map((x) => x.id));

    const { data: fallbackRows, error: fbErr } = await supabase
      .from("content_items")
      .select(
        // ✅ added usage_tags
        "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
      )
      .eq("state_tags", "{}") // universal only
      .order("created_at", { ascending: false })
      .limit(200);

    if (fbErr) throw fbErr;

    const fallback = ((fallbackRows || []) as ContentItem[])
      .filter((x) => !existing.has(x.id))
      .slice(0, need)
      .map((x) => ({ ...x, _score: 0 }));

    picked = [...picked, ...fallback];
  }

  return picked as ContentItem[];
}


