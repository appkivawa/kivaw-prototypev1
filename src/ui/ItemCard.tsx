import type { ReactNode } from "react";
import type { ContentItem } from "../data/contentApi";

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
