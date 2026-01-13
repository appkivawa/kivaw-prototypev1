import React from "react";
import { getRelativeTime, getDomain, getFaviconUrl, getDisplayTags, getWhyHere } from "../../utils/cardHelpers";
import { getBadge, getBadgeLabel, type BadgeType } from "../../utils/badgeHelpers";

export type ExploreCard = {
  id: string;
  kind: "movie" | "book" | "podcast" | "music" | "creator" | "event" | "other";
  title: string;
  byline?: string | null;
  meta?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: string;
  tags?: string[] | null;
  headline?: string | null;
  story?: string | null;
  prompts?: string[] | null;
  opener?: string | null;
  bio?: string | null;
  blurb?: string | null;
  created_at?: string | null;
};

type ExploreCardProps = {
  item: ExploreCard;
  onClick: (item: ExploreCard) => void;
  allItems?: Array<{
    score?: number | null;
    published_at?: string | null;
    ingested_at?: string | null;
    created_at?: string | null;
  }>; // For badge calculation context
  badge?: BadgeType; // Pre-calculated badge (optional)
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

function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).trim();
}

export default function ExploreCard({ item, onClick, allItems = [], badge: providedBadge }: ExploreCardProps) {
  // Calculate badge if not provided (Explore items don't have score, so only "New" is possible)
  const badge = providedBadge ?? getBadge(
    item.created_at,
    item.created_at,
    null, // Explore items don't have score
    allItems
  );
  return (
    <button
      onClick={() => onClick(item)}
      style={{
        width: "100%",
        borderRadius: 0,
        border: "none",
        backgroundColor: "transparent",
        overflow: "visible",
        cursor: "pointer",
        transition: "opacity 0.2s",
        textAlign: "left",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.75";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
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
              fontSize: "48px",
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
            {cleanText(item.title).slice(0, 24)}
          </span>
        </div>
      </div>
      <div style={{ padding: "0" }}>
        {/* Header with favicon, source, time */}
        {item.url && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
              fontSize: "11px",
              color: "var(--ink-tertiary)",
            }}
          >
            <img
              src={getFaviconUrl(getDomain(item.url), 16)}
              alt=""
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "2px",
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span>{cleanText(item.source)}</span>
            {(() => {
              const relativeTime = getRelativeTime(item.created_at, item.created_at);
              return relativeTime ? (
                <>
                  <span>•</span>
                  <span>{relativeTime}</span>
                </>
              ) : null;
            })()}
            {item.url && (
              <>
                <span>•</span>
                <span>{getDomain(item.url)}</span>
              </>
            )}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
            }}
          >
            {cleanText(item.title)}
          </div>
          {badge && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "10px",
                backgroundColor: badge === "new" ? "var(--control-bg)" : "var(--border)",
                color: "var(--ink)",
                border: "1px solid var(--border)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {getBadgeLabel(badge)}
            </span>
          )}
        </div>

        {/* Byline */}
        {item.byline && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--ink-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: "8px",
              fontWeight: 400,
            }}
          >
            {cleanText(item.byline)}
          </div>
        )}

        {/* Tags (up to 2) */}
        {(() => {
          const displayTags = getDisplayTags(item.tags, null, 2);
          return displayTags.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                marginBottom: "6px",
              }}
            >
              {displayTags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: "10px",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    backgroundColor: "var(--control-bg)",
                    color: "var(--ink-muted)",
                    border: "1px solid var(--border)",
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        {/* Why this is here */}
        {(() => {
          const whyHere = getWhyHere(item.source, item.kind, item.tags, null);
          return whyHere ? (
            <div
              style={{
                fontSize: "10px",
                color: "var(--ink-tertiary)",
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {whyHere}
            </div>
          ) : null;
        })()}
      </div>
    </button>
  );
}

