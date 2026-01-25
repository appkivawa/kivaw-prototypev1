// src/components/timeline/TimelineWidgets.tsx
// Right sidebar widgets for Timeline page

import React from "react";
import { useNavigate } from "react-router-dom";

interface TimelineWidgetsProps {
  nowPlaying: { title: string; artist?: string; image_url?: string } | null;
  upNext: { title: string; type: string; image_url?: string } | null;
  signalScore: number | null;
}

export default function TimelineWidgets({ nowPlaying, upNext, signalScore }: TimelineWidgetsProps) {
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: "280px",
        flexShrink: 0,
        paddingLeft: "32px",
        paddingTop: "24px",
      }}
    >
      {/* Now Playing Widget */}
      {nowPlaying && (
        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            background: "var(--studio-white)",
            border: "1px solid var(--studio-border)",
            borderRadius: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--studio-text-muted)",
              marginBottom: "12px",
            }}
          >
            NOW PLAYING
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {nowPlaying.image_url && (
              <img
                src={nowPlaying.image_url}
                alt={nowPlaying.title}
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
                  fontWeight: 500,
                  color: "var(--studio-text)",
                  marginBottom: "2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {nowPlaying.title}
              </div>
              {nowPlaying.artist && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--studio-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {nowPlaying.artist}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Up Next Widget */}
      {upNext && (
        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            background: "var(--studio-white)",
            border: "1px solid var(--studio-border)",
            borderRadius: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--studio-text-muted)",
              marginBottom: "12px",
            }}
          >
            UP NEXT
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {upNext.image_url && (
              <img
                src={upNext.image_url}
                alt={upNext.title}
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
                  fontSize: "12px",
                  color: "var(--studio-text-muted)",
                  marginBottom: "4px",
                }}
              >
                {upNext.type}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--studio-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {upNext.title}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal Score Widget */}
      {signalScore !== null && (
        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            background: "var(--studio-white)",
            border: "1px solid var(--studio-border)",
            borderRadius: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--studio-text-muted)",
              marginBottom: "8px",
            }}
          >
            SIGNAL SCORE
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--studio-coral)",
            }}
          >
            {signalScore.toFixed(1)}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--studio-text-secondary)",
              marginTop: "4px",
            }}
          >
            Based on your preferences
          </div>
        </div>
      )}

      {/* Customize Sources Button */}
      <button
        type="button"
        onClick={() => navigate("/preferences")}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "var(--studio-white)",
          border: "1px solid var(--studio-border)",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--studio-text)",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--studio-gray-50)";
          e.currentTarget.style.borderColor = "var(--studio-gray-300)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--studio-white)";
          e.currentTarget.style.borderColor = "var(--studio-border)";
        }}
      >
        Customize Sources
      </button>
    </aside>
  );
}
