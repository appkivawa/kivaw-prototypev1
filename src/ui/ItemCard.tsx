import type { ReactNode } from "react";
import type { ContentItem } from "../data/contentApi";
import RecommendationCover from "./RecommendationCover";

function kindEmoji(kind?: string | null) {
  const k = (kind || "").toLowerCase();
  if (k.includes("movement") || k.includes("walk") || k.includes("exercise")) return "🚶";
  if (k.includes("music") || k.includes("sound") || k.includes("playlist")) return "🎵";
  if (k.includes("logic")) return "🧠";
  if (k.includes("visual") || k.includes("aesthetic") || k.includes("art")) return "🎨";
  if (k.includes("prompt") || k.includes("reflection")) return "📝";
  if (k.includes("faith")) return "🙏";
  return "✦";
}

// Check if item is a public recommendation (external item from public_recommendations)
function isPublicRecommendation(item: ContentItem): boolean {
  // Public recommendations have isExternal flag and come from public_recommendations
  // They have source like 'tmdb', 'open_library', etc.
  return !!(item as any).isExternal && !!(item as any).source;
}

// Get type from item for RecommendationCover
function getRecommendationType(item: ContentItem): "watch" | "read" | "event" | "listen" {
  // Check focus_tags first (most reliable)
  const focusTags = (item as any).focus_tags || [];
  if (Array.isArray(focusTags)) {
    if (focusTags.includes("watch")) return "watch";
    if (focusTags.includes("read")) return "read";
    if (focusTags.includes("event")) return "event";
    if (focusTags.includes("listen")) return "listen";
  }
  
  // Fallback to kind
  const kind = (item.kind || "").toLowerCase();
  if (kind === "watch") return "watch";
  if (kind === "read") return "read";
  if (kind === "event") return "event";
  if (kind === "listen") return "listen";
  
  // Infer from kind content
  if (kind.includes("movie") || kind.includes("film") || kind.includes("video")) return "watch";
  if (kind.includes("book") || kind.includes("article")) return "read";
  
  return "watch"; // Default fallback
}

export default function ItemCard({
  item,
  onOpen,
  topMeta,
  action,
  bottomRight,
  className = "",
}: {
  item: ContentItem;
  onOpen: () => void;
  topMeta?: ReactNode;
  action?: ReactNode;
  bottomRight?: ReactNode;
  className?: string;
}) {
  const emoji = kindEmoji(item.kind);
  const img = item.image_url || "";
  const isRecommendation = isPublicRecommendation(item);

  return (
    <div
      className={`kivaw-rec-card ${className}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className="kivaw-rowCard">
        <div className="kivaw-thumb" aria-hidden="true">
          {isRecommendation ? (
            <RecommendationCover
              type={getRecommendationType(item)}
              imageUrl={item.image_url}
              title={item.title}
              height="100%"
              className="kivaw-thumb__cover"
              showImage={!!item.image_url}
            />
          ) : (
            <>
              <div className="kivaw-thumb__emoji">{emoji}</div>
              {img ? (
                <img
                  className="kivaw-thumb__img"
                  src={img}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
            </>
          )}
        </div>

        <div className="kivaw-rowCard__content">
          <div className="kivaw-rowCard__top">
            <div className="kivaw-rowCard__meta">{topMeta}</div>
            {action ? <div className="kivaw-rowCard__action">{action}</div> : null}
          </div>

          <div className="kivaw-rowCard__title">{item.title}</div>

          {bottomRight ? <div style={{ marginTop: 8 }}>{bottomRight}</div> : null}
        </div>
      </div>
    </div>
  );
}
