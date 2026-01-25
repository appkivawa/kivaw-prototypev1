// src/components/collection/EchoCard.tsx
// Minimal card wrapper for Recent Echoes grid
// Reuses existing Card component and TimelineEchoPost patterns

import React from "react";
import Card from "../../ui/Card";
import type { EchoWithContent } from "../../data/echoApi";

interface EchoCardProps {
  echo: EchoWithContent;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EchoCard({ echo }: EchoCardProps) {
  const content = echo.content_items;
  const firstLine = echo.note?.split("\n")[0]?.trim() || "";
  const preview = firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;

  return (
    <Card variant="outlined" className="collection-echo-card">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          {content?.image_url && (
            <img
              src={content.image_url}
              alt={content.title || "Content"}
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "8px",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--studio-text)", margin: "0 0 4px 0" }}>
              {content?.title || "Echo"}
            </h3>
            <div style={{ fontSize: "13px", color: "var(--studio-text-muted)" }}>
              {formatRelativeTime(echo.created_at)}
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: "var(--studio-text-secondary)",
            fontStyle: "italic",
            padding: "12px",
            background: "var(--studio-gray-50)",
            borderRadius: "8px",
            borderLeft: "3px solid var(--studio-coral)",
          }}
        >
          "{preview}"
        </div>
        <div style={{ fontSize: "12px", color: "var(--studio-text-muted)" }}>
          {echo.shared_to_waves ? "Shared to Twitter" : "Private reflection"}
        </div>
      </div>
    </Card>
  );
}
