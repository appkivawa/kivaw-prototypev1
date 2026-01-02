import { getRecommendations, type RecItem } from "./recommendations";

const states = ["minimizer", "destructivist", "expansivist", "blank"];
const focuses = ["music", "logic", "art", "faith", "movement", "beauty"];

export const REC_BY_ID = new Map<string, RecItem>();
export const ALL_RECS: RecItem[] = [];

for (const s of states) {
  for (const f of focuses) {
    const list = getRecommendations(s, f);
    for (const r of list) {
      if (!REC_BY_ID.has(r.id)) {
        REC_BY_ID.set(r.id, r);
        ALL_RECS.push(r);
      }
    }
  }
}

export function getRecsByIds(ids: string[]): RecItem[] {
  return ids.map((id) => REC_BY_ID.get(id)).filter(Boolean) as RecItem[];
}
