// src/hooks/useNowPlaying.ts
// Lightweight hook for Now Playing state

import { useState, useEffect } from "react";

export interface NowPlayingItem {
  title: string;
  artist?: string;
  image_url?: string;
  url?: string;
}

export function useNowPlaying(): NowPlayingItem | null {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingItem | null>(null);

  useEffect(() => {
    // Check localStorage for now playing state
    try {
      const stored = localStorage.getItem("kivaw_now_playing");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.title) {
          // Use setTimeout to avoid setState in effect warning
          setTimeout(() => setNowPlaying(parsed), 0);
        }
      }
    } catch {
      // Ignore errors
    }

    // Listen for now playing updates (can be extended to listen to player events)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "kivaw_now_playing") {
        try {
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue);
            if (parsed && parsed.title) {
              setNowPlaying(parsed);
            }
          } else {
            setNowPlaying(null);
          }
        } catch {
          // Ignore errors
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return nowPlaying;
}
