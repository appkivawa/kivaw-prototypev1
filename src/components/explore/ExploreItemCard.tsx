// src/components/explore/ExploreItemCard.tsx
// Memoized explore item card for performance

import React, { memo } from "react";
import Card from "../../ui/Card";

interface ExploreItemCardProps {
  id: string;
  kind: string;
  title: string;
  byline?: string | null;
  image_url?: string | null;
  url?: string | null;
  provider: string;
  tags?: string[];
  created_at: string;
}

const ExploreItemCard = memo<ExploreItemCardProps>(function ExploreItemCard({
  id,
  title,
  byline,
  image_url,
  url,
  provider,
  tags,
  created_at,
}) {
  const handleMouseEnter = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (url) {
      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
    }
  }, [url]);

  const handleMouseLeave = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
    (e.currentTarget as HTMLElement).style.boxShadow = "none";
  }, []);

  const handleClick = React.useCallback(() => {
    if (url) window.open(url, "_blank");
  }, [url]);

  return (
    <Card
      style={{
        padding: "20px",
        cursor: url ? "pointer" : "default",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
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
      {byline && (
        <div style={{ fontSize: "14px", color: "#6B7280", marginBottom: "8px" }}>By {byline}</div>
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
      <div style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "12px" }}>
        {provider} • {new Date(created_at).toLocaleDateString()}
      </div>
    </Card>
  );
});

export default ExploreItemCard;


