import React, { useState, useEffect } from "react";
import EchoComposer from "../echo/EchoComposer";
import { saveLocal, unsaveLocal, isLocallySaved } from "../../data/savedLocal";
import { supabase } from "../../lib/supabaseClient";
import { showToast } from "../ui/Toast";
import { getEchoByContentId, type EchoWithContent } from "../../data/echoApi";
import { useSession } from "../../auth/useSession";
import LoginModal from "../auth/LoginModal";
import { getRelativeTime, getDomain, getFaviconUrl, getDisplayTags, getWhyHere } from "../../utils/cardHelpers";
import { getBadge, getBadgeLabel, type BadgeType } from "../../utils/badgeHelpers";

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
  allItems?: Array<{
    score?: number | null;
    published_at?: string | null;
    ingested_at?: string | null;
  }>; // For badge calculation context
  badge?: BadgeType; // Pre-calculated badge (optional, will calculate if not provided)
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

// timeAgo removed - using getRelativeTime from cardHelpers instead

// isNew function removed - using getBadge from badgeHelpers instead

// getDomain removed - using from cardHelpers instead

function getDomainInitial(url: string): string {
  const domain = getDomain(url);
  return domain.charAt(0).toUpperCase();
}

function getDomainGradient(domain: string): string {
  // Generate a consistent gradient based on domain
  const hash = domain.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  const sat = 60 + (hash % 20);
  const light = 75 + (hash % 15);
  return `linear-gradient(135deg, hsl(${hue}, ${sat}%, ${light}%), hsl(${(hue + 30) % 360}, ${sat}%, ${light - 10}%))`;
}

function isVideoUrl(url: string, metadata?: Record<string, unknown>): boolean {
  if (metadata?.video_url) return true;
  if (metadata?.post_type === "video") return true;
  const lower = url.toLowerCase();
  return lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("vimeo.com");
}

export default function FeedPostTumblr({ item, index, allItems = [], badge: providedBadge }: FeedPostProps) {
  const { isAuthed } = useSession();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showEchoComposer, setShowEchoComposer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingEcho, setExistingEcho] = useState<EchoWithContent | null>(null);
  const [loadingEcho, setLoadingEcho] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const hasImage = item.image_url && !imageError;
  const isVideo = isVideoUrl(item.url, item.metadata);
  const domain = getDomain(item.url);
  const ingestedAt = (item.metadata as any)?.ingested_at;
  
  // Calculate badge if not provided
  const badge = providedBadge ?? getBadge(
    item.published_at,
    ingestedAt,
    item.score,
    allItems
  );

  // Check if item is saved on mount
  useEffect(() => {
    setIsSaved(isLocallySaved(item.id));
  }, [item.id]);

  // Load existing echo for this content item
  useEffect(() => {
    async function loadEcho() {
      try {
        const echo = await getEchoByContentId(item.id);
        setExistingEcho(echo);
      } catch (error) {
        console.error("Error loading echo:", error);
      } finally {
        setLoadingEcho(false);
      }
    }
    loadEcho();
  }, [item.id]);

  async function handleSave() {
    if (saving) return;

    // Show login modal if not authenticated
    if (!isAuthed) {
      // Store pending action
      const { storePendingAction } = await import("../../utils/pendingActions");
      storePendingAction({ type: "save", contentId: item.id, shouldSave: !isSaved });
      setShowLoginModal(true);
      return;
    }

    setSaving(true);

    try {
      if (isSaved) {
        unsaveLocal(item.id);
        setIsSaved(false);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
          await supabase
            .from("saved_items")
            .delete()
            .eq("user_id", sessionData.session.user.id)
            .eq("content_id", item.id)
            .catch(() => {});
        }
      } else {
        saveLocal(item.id);
        setIsSaved(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
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
            .catch(() => {});
        }
      }
    } catch (error) {
      console.error("Error saving item:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleEchoSaved() {
    // Reload the echo after saving
    try {
      const echo = await getEchoByContentId(item.id);
      setExistingEcho(echo);
      setShowEchoComposer(false);
      showToast("Saved to Timeline");
    } catch (error) {
      console.error("Error reloading echo:", error);
    }
  }

  return (
    <article
      style={{
        maxWidth: "680px",
        width: "100%",
        margin: "0 auto 32px",
        padding: "0",
        position: "relative",
        animation: `fadeInUp 0.3s ease-out ${index * 0.03}s both`,
      }}
    >
      {/* Left accent line when composer is open */}
      {showEchoComposer && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "4px",
            backgroundColor: "var(--ink)",
            borderRadius: "2px",
            zIndex: 1,
          }}
        />
      )}

      {/* Main card */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "22px",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
          overflow: "hidden",
          marginLeft: showEchoComposer ? "12px" : "0",
          transition: "margin-left 0.3s ease-out",
        }}
      >
        {/* Existing Echo (Your take) - shown above content like a reblog comment */}
        {existingEcho && !showEchoComposer && (
          <div
            style={{
              padding: "20px 20px 16px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--border)",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                lineHeight: 1.6,
                color: "var(--ink)",
                marginBottom: "8px",
                fontWeight: 400,
              }}
            >
              {existingEcho.note}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--ink-tertiary)",
              }}
            >
              <span>Your take</span>
              {existingEcho.shared_to_waves && (
                <>
                  <span>•</span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      color: "rgba(34, 197, 94, 0.8)",
                      fontSize: "11px",
                      fontWeight: 500,
                    }}
                  >
                    Public
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Media header (if image exists) */}
        {hasImage && (
          <div
            style={{
              width: "100%",
              aspectRatio: isVideo ? "16/9" : "auto",
              maxHeight: "500px",
              backgroundColor: "var(--border)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {!imageLoaded && (
              <div
                style={{
                  width: "100%",
                  paddingTop: isVideo ? "56.25%" : "66.67%",
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

        {/* Domain placeholder (if no image) */}
        {!hasImage && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: getDomainGradient(domain),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.9)",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            {getDomainInitial(item.url)}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "20px" }}>
          {/* Header - favicon, source, time, domain */}
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
            {/* Favicon */}
            <img
              src={getFaviconUrl(domain)}
              alt=""
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "2px",
                flexShrink: 0,
              }}
              onError={(e) => {
                // Fallback to source icon if favicon fails
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span style={{ fontWeight: 500 }}>{SOURCE_LABELS[item.source]}</span>
            {(() => {
              const relativeTime = getRelativeTime(item.published_at, ingestedAt);
              return relativeTime ? (
                <>
                  <span>•</span>
                  <span>{relativeTime}</span>
                </>
              ) : null;
            })()}
            <span>•</span>
            <span>{domain}</span>
          </div>

          {/* Title */}
          {item.title && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginBottom: item.summary ? "12px" : "8px",
              }}
            >
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  margin: 0,
                  color: "var(--ink)",
                  flex: 1,
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
              {badge && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "12px",
                    backgroundColor: badge === "new" ? "var(--control-bg)" : "var(--border)",
                    color: "var(--ink)",
                    border: "1px solid var(--border)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                    marginTop: "2px",
                    flexShrink: 0,
                  }}
                >
                  {getBadgeLabel(badge)}
                </span>
              )}
            </div>
          )}

          {/* Summary */}
          {item.summary && (
            <div
              style={{
                fontSize: "15px",
                lineHeight: 1.7,
                color: "var(--ink-muted)",
                marginBottom: "12px",
              }}
            >
              {item.summary.length > 200 ? `${item.summary.slice(0, 200)}...` : item.summary}
            </div>
          )}

          {/* Tags/Topics (up to 2) */}
          {(() => {
            const displayTags = getDisplayTags(item.tags, item.topics, 2);
            return displayTags.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "12px",
                }}
              >
                {displayTags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "12px",
                      padding: "4px 10px",
                      borderRadius: "12px",
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
            const whyHere = getWhyHere(
              SOURCE_LABELS[item.source],
              (item.metadata as any)?.category,
              item.tags,
              item.topics
            );
            return whyHere ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--ink-tertiary)",
                  marginBottom: "16px",
                  fontStyle: "italic",
                }}
              >
                Why this is here: {whyHere}
              </div>
            ) : null;
          })()}

          {/* Actions - clean and aligned */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: "none",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "14px",
                color: isSaved ? "var(--ink)" : "var(--ink-muted)",
                padding: "4px 0",
                opacity: saving ? 0.6 : 1,
                fontWeight: isSaved ? 600 : 400,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.color = "var(--ink)";
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.color = isSaved ? "var(--ink)" : "var(--ink-muted)";
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
                fontSize: "14px",
                color: showEchoComposer ? "var(--ink)" : "var(--ink-muted)",
                padding: "4px 0",
                fontWeight: showEchoComposer ? 600 : 400,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = showEchoComposer ? "var(--ink)" : "var(--ink-muted)";
              }}
            >
              💭 Echo
            </button>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "14px",
                color: "var(--ink-muted)",
                textDecoration: "none",
                padding: "4px 0",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--ink-muted)";
              }}
            >
              → Open
            </a>
          </div>
        </div>

        {/* Inline Echo Composer - animated */}
        {showEchoComposer && (
          <div
            style={{
              padding: "20px",
              paddingTop: "20px",
              backgroundColor: "var(--border)",
              animation: "slideDown 0.3s ease-out",
            }}
          >
            <EchoComposer
              contentId={item.id}
              inline={true}
              onClose={() => setShowEchoComposer(false)}
              onSaved={handleEchoSaved}
            />
          </div>
        )}
      </div>

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

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
            padding-top: 20px;
            padding-bottom: 20px;
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

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Sign in to save"
        message="We'll send you a magic link to sign in."
        pendingAction={{ type: "save", contentId: item.id, shouldSave: !isSaved }}
      />
    </article>
  );
}

