export type RecItem = {
  id: string;
  kind: string;
  meta: string;
  title: string;
  byline: string;
  icon?: string;
  image?: string;
};

type ComboKey =
  | "minimizer_music"
  | "minimizer_faith"
  | "expansivist_music"
  | "destructivist_movement"
  | "blank_music";

const STARTER: Partial<Record<ComboKey, RecItem[]>> = {
  minimizer_music: [
    {
      id: "mm-1",
      kind: "Album",
      meta: "Ambient / Folk",
      title: "Invisible Cities",
      byline: "Benoît Pioulard",
      icon: "🎧",
      image:
        "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "mm-2",
      kind: "Playlist",
      meta: "Curated",
      title: "Reflective Minimalism",
      byline: "Spotify",
      icon: "📱",
      image:
        "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "mm-3",
      kind: "Concert",
      meta: "Live",
      title: "Nils Frahm – Solo Piano",
      byline: "Lincoln Center",
      icon: "🎹",
      image:
        "https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=900&q=80",
    },
  ],

  minimizer_faith: [
    {
      id: "mf-1",
      kind: "Practice",
      meta: "10 min",
      title: "Quiet Prayer Reset",
      byline: "Kivaw Routine",
      icon: "🙏",
      image:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "mf-2",
      kind: "Book",
      meta: "Devotional",
      title: "Gentle Psalms",
      byline: "Kivaw Picks",
      icon: "📖",
      image:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "mf-3",
      kind: "Practice",
      meta: "Reflection",
      title: "Gratitude Inventory",
      byline: "Kivaw Routine",
      icon: "🕯️",
      image:
        "https://images.unsplash.com/photo-1504198458649-3128b932f49b?auto=format&fit=crop&w=900&q=80",
    },
  ],

  expansivist_music: [
    {
      id: "em-1",
      kind: "Playlist",
      meta: "Energy",
      title: "New Horizons",
      byline: "Kivaw Picks",
      icon: "🚀",
      image:
        "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "em-2",
      kind: "Album",
      meta: "Alt / Pop",
      title: "Golden Hour",
      byline: "Kacey Musgraves",
      icon: "🌅",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "em-3",
      kind: "Concert",
      meta: "Live",
      title: "Jazz Night",
      byline: "Local Venue",
      icon: "🎷",
      image:
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=900&q=80",
    },
  ],

  destructivist_movement: [
    {
      id: "dm-1",
      kind: "Practice",
      meta: "5 min",
      title: "Anger-to-Action Walk",
      byline: "Kivaw Routine",
      icon: "🚶",
      image:
        "https://images.unsplash.com/photo-1500534314209-a26db0f5c7f3?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "dm-2",
      kind: "Practice",
      meta: "Breathwork",
      title: "Box Breathing",
      byline: "Kivaw Routine",
      icon: "🫁",
      image:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "dm-3",
      kind: "Practice",
      meta: "Release",
      title: "Shake It Out",
      byline: "Kivaw Routine",
      icon: "⚡",
      image:
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
    },
  ],

  blank_music: [
    {
      id: "bm-1",
      kind: "Playlist",
      meta: "Starter",
      title: "Gentle Reset",
      byline: "Kivaw Picks",
      icon: "🌙",
      image:
        "https://images.unsplash.com/photo-1500534314209-a26db0f5c7f3?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "bm-2",
      kind: "Album",
      meta: "Ambient",
      title: "Weightless",
      byline: "Marconi Union",
      icon: "🫧",
      image:
        "https://images.unsplash.com/photo-1517816428104-797d16c0031a?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "bm-3",
      kind: "Practice",
      meta: "2 min",
      title: "Pick One Thing",
      byline: "Kivaw Routine",
      icon: "✅",
      image:
        "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=900&q=80",
    },
  ],
};

export function getRecommendations(state: string, focus: string): RecItem[] {
  const key = `${state}_${focus}` as ComboKey;
  return STARTER[key] || [];
}
