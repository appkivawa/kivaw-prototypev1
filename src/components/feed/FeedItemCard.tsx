// src/components/feed/FeedItemCard.tsx
// Memoized feed item card for performance

import React, { memo } from "react";
import Card from "../../ui/Card";

interface FeedItemCardProps {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: string;
  author?: string | null;
  published_at?: string | null;
  tags?: string[];
  onSaveClick?: (e: React.MouseEvent) => void;
  isSaved?: boolean;
}

const FeedItemCard = memo<FeedItemCardProps>(function FeedItemCard({
  id,
  title,
  description,
  image_url,
  url,
  source,
  author,
  published_at,
  tags,
  onSaveClick,
  isSaved,
}) {
  return (
    <Card
      key={id}
      style={{
        padding: "20px",
        cursor: url ? "pointer" : "default",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onClick={() => url && window.open(url, "_blank")}
    >
      {image_url && (
        <img
          src={image_url}
          alt={title}
          style={{
            width: "100%",
            height: "200px",
            objectFit: "cover",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{title}</h3>
      {description && (
        <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "12px", lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {tags && tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                padding: "4px 8px",
                background: "#E5E7EB",
                color: "#374151",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
        <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
          {source} • {published_at ? new Date(published_at).toLocaleDateString() : "Recent"}
        </div>
        {onSaveClick && (
          <button
            onClick={onSaveClick}
            style={{
              padding: "4px 8px",
              background: isSaved ? "#10B981" : "transparent",
              color: isSaved ? "white" : "#6B7280",
              border: isSaved ? "none" : "1px solid #D1D5DB",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {isSaved ? "✓ Saved" : "💾 Save"}
          </button>
        )}
      </div>
    </Card>
  );
});

export default FeedItemCard;

