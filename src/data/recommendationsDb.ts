import { supabase } from "../lib/supabaseClient";
import type { ContentItem } from "./contentApi";

type Scored = ContentItem & { _score: number };

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

/**
 * Focus -> allowed kinds (single source of truth)
 * Tweak this list anytime without touching the query logic.
 */
const FOCUS_TO_KINDS: Record<string, string[]> = {
  music: ["Playlist", "Album", "Concert"],
  watch: ["Visual"],
  read: ["Book"],
  move: ["Movement", "Exercise"],
  reflect: ["Reflection", "Prompt", "Practice"],
  create: ["Creative", "Visual"],

  // If you still use "reset" in your quiz UI:
  // Decide what reset means in terms of content kinds.
  // If reset is really a state (not focus), you can remove this.
  reset: ["Reflection", "Prompt", "Practice"],
};

function focusToKinds(focusRaw: string): string[] {
  const f = norm(focusRaw);
  return FOCUS_TO_KINDS[f] || [];
}

function scoreItem(item: ContentItem, state: string) {
  const st = (item.state_tags || []).map(norm);
  const isBlank = state === "blank" || state === "";
  const hasState = !isBlank && st.includes(state);
  const isUniversal = st.length === 0;

  let score = 0;

  // If state is blank, don't punish items for not having a state tag.
  if (isBlank) score += 1;

  // If state is not blank, matching it is the strongest signal.
  if (hasState) score += 3;

  // Universal is a *small* fallback bonus (never dominant).
  if (isUniversal) score += 0.25;

  // Small boost for your own source content.
  if ((item.source || "").toLowerCase() === "kivaw") score += 0.25;

  return score;
}

function pickVaried(list: Scored[], target = 12) {
  const byKind = new Map<string, Scored[]>();

  for (const x of list) {
    const k = x.kind || "Other";
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(x);
  }

  // Within each kind, highest score first
  for (const [k, arr] of byKind) {
    arr.sort((a, b) => b._score - a._score);
    byKind.set(k, arr);
  }

  const kinds = Array.from(byKind.keys());
  const out: Scored[] = [];

  // Round-robin pick across kinds to avoid 12 playlists in a row (unless that’s all you have)
  while (out.length < target) {
    let addedThisRound = false;

    for (const k of kinds) {
      const arr = byKind.get(k)!;
      if (arr.length > 0 && out.length < target) {
        out.push(arr.shift()!);
        addedThisRound = true;
      }
    }

    if (!addedThisRound) break;
  }

  return out;
}

export async function getDbRecommendationsV2(
  stateRaw: string,
  focusRaw: string,
  limit = 12
) {
  const state = norm(stateRaw) || "blank";
  const kinds = focusToKinds(focusRaw);

  // If focus is unknown, return empty so UI can say "no matches"
  // (Better than lying with random “latest” content.)
  if (!kinds.length) return [];

  // 1) Pull candidates by KIND (stable & matches your DB reality)
  const { data: rows, error } = await supabase
    .from("content_items")
    .select(
      "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
    )
    .in("kind", kinds)
    .limit(500);

  if (error) throw error;

  const items = (rows || []) as ContentItem[];

  // 2) Score + filter
  const scoredAll: Scored[] = items.map((x) => ({
    ...x,
    _score: scoreItem(x, state),
  }));

  // If state is blank -> allow all focus-matching items.
  // If state is not blank -> allow items that match state OR universal.
  const scored =
    state === "blank"
      ? scoredAll
      : scoredAll.filter((x) => {
          const st = (x.state_tags || []).map(norm);
          return st.includes(state) || st.length === 0;
        });

  // 3) Sort: score desc, created_at desc, then title (to avoid identical created_at ties)
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;

    const ca = a.created_at || "";
    const cb = b.created_at || "";
    if (cb !== ca) return cb.localeCompare(ca);

    return (a.title || "").localeCompare(b.title || "");
  });

  // 4) Pick varied
  let picked = pickVaried(scored, limit);

  // 5) Fallback: ONLY universal items *within the same focus kinds*
  // This prevents Music results from pulling Practice/Prompt/etc unless Music mapping allows it.
  if (picked.length < limit) {
    const need = limit - picked.length;
    const existing = new Set(picked.map((x) => x.id));

    const { data: fallbackRows, error: fbErr } = await supabase
      .from("content_items")
      .select(
        "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
      )
      .in("kind", kinds)
      .eq("state_tags", "{}")
      .order("created_at", { ascending: false })
      .limit(300);

    if (fbErr) throw fbErr;

    const fallback = ((fallbackRows || []) as ContentItem[])
      .filter((x) => !existing.has(x.id))
      .slice(0, need)
      .map((x) => ({ ...x, _score: 0 }));

    picked = [...picked, ...fallback];
  }

  return picked as ContentItem[];
}





