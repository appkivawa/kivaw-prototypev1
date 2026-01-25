// src/utils/collectionHelpers.ts
// Helper functions for Collection page counts and filtering

import type { SavedItem } from "../pages/Collection";
import { normalizeItemType, itemTypeToLibrary } from "../lib/itemTypes";

export type LibraryFilter = "all" | "books" | "movies_tv" | "music";
export type SavedFilter = "all" | "unfinished" | "favorites" | "archive";

export interface LibraryCounts {
  all: number;
  books: number;
  movies_tv: number;
  music: number;
}

export interface EchoCounts {
  echoes: number;
  history?: number;
}

function getItemKind(item: SavedItem): "book" | "movie_tv" | "music" | "other" {
  const normalizedType = normalizeItemType({
    kind: item.kind,
    source: item.source,
    title: item.title,
    tags: [],
  });
  
  const libraryType = itemTypeToLibrary(normalizedType);
  if (libraryType === "books") return "book";
  if (libraryType === "movies_tv") return "movie_tv";
  if (libraryType === "music") return "music";
  return "other";
}

export function computeLibraryCounts(savedItems: SavedItem[]): LibraryCounts {
  const counts: LibraryCounts = {
    all: savedItems.length,
    books: 0,
    movies_tv: 0,
    music: 0,
  };

  savedItems.forEach((item) => {
    const kind = getItemKind(item);
    if (kind === "book") counts.books++;
    else if (kind === "movie_tv") counts.movies_tv++;
    else if (kind === "music") counts.music++;
  });

  return counts;
}

export function computeEchoCounts(echoes: any[]): EchoCounts {
  return {
    echoes: echoes.length,
    // History count can be added later if history tracking exists
  };
}

export function filterSavedItems(
  savedItems: SavedItem[],
  activeFilter: SavedFilter,
  activeLibraryFilter: LibraryFilter | null
): SavedItem[] {
  let filtered = [...savedItems];

  // Apply library filter first (Books, Movies & TV, Music)
  if (activeLibraryFilter && activeLibraryFilter !== "all") {
    filtered = filtered.filter((item) => {
      const kind = getItemKind(item);
      if (activeLibraryFilter === "books") return kind === "book";
      if (activeLibraryFilter === "movies_tv") return kind === "movie_tv";
      if (activeLibraryFilter === "music") return kind === "music";
      return true;
    });
  }

  // Apply saved filter (All, Unfinished, Favorites, Archive)
  if (activeFilter === "unfinished") {
    // Items are unfinished by default unless they have status === "finished"
    filtered = filtered.filter((item) => {
      const status = (item as any).status;
      return status !== "finished";
    });
  } else if (activeFilter === "favorites") {
    // Items where isFavorite === true OR board === "favorites"
    filtered = filtered.filter((item) => {
      const isFavorite = (item as any).isFavorite === true;
      const board = (item as any).board;
      return isFavorite || board === "favorites";
    });
  } else if (activeFilter === "archive") {
    // Items where isArchived === true
    filtered = filtered.filter((item) => {
      return (item as any).isArchived === true;
    });
  }
  // "all" filter doesn't need additional filtering

  return filtered;
}
