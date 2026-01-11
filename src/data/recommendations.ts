// src/data/recommendations.ts (or wherever this file lives)

export type RecItem = {
  id: string;
  kind: string;
  meta: string;
  title: string;
  byline: string;
  icon?: string;
  image?: string;
};

/**
 * New framework states:
 *  - release, build, open, rest, unsure
 *
 * Keep "music/faith/movement" as focus categories for now.
 */
type State = "release" | "build" | "open" | "rest" | "unsure";
type Focus = "music" | "faith" | "movement";

type ComboKey =
  | "rest_music"
  | "rest_faith"
  | "open_music"
  | "open_faith"
  | "release_movement"
  | "build_music"
  | "unsure_music";

const STARTER: Partial<Record<ComboKey, RecItem[]>> = {
  // 🛌 REST (Need to recharge) — formerly "minimize"
  rest_music: [
    {
      id: "rm-1",
      kind: "Album",
      meta: "Ambient / Folk",
      title: "Invisible Cities",
      byline: "Benoît Pioulard",
      icon: "🎧",
      image:
        "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "rm-2",
      kind: "Playlist",
      meta: "Curated",
      title: "Reflective Minimalism",
      byline: "Spotify",
      icon: "📱",
      image:
        "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "rm-3",
      kind: "Concert",
      meta: "Live",
      title: "Nils Frahm – Solo Piano",
      byline: "Lincoln Center",
      icon: "🎹",
      image:
        "https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=900&q=80",
    },
  ],

  rest_faith: [
    {
      id: "rf-1",
      kind: "Practice",
      meta: "10 min",
      title: "Quiet Prayer Reset",
      byline: "Kivaw Routine",
      icon: "🙏",
      image:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "rf-2",
      kind: "Book",
      meta: "Devotional",
      title: "Gentle Psalms",
      byline: "Kivaw Picks",
      icon: "📖",
      image:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "rf-3",
      kind: "Practice",
      meta: "Reflection",
      title: "Gratitude Inventory",
      byline: "Kivaw Routine",
      icon: "🕯️",
      image:
        "https://images.unsplash.com/photo-1504198458649-3128b932f49b?auto=format&fit=crop&w=900&q=80",
    },
  ],

  // 🌱 OPEN (Ready to explore) — formerly "expansive"
  open_music: [
    {
      id: "om-1",
      kind: "Playlist",
      meta: "Energy",
      title: "New Horizons",
      byline: "Kivaw Picks",
      icon: "🚀",
      image:
        "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "om-2",
      kind: "Album",
      meta: "Alt / Pop",
      title: "Golden Hour",
      byline: "Kacey Musgraves",
      icon: "🌅",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "om-3",
      kind: "Concert",
      meta: "Live",
      title: "Jazz Night",
      byline: "Local Venue",
      icon: "🎷",
      image:
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=900&q=80",
    },
  ],

  // 💥 RELEASE (Need to expel energy) — formerly "destructive"
  release_movement: [
    {
      id: "relm-1",
      kind: "Practice",
      meta: "5 min",
      title: "Anger-to-Action Walk",
      byline: "Kivaw Routine",
      icon: "🚶",
      image:
        "https://images.unsplash.com/photo-1500534314209-a26db0f5c7f3?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "relm-2",
      kind: "Practice",
      meta: "Breathwork",
      title: "Box Breathing",
      byline: "Kivaw Routine",
      icon: "🫁",
      image:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "relm-3",
      kind: "Practice",
      meta: "Release",
      title: "Shake It Out",
      byline: "Kivaw Routine",
      icon: "⚡",
      image:
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
    },
  ],

  // 🏗️ BUILD (Want to create/accomplish) — NEW
  build_music: [
    {
      id: "bm-1",
      kind: "Playlist",
      meta: "Focus",
      title: "Deep Work Boost",
      byline: "Kivaw Picks",
      icon: "🏗️",
      image:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "bm-2",
      kind: "Album",
      meta: "Instrumental",
      title: "Momentum",
      byline: "Kivaw Picks",
      icon: "🎛️",
      image:
        "https://images.unsplash.com/photo-1520170350707-b2da59970118?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "bm-3",
      kind: "Practice",
      meta: "15 min",
      title: "One Small Win",
      byline: "Kivaw Routine",
      icon: "✅",
      image:
        "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=900&q=80",
    },
  ],

  // ❓ UNSURE (Decide for me) — formerly "blank"
  unsure_music: [
    {
      id: "um-1",
      kind: "Playlist",
      meta: "Starter",
      title: "Gentle Reset",
      byline: "Kivaw Picks",
      icon: "🌙",
      image:
        "https://images.unsplash.com/photo-1500534314209-a26db0f5c7f3?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "um-2",
      kind: "Album",
      meta: "Ambient",
      title: "Weightless",
      byline: "Marconi Union",
      icon: "🫧",
      image:
        "https://images.unsplash.com/photo-1517816428104-797d16c0031a?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "um-3",
      kind: "Practice",
      meta: "2 min",
      title: "Pick One Thing",
      byline: "Kivaw Routine",
      icon: "🎲",
      image:
        "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=900&q=80",
    },
  ],
};

function normalizeState(state: string): State {
  const s = (state || "").trim().toLowerCase();

  // Accept old states (backwards compatibility)
  if (s === "minimize" || s === "minimizer") return "rest";
  if (s === "destructive" || s === "destructivist") return "release";
  if (s === "expansive" || s === "expansivist" || s === "curious") return "open";
  if (s === "blank") return "unsure";

  // Accept new states
  if (s === "release" || s === "build" || s === "open" || s === "rest" || s === "unsure") return s;

  // Default fallback
  return "unsure";
}

function normalizeFocus(focus: string): Focus {
  const f = (focus || "").trim().toLowerCase();
  if (f === "music" || f === "faith" || f === "movement") return f;
  return "music";
}

export function getRecommendations(state: string, focus: string): RecItem[] {
  const s = normalizeState(state);
  const f = normalizeFocus(focus);

  const key = `${s}_${f}` as ComboKey;
  if (STARTER[key]?.length) return STARTER[key]!;

  // fallback ladders (so you never get an empty screen)
  const fallbackKey = `${s}_music` as ComboKey;
  if (STARTER[fallbackKey]?.length) return STARTER[fallbackKey]!;

  return STARTER["unsure_music"] || [];
}

