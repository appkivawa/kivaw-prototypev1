import React, { useState, useEffect } from "react";
import EchoComposer from "../echo/EchoComposer";
import { saveLocal, unsaveLocal, isLocallySaved } from "../../data/savedLocal";
import { supabase } from "../../lib/supabaseClient";
import { showToast } from "../ui/Toast";

type Source = "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";

export type FeedPostItem = {
  id: string;
  source: Source;
  external_id: string;
  url: string;
  title: string;
  summary?: string | null;
  author?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  topics?: string[] | null;
  metadata?: Record<string, unknown>;
  score?: number;
};

type FeedPostProps = {
  item: FeedPostItem;
  index: number;
};

const SOURCE_ICONS: Record<Source, string> = {
  rss: "📰",
  youtube: "▶️",
  reddit: "👽",
  podcast: "🎧",
  eventbrite: "📅",
  spotify: "🎵",
};

const SOURCE_LABELS: Record<Source, string> = {
  rss: "RSS",
  youtube: "YouTube",
  reddit: "Reddit",
  podcast: "Podcast",
  eventbrite: "Event",
  spotify: "Spotify",
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function isVideoUrl(url: string, metadata?: Record<string, unknown>): boolean {
  if (metadata?.video_url) return true;
  if (metadata?.post_type === "video") return true;
  const lower = url.toLowerCase();
  return lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("vimeo.com");
}

export default function FeedPost({ item, index }: FeedPostProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showEchoComposer, setShowEchoComposer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasImage = item.image_url && !imageError;
  const isVideo = isVideoUrl(item.url, item.metadata);
  const hasSummary = item.summary && item.summary.trim().length > 0;
  const summaryText = item.summary || "";
  const shouldTruncate = summaryText.length > 150;
  const displaySummary = expanded || !shouldTruncate ? summaryText : summaryText.slice(0, 150) + "...";

  // Check if item is saved on mount
  useEffect(() => {
    setIsSaved(isLocallySaved(item.id));
  }, [item.id]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    try {
      if (isSaved) {
        unsaveLocal(item.id);
        setIsSaved(false);
        // Also try to remove from account if logged in
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
          // Try to remove from saved_items if it exists
          await supabase
            .from("saved_items")
            .delete()
            .eq("user_id", sessionData.session.user.id)
            .eq("content_id", item.id)
            .catch(() => {
              // Ignore errors - feed items might not be in saved_items
            });
        }
      } else {
        saveLocal(item.id);
        setIsSaved(true);
        // Also try to save to account if logged in
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
          // Try to save to saved_items if it exists
          await supabase
            .from("saved_items")
            .upsert(
              [
                {
                  user_id: sessionData.session.user.id,
                  content_id: item.id,
                },
              ],
              { onConflict: "user_id,content_id" }
            )
            .catch(() => {
              // Ignore errors - feed items might not be in saved_items
            });
        }
      }
    } catch (error) {
      console.error("Error saving item:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className="feed-post"
      style={{
        maxWidth: "680px",
        width: "100%",
        margin: "0 auto",
        padding: "0 0 32px 0",
        borderBottom: index === 0 ? "none" : "1px solid var(--border)",
        animation: `fadeInUp 0.3s ease-out ${index * 0.03}s both`,
      }}
    >
      {/* Header - minimal, inline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          fontSize: "13px",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>{SOURCE_ICONS[item.source]}</span>
        <span style={{ fontWeight: 500 }}>{SOURCE_LABELS[item.source]}</span>
        {item.published_at && (
          <>
            <span>•</span>
            <span>{timeAgo(item.published_at)}</span>
          </>
        )}
      </div>

      {/* Body */}
      <div>
        {/* Image or Video Preview - only if present, no heavy styling */}
        {hasImage && (
          <div
            style={{
              width: "100%",
              marginBottom: "16px",
              borderRadius: "4px",
              overflow: "hidden",
              backgroundColor: "var(--border)",
              position: "relative",
              maxHeight: "400px",
            }}
          >
            {!imageLoaded && (
              <div
                style={{
                  width: "100%",
                  paddingTop: "56.25%", // 16:9 aspect ratio
                  backgroundColor: "var(--border-strong)",
                  backgroundImage: "linear-gradient(90deg, var(--border) 0%, var(--border-strong) 50%, var(--border) 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s infinite",
                }}
              />
            )}
            {isVideo ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  paddingTop: "56.25%",
                  backgroundColor: "var(--border-strong)",
                }}
              >
                {imageLoaded && (
                  <img
                    src={item.image_url!}
                    alt=""
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageError(true);
                      setImageLoaded(true);
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
                  }}
                >
                  <span style={{ color: "white", fontSize: "24px", marginLeft: "4px" }}>▶</span>
                </div>
              </div>
            ) : (
              <img
                src={item.image_url!}
                alt={item.title}
                style={{
                  width: "100%",
                  height: "auto",
                  display: imageLoaded ? "block" : "none",
                  maxHeight: "500px",
                  objectFit: "cover",
                }}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(true);
                }}
              />
            )}
          </div>
        )}

        {/* Title - emphasized */}
        {item.title && (
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              lineHeight: 1.4,
              marginBottom: hasSummary ? "10px" : "8px",
              color: "var(--ink)",
            }}
          >
            <a
              href={item.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              {item.title}
            </a>
          </h2>
        )}

        {/* Summary - text-forward */}
        {hasSummary && (
          <div
            style={{
              fontSize: "15px",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
              marginBottom: "12px",
            }}
          >
            {displaySummary}
            {shouldTruncate && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  marginLeft: "4px",
                  background: "none",
                  border: "none",
                  color: "var(--ink-tertiary)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "15px",
                }}
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </div>
        )}

        {/* Source link - minimal */}
        {item.url && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "rgba(0,0,0,0.5)" }}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              {getDomain(item.url)} ↗
            </a>
          </div>
        )}
      </div>

      {/* Actions - lightweight, inline */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "12px",
          paddingTop: "12px",
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "none",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: "13px",
            color: isSaved ? "var(--ink-muted)" : "var(--ink-tertiary)",
            padding: "2px 0",
            opacity: saving ? 0.6 : 1,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              e.currentTarget.style.color = "var(--ink-muted)";
            }
          }}
          onMouseLeave={(e) => {
            if (!saving) {
              e.currentTarget.style.color = isSaved ? "var(--ink-muted)" : "var(--ink-tertiary)";
            }
          }}
        >
          {isSaved ? "⭐ Saved" : "☆ Save"}
        </button>
        <button
          onClick={() => setShowEchoComposer(!showEchoComposer)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            color: showEchoComposer ? "var(--ink-muted)" : "var(--ink-tertiary)",
            padding: "2px 0",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(0,0,0,0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = showEchoComposer ? "var(--ink-muted)" : "var(--ink-tertiary)";
          }}
        >
          💭 Echo
        </button>
      </div>

      {/* Inline Echo Composer */}
      {showEchoComposer && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <EchoComposer
            contentId={item.id}
            inline={true}
            onClose={() => setShowEchoComposer(false)}
            onSaved={() => {
              setShowEchoComposer(false);
              showToast("Saved to Timeline");
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </article>
  );
}

