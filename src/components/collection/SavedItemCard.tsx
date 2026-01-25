// src/components/collection/SavedItemCard.tsx
// Minimal grid card wrapper - reuses Card component and existing patterns

import React from "react";
import Card from "../../ui/Card";
import type { SavedItem } from "../../pages/Collection";
import { normalizeItemType, getItemTypeLabel } from "../../lib/itemTypes";

interface SavedItemCardProps {
  item: SavedItem;
  onRemove?: (id: string) => void;
}

export default function SavedItemCard({ item, onRemove }: SavedItemCardProps) {
  const normalizedType = normalizeItemType({
    kind: item.kind,
    source: item.source,
    title: item.title,
    tags: [],
  });
  const kindLabel = getItemTypeLabel(normalizedType);
  const author = item.byline || item.author || null;

  return (
    <Card
      variant="outlined"
      onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
      className="collection-saved-item"
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {item.image_url ? (
          <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "var(--studio-gray-50)" }}>
            <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : (
          <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--studio-gray-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--studio-text-muted)", fontSize: "24px" }}>
            {item.title?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--studio-text-muted)", marginBottom: "8px" }}>
            {kindLabel}
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--studio-text)", margin: "0 0 4px 0", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.title}
          </h3>
          {author && (
            <div style={{ fontSize: "13px", color: "var(--studio-text-secondary)", marginTop: "auto" }}>
              {author}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
