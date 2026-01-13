import React, { useState, useEffect } from "react";
import { type EchoWithContent } from "../../data/echoApi";

type TimelineEchoPostProps = {
  echo: EchoWithContent;
  onDelete: (id: string) => void;
};

function kindEmoji(kind: string | null | undefined): string {
  if (!kind) return "📄";
  const lower = kind.toLowerCase();
  if (lower.includes("book")) return "📚";
  if (lower.includes("movie") || lower.includes("film")) return "🎬";
  if (lower.includes("tv") || lower.includes("show") || lower.includes("series")) return "📺";
  if (lower.includes("podcast")) return "🎧";
  if (lower.includes("article")) return "📰";
  if (lower.includes("music") || lower.includes("song")) return "🎵";
  return "📄";
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TimelineEchoPost({ echo, onDelete }: TimelineEchoPostProps) {
  const content = echo.content_items;
  const [contentExpanded, setContentExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <article
      style={{
        padding: "0 0 32px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: "32px",
      }}
    >
      {/* Reflection - hero content */}
      <div
        style={{
          fontSize: "18px",
          lineHeight: 1.7,
          color: "var(--ink)",
          marginBottom: "16px",
          fontWeight: 400,
        }}
      >
        {echo.note}
      </div>

      {/* Metadata line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: content ? "16px" : "0",
          fontSize: "13px",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>{formatTime(echo.created_at)}</span>
        {content && (
          <>
            <span>•</span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span>{kindEmoji(content.kind)}</span>
              <span>{content.kind || "Content"}</span>
            </span>
          </>
        )}
        {echo.shared_to_waves && (
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

      {/* Attached content - collapsible, secondary */}
      {content && (
        <div style={{ marginTop: "12px" }}>
          {!contentExpanded || isMobile ? (
            <button
              onClick={() => setContentExpanded(!isMobile && !contentExpanded)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--border)",
                border: "1px solid var(--border-strong)",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--ink-muted)",
                textAlign: "left",
                width: "100%",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--border-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--border)";
              }}
            >
              {content.image_url && (
                <img
                  src={content.image_url}
                  alt={content.title}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "4px",
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {content.title}
                </div>
              </div>
              {!isMobile && (
                <span style={{ fontSize: "11px", color: "var(--ink-tertiary)" }}>
                  {contentExpanded ? "Hide" : "Show"} original
                </span>
              )}
            </button>
          ) : (
            <div
              style={{
                padding: "12px",
                borderRadius: "6px",
                backgroundColor: "var(--border)",
                border: "1px solid var(--border-strong)",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "8px" }}>
                {content.image_url && (
                  <img
                    src={content.image_url}
                    alt={content.title}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "4px",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginBottom: "4px",
                    }}
                  >
                    {content.title}
                  </div>
                  {content.kind && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-tertiary)",
                      }}
                    >
                      {content.kind}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setContentExpanded(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--ink-tertiary)",
                  padding: "4px 0",
                  textDecoration: "underline",
                }}
              >
                Hide original
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
        }}
      >
        <div style={{ fontSize: "12px", color: "var(--ink-tertiary)" }}>
          {echo.shared_to_waves ? "Shared publicly" : "Private reflection"}
        </div>
        <button
          onClick={() => {
            if (confirm("Delete this Echo?")) {
              onDelete(echo.id);
            }
          }}
          style={{
            background: "none",
            border: "none",
            color: "rgba(239, 68, 68, 0.6)",
            cursor: "pointer",
            fontSize: "12px",
            padding: "4px 0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(239, 68, 68, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(239, 68, 68, 0.6)";
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

