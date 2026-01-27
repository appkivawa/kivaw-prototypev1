import React, { useState, useEffect } from "react";
import EchoComposer from "../echo/EchoComposer";
import { saveLocal, unsaveLocal, isLocallySaved } from "../../data/savedLocal";
import { supabase } from "../../lib/supabaseClient";
import { showToast } from "../ui/Toast";
import Tag from "../../ui/Tag";

export type ContentCardItem = {
  id: string;
  content_kind: string;
  provider: string;
  external_id?: string | null;
  url?: string | null;
  title: string;
  summary?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  topics?: string[] | null;
  score?: number | null;
  score_final?: number | null;
};

type ContentCardProps = {
  item: ContentCardItem;
  index?: number;
  featured?: boolean;
};

const CONTENT_KIND_ICONS: Record<string, string> = {
  rss: "📰",
  movie: "🎬",
  book: "📚",
  podcast: "🎧",
  music: "🎵",
  video: "▶️",
};

const CONTENT_KIND_LABELS: Record<string, string> = {
  rss: "Article",
  movie: "Movie",
  book: "Book",
  podcast: "Podcast",
  music: "Music",
  video: "Video",
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

function getDomain(url?: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function ContentCard({ item, index = 0, featured = false }: ContentCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showEchoComposer, setShowEchoComposer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const kind = item.content_kind || "rss";
  const icon = CONTENT_KIND_ICONS[kind] || "📄";
  const label = CONTENT_KIND_LABELS[kind] || kind;
  const hasImage = item.image_url && !imageError;
  const hasSummary = item.summary && item.summary.trim().length > 0;
  const summaryText = item.summary || "";
  const shouldTruncate = summaryText.length > 150;
  const displaySummary = expanded || !shouldTruncate ? summaryText : summaryText.slice(0, 150) + "...";
  const allTags = [...(item.tags || []), ...(item.topics || [])];

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
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
          await supabase
            .from("saved_items")
            .delete()
            .eq("user_id", sessionData.session.user.id)
            .eq("content_id", item.id);
          // Ignore errors silently
        }
      } else {
        saveLocal(item.id);
        setIsSaved(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
          await supabase
            .from("saved_items")
            .upsert([{ user_id: sessionData.session.user.id, content_id: item.id }], {
              onConflict: "user_id,content_id",
            });
          // Ignore errors silently
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
      className={`content-card ${featured ? "content-card-featured" : "content-card-grid"}`}
      style={{
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
          color: "var(--text-muted)",
        }}
      >
        <span>{icon}</span>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {item.published_at && (
          <>
            <span>•</span>
            <span>{timeAgo(item.published_at)}</span>
          </>
        )}
      </div>

      {/* Body */}
      <div>
        {/* Image - only if present */}
        {hasImage && (
          <div
            style={{
              width: "100%",
              marginBottom: "16px",
              borderRadius: "4px",
              overflow: "hidden",
              backgroundColor: "var(--border-subtle)",
              position: "relative",
              maxHeight: featured ? "500px" : "400px",
            }}
          >
            {!imageLoaded && (
              <div
                style={{
                  width: "100%",
                  paddingTop: "56.25%",
                  backgroundColor: "var(--border-subtle)",
                }}
              />
            )}
            <img
              src={item.image_url!}
              alt={item.title}
              style={{
                width: "100%",
                height: "auto",
                display: imageLoaded ? "block" : "none",
                maxHeight: featured ? "500px" : "400px",
                objectFit: "cover",
              }}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
            />
          </div>
        )}

        {/* Title */}
        {item.title && (
          <h2
            style={{
              fontSize: featured ? "32px" : "20px",
              fontWeight: featured ? 700 : 600,
              lineHeight: featured ? 1.3 : 1.4,
              marginBottom: hasSummary ? (featured ? "16px" : "10px") : (featured ? "12px" : "8px"),
              color: "var(--text-primary)",
            }}
          >
            {item.url ? (
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
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h2>
        )}

        {/* Summary */}
        {hasSummary && (
          <div
            style={{
              fontSize: featured ? "18px" : "15px",
              lineHeight: featured ? 1.7 : 1.6,
              color: "var(--text-secondary)",
              marginBottom: featured ? "16px" : "12px",
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
                  color: "var(--text-muted)",
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

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ marginTop: featured ? "16px" : "12px", marginBottom: featured ? "16px" : "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {allTags.slice(0, featured ? 8 : 4).map((tag, i) => (
              <Tag key={i} label={tag} variant="subtle" />
            ))}
          </div>
        )}

        {/* Source link */}
        {item.url && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
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

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid var(--border-subtle)",
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
            color: isSaved ? "var(--text-muted)" : "var(--text-secondary)",
            padding: "2px 0",
            opacity: saving ? 0.6 : 1,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              e.currentTarget.style.color = "var(--text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!saving) {
              e.currentTarget.style.color = isSaved ? "var(--text-muted)" : "var(--text-secondary)";
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
            color: showEchoComposer ? "var(--text-muted)" : "var(--text-secondary)",
            padding: "2px 0",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = showEchoComposer ? "var(--text-muted)" : "var(--text-secondary)";
          }}
        >
          💭 Echo
        </button>
      </div>

      {/* Echo Composer */}
      {showEchoComposer && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-subtle)",
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
      `}</style>
    </article>
  );
}




