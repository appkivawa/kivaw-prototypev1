import React from "react";
import { type EchoWithContent } from "../../data/echoApi";
import type { SavedItem } from "../../pages/Timeline";

type DayDrawerProps = {
  date: string;
  echoes?: EchoWithContent[];
  savedItems?: SavedItem[];
  viewMode: "echo" | "saved";
  onClose: () => void;
  onDeleteEcho?: (id: string) => void;
  onRemoveSaved?: (id: string) => void;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) {
    return "Today";
  }
  if (itemDate.getTime() === today.getTime() - 86400000) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

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

export default function DayDrawer({
  date,
  echoes = [],
  savedItems = [],
  viewMode,
  onClose,
  onDeleteEcho,
  onRemoveSaved,
}: DayDrawerProps) {
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    // Mobile: modal
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1000,
          display: "flex",
          alignItems: "flex-end",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxHeight: "80vh",
            backgroundColor: "var(--studio-white)",
            borderRadius: "20px 20px 0 0",
            padding: "20px",
            overflowY: "auto",
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.12)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--studio-text)",
                margin: 0,
              }}
            >
              {formatDate(date)}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "var(--studio-text-muted)",
                padding: "4px 8px",
              }}
            >
              ×
            </button>
          </div>
          <Content />
        </div>
      </div>
    );
  }

  // Desktop: right-side drawer
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "420px",
        backgroundColor: "var(--studio-white)",
        borderLeft: "1px solid var(--studio-border)",
        boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.08)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "20px",
          borderBottom: "1px solid var(--studio-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--studio-text)",
            margin: 0,
          }}
        >
          {formatDate(date)}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            color: "var(--studio-text-muted)",
            padding: "4px 8px",
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
        }}
      >
        <Content />
      </div>
    </div>
  );

  function Content() {
    if (viewMode === "echo") {
      if (echoes.length === 0) {
        return (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--studio-text-muted)" }}>
            No Echoes on this day
          </div>
        );
      }

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {echoes
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((echo) => (
              <div
                key={echo.id}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--studio-border)",
                  backgroundColor: "var(--studio-gray-50)",
                }}
              >
                {/* Echo text - main content */}
                <div
                  style={{
                    fontSize: "16px",
                    lineHeight: 1.6,
                    color: "var(--studio-text)",
                    marginBottom: echo.content_items ? "12px" : "0",
                  }}
                >
                  {echo.note}
                </div>

                {/* Attachment card - small, underneath */}
                {echo.content_items && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "var(--studio-white)",
                      border: "1px solid var(--studio-gray-300)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      {echo.content_items.image_url && (
                        <img
                          src={echo.content_items.image_url}
                          alt={echo.content_items.title}
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "6px",
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
                            color: "var(--studio-text)",
                            marginBottom: "4px",
                          }}
                        >
                          {echo.content_items.title}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--studio-text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>{kindEmoji(echo.content_items.kind)}</span>
                          <span>{echo.content_items.kind || "Content"}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={`/item/${echo.content_items.id}`}
                      style={{
                        fontSize: "13px",
                        color: "var(--studio-text-secondary)",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      Open →
                    </a>
                  </div>
                )}

                {/* Actions */}
                {onDeleteEcho && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      onClick={() => {
                        if (confirm("Delete this Echo?")) {
                          onDeleteEcho(echo.id);
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#DC2626",
                        cursor: "pointer",
                        fontSize: "12px",
                        padding: "4px 0",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#DC2626";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#DC2626";
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      );
    } else {
      // Saved view
      if (savedItems.length === 0) {
        return (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--studio-text-muted)" }}>
            No saved items on this day
          </div>
        );
      }

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {savedItems
            .sort(
              (a, b) =>
                new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            )
            .map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--studio-border)",
                  backgroundColor: "var(--studio-gray-50)",
                }}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "6px",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--studio-text)",
                        marginBottom: "4px",
                      }}
                    >
                      {item.title}
                    </div>
                    {item.byline && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "var(--studio-text-secondary)",
                          marginBottom: "6px",
                        }}
                      >
                        {item.byline}
                      </div>
                    )}
                    {item.source && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--studio-text-muted)",
                          marginBottom: "8px",
                        }}
                      >
                        {item.source}
                      </div>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "13px",
                          color: "var(--studio-text-secondary)",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        Open →
                      </a>
                    )}
                  </div>
                  {onRemoveSaved && (
                    <button
                      onClick={() => onRemoveSaved(item.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#DC2626",
                        cursor: "pointer",
                        fontSize: "12px",
                        padding: "4px 0",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#DC2626";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(239, 68, 68, 0.5)";
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      );
    }
  }
}

