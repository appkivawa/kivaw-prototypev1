/**
 * Shared helper functions for content cards
 */

/**
 * Get relative time string (e.g., "2h ago")
 * Uses coalesce(published_at, ingested_at)
 */
export function getRelativeTime(
  publishedAt?: string | null,
  ingestedAt?: string | null
): string {
  const timestamp = publishedAt || ingestedAt;
  if (!timestamp) return "";

  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return "";

  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/**
 * Get favicon URL for a domain
 */
export function getFaviconUrl(domain: string, size: number = 32): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Get up to N tags/topics from arrays
 */
export function getDisplayTags(
  tags?: string[] | null,
  topics?: string[] | null,
  maxCount: number = 2
): string[] {
  const all = [...(tags || []), ...(topics || [])];
  const unique = Array.from(new Set(all.map((t) => t.trim()).filter(Boolean)));
  return unique.slice(0, maxCount);
}

/**
 * Get "Why this is here" explanation line
 * Combines category/source with tags
 */
export function getWhyHere(
  source: string,
  category?: string | null,
  tags?: string[] | null,
  topics?: string[] | null
): string {
  const parts: string[] = [];
  
  // Add category or source
  if (category) {
    parts.push(category);
  } else {
    parts.push(source);
  }
  
  // Add up to 2 tags/topics
  const displayTags = getDisplayTags(tags, topics, 2);
  if (displayTags.length > 0) {
    parts.push(displayTags.join(", "));
  }
  
  return parts.join(" • ");
}




