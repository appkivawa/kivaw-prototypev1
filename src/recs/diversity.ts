// ============================================================
// DIVERSITY RE-RANKING
// ============================================================

import type { ContentItem, Recommendation } from "./types";

interface ScoredItem {
  item: ContentItem;
  score: number;
}

// ============================================================
// Diversity Re-ranking
// ============================================================

export function diversifyRecommendations(
  scoredItems: ScoredItem[],
  topN: number = 12
): Recommendation[] {
  if (scoredItems.length === 0) return [];

  // Sort by score descending
  const sorted = [...scoredItems].sort((a, b) => b.score - a.score);

  const selected: Recommendation[] = [];
  const genreCounts: Record<string, number> = {};
  const tagClusterCounts: Map<string, number> = new Map();

  // Helper: Get primary tag cluster (first 2 tags sorted)
  function getTagCluster(tags: string[]): string {
    return tags.slice(0, 2).sort().join("|");
  }

  // First pass: Select top items with diversity constraints
  for (const scored of sorted) {
    if (selected.length >= topN) break;

    const { item } = scored;
    const primaryGenre = item.genres[0] || "unknown";
    const tagCluster = getTagCluster(item.tags);

    // Check constraints
    const genreCount = genreCounts[primaryGenre] || 0;
    const clusterCount = tagClusterCounts.get(tagCluster) || 0;

    // Skip if constraints violated
    if (genreCount >= 2) continue; // Max 2 per genre
    if (clusterCount >= 2) continue; // Max 2 per tag cluster

    // Add to selection
    selected.push({
      id: item.id,
      type: item.type,
      title: item.title,
      link: item.link,
      score: scored.score,
      why: "", // Will be filled by explainability
      tags: item.tags,
      source: item.source,
      description: item.description,
      image_url: item.image_url,
    });

    // Update counts
    genreCounts[primaryGenre] = (genreCounts[primaryGenre] || 0) + 1;
    tagClusterCounts.set(tagCluster, (tagClusterCounts.get(tagCluster) || 0) + 1);
  }

  // Second pass: Fill remaining slots with wildcards (different tag clusters)
  const usedClusters = new Set(Array.from(tagClusterCounts.keys()));
  for (const scored of sorted) {
    if (selected.length >= topN) break;

    // Skip if already selected
    if (selected.some((s) => s.id === scored.item.id)) continue;

    const tagCluster = getTagCluster(scored.item.tags);
    const primaryGenre = scored.item.genres[0] || "unknown";

    // Prefer items with different tag clusters
    if (!usedClusters.has(tagCluster) && (genreCounts[primaryGenre] || 0) < 3) {
      selected.push({
        id: scored.item.id,
        type: scored.item.type,
        title: scored.item.title,
        link: scored.item.link,
        score: scored.score,
        why: "",
        tags: scored.item.tags,
        source: scored.item.source,
        description: scored.item.description,
        image_url: scored.item.image_url,
      });

      usedClusters.add(tagCluster);
      genreCounts[primaryGenre] = (genreCounts[primaryGenre] || 0) + 1;
    }
  }

  // Final pass: Fill any remaining slots with highest scores
  for (const scored of sorted) {
    if (selected.length >= topN) break;
    if (selected.some((s) => s.id === scored.item.id)) continue;

    selected.push({
      id: scored.item.id,
      type: scored.item.type,
      title: scored.item.title,
      link: scored.item.link,
      score: scored.score,
      why: "",
      tags: scored.item.tags,
      source: scored.item.source,
      description: scored.item.description,
      image_url: scored.item.image_url,
    });
  }

  return selected;
}



