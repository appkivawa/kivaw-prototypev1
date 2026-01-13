import React, { useState } from "react";
import EchoComposer from "../echo/EchoComposer";
import { showToast } from "../ui/Toast";

type SavedItem = {
  id: string;
  kind?: string | null;
  title: string;
  byline?: string | null;
  image_url?: string | null;
  url?: string | null;
  source?: string | null;
};

type TimelineSavedItemProps = {
  item: SavedItem;
  onRemove: (id: string) => void;
};

export default function TimelineSavedItem({ item, onRemove }: TimelineSavedItemProps) {
  const [showEchoComposer, setShowEchoComposer] = useState(false);

  return (
    <article
      style={{
        padding: "0 0 20px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: "20px",
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
              color: "var(--ink)",
              marginBottom: "4px",
              lineHeight: 1.4,
            }}
          >
            {item.title}
          </div>
          {item.byline && (
            <div
              style={{
                fontSize: "13px",
                color: "var(--ink-muted)",
                marginBottom: "6px",
              }}
            >
              {item.byline}
            </div>
          )}
          {item.kind && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--ink-tertiary)",
                marginBottom: "8px",
              }}
            >
              {item.kind}
            </div>
          )}
          
          {/* Actions */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "8px" }}>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "13px",
                  color: "var(--ink-muted)",
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
            <button
              onClick={() => setShowEchoComposer(!showEchoComposer)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: showEchoComposer ? "var(--ink-muted)" : "var(--ink-tertiary)",
                padding: "0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--ink-muted)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = showEchoComposer ? "var(--ink-muted)" : "var(--ink-tertiary)";
              }}
            >
              💭 Echo
            </button>
            <button
              onClick={() => onRemove(item.id)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(239, 68, 68, 0.5)",
                cursor: "pointer",
                fontSize: "13px",
                padding: "0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(239, 68, 68, 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(239, 68, 68, 0.5)";
              }}
            >
              Remove
            </button>
          </div>

          {/* Inline Echo Composer */}
          {showEchoComposer && (
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
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
        </div>
      </div>
    </article>
  );
}

