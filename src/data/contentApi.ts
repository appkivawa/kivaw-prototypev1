// src/data/contentApi.ts
export type ContentItem = {
  id: string;
  title: string;
  kind?: string;       // e.g. "Playlist", "Exercise", "Visual"
  category?: string;   // e.g. "Background calm"
  source?: string;     // e.g. "Kivaw"
  icon?: string;       // emoji or short label
  tags?: string[];
};

// ---- local "DB" (swap later with Supabase/Firebase without touching UI) ----
const LS_SAVED_KEY = "kivaw_saved_ids_v1";

// You likely already have real content somewhere.
// If you already have a listContentItems implementation, keep yours and delete this sample.
const SAMPLE: ContentItem[] = [
  { id: "neutral-sounds", title: "Neutral Sounds", kind: "Playlist", category: "Background calm", source: "Kivaw", icon: "🎧", tags: ["#windingdown"] },
  { id: "soft-reset", title: "Soft Reset", kind: "Playlist", category: "Calm, grounding sounds", source: "Kivaw", icon: "🎵", tags: ["#latenight", "#emotionalreset"] },
  { id: "release-playlist", title: "Release Playlist", kind: "Playlist", category: "Let it out safely", source: "Kivaw", icon: "🎶", tags: ["#burnenergy"] },
  { id: "faith-vision", title: "Faith & Vision", kind: "Reflection", category: "Purpose alignment", source: "Kivaw", icon: "✦", tags: ["#prayer"] },
  { id: "creative-sprint", title: "Creative Sprint", kind: "Exercise", category: "Make something fast", source: "Kivaw", icon: "✦", tags: ["#create"] },
];

function readSavedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_SAVED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeSavedSet(set: Set<string>) {
  try {
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export async function listContentItems(): Promise<ContentItem[]> {
  // Replace with real fetch later
  return SAMPLE;
}

export async function readMySavedIds(): Promise<string[]> {
  return Array.from(readSavedSet());
}

export async function toggleSavedForItem(contentId: string): Promise<boolean> {
  const set = readSavedSet();
  const nextSaved = !set.has(contentId);
  if (nextSaved) set.add(contentId);
  else set.delete(contentId);
  writeSavedSet(set);
  return nextSaved;
}

