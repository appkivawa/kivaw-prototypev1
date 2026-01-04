import type { ContentItem } from "../data/contentApi";

export function isInternalContentItem(
  item: Pick<ContentItem, "title" | "meta" | "kind">
): boolean {
  const title = (item.title || "").toLowerCase().trim();
  const meta = (item.meta || "").toLowerCase().trim();
  const kind = (item.kind || "").toLowerCase().trim();

  if (title === "unlinked echo") return true;
  if (meta.includes("used when an echo is saved")) return true;
  if (kind.includes("system")) return true;

  return false;
}

export function isPublicDiscoverableContentItem(
  item: Pick<ContentItem, "title" | "meta" | "kind">
): boolean {
  return !isInternalContentItem(item);
}
