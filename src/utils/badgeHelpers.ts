/**
 * Badge helpers for content cards
 */

export type BadgeType = "new" | "popular" | "trending" | null;

export type BadgeContext = {
  itemScore?: number | null;
  itemTimestamp: string | null;
  allItems: Array<{
    score?: number | null;
    published_at?: string | null;
    ingested_at?: string | null;
  }>;
};

/**
 * Get item timestamp (coalesce published_at, ingested_at)
 */
function getItemTimestamp(
  publishedAt?: string | null,
  ingestedAt?: string | null
): string | null {
  return publishedAt || ingestedAt || null;
}

/**
 * Check if item is less than 2 hours old
 */
function isNew(publishedAt?: string | null, ingestedAt?: string | null): boolean {
  const timestamp = getItemTimestamp(publishedAt, ingestedAt);
  if (!timestamp) return false;
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return false;
  const hours = (Date.now() - t) / (1000 * 60 * 60);
  return hours < 2;
}

/**
 * Check if item is in top percentile for last 7 days
 * Uses top 10% as threshold
 */
function isPopularThisWeek(
  itemScore: number | null | undefined,
  itemTimestamp: string | null,
  allItems: BadgeContext["allItems"]
): boolean {
  if (!itemScore || itemScore <= 0 || !itemTimestamp) return false;

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Filter items from last 7 days
  const recentItems = allItems.filter((item) => {
    const ts = getItemTimestamp(item.published_at, item.ingested_at);
    if (!ts) return false;
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= sevenDaysAgo;
  });

  if (recentItems.length < 10) return false; // Need at least 10 items for percentile

  // Get scores and sort descending
  const scores = recentItems
    .map((item) => item.score ?? 0)
    .filter((s) => s > 0)
    .sort((a, b) => b - a);

  if (scores.length === 0) return false;

  // Top 10% threshold (90th percentile)
  const top10PercentIndex = Math.max(0, Math.floor(scores.length * 0.1));
  const threshold = scores[top10PercentIndex] || scores[0];

  return itemScore >= threshold;
}

/**
 * Check if item is top score over last 48 hours
 */
function isTrending(
  itemScore: number | null | undefined,
  itemTimestamp: string | null,
  allItems: BadgeContext["allItems"]
): boolean {
  if (!itemScore || itemScore <= 0 || !itemTimestamp) return false;

  const now = Date.now();
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

  // Filter items from last 48 hours
  const recentItems = allItems.filter((item) => {
    const ts = getItemTimestamp(item.published_at, item.ingested_at);
    if (!ts) return false;
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= fortyEightHoursAgo;
  });

  if (recentItems.length < 3) return false; // Need at least 3 items

  // Get scores from recent items
  const scores = recentItems
    .map((item) => item.score ?? 0)
    .filter((s) => s > 0);

  if (scores.length === 0) return false;

  // Get max score from recent items
  const maxScore = Math.max(...scores);

  // Item is trending if it has the top score (or within 5% of top)
  return itemScore >= maxScore * 0.95;
}

/**
 * Determine badge for an item
 * Priority: New > Trending > Popular
 */
export function getBadge(
  publishedAt: string | null | undefined,
  ingestedAt: string | null | undefined,
  score: number | null | undefined,
  allItems: BadgeContext["allItems"] = []
): BadgeType {
  const timestamp = getItemTimestamp(publishedAt, ingestedAt);

  // Priority 1: New (< 2 hours)
  if (isNew(publishedAt, ingestedAt)) {
    return "new";
  }

  // Priority 2: Trending (top score last 48h)
  if (isTrending(score, timestamp, allItems)) {
    return "trending";
  }

  // Priority 3: Popular this week (top 10% last 7 days)
  if (isPopularThisWeek(score, timestamp, allItems)) {
    return "popular";
  }

  return null;
}

/**
 * Get badge label
 */
export function getBadgeLabel(badge: BadgeType): string {
  switch (badge) {
    case "new":
      return "New";
    case "popular":
      return "Popular this week";
    case "trending":
      return "Trending";
    default:
      return "";
  }
}

