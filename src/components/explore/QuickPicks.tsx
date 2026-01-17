import React from "react";
import type { ExploreCard } from "./ExploreCard";

type QuickPicksProps = {
  items: ExploreCard[];
  onItemClick: (item: ExploreCard) => void;
};

function kindEmoji(kind: string): string {
  switch (kind) {
    case "movie":
      return "🎬";
    case "tv":
      return "📺";
    case "book":
      return "📚";
    case "podcast":
      return "🎧";
    case "music":
      return "🎵";
    default:
      return "✨";
  }
}

export default function QuickPicks({ items, onItemClick }: QuickPicksProps) {
  if (items.length === 0) return null;

  const quickPicks = items.slice(0, 6);

  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Quick Picks
        </h2>
      </div>
      <div
        style={{
          display: "flex",
          gap: "16px",
          overflowX: "auto",
          paddingBottom: "8px",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border-strong) transparent",
        }}
      >
        {quickPicks.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            style={{
              flexShrink: 0,
              width: "160px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              overflow: "hidden",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 4px 12px var(--shadow-black-08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "3/4",
                backgroundColor: "var(--border)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                  }}
                >
                  {kindEmoji(item.kind)}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  left: "8px",
                  right: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{kindEmoji(item.kind)}</span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title.slice(0, 20)}
                </span>
              </div>
            </div>
            <div style={{ padding: "12px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: "4px",
                }}
              >
                {item.title}
              </div>
              {item.byline && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--ink-tertiary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.byline}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

