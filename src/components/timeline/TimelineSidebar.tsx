// src/components/timeline/TimelineSidebar.tsx
// Left sidebar for Timeline page with Channels and My Collections

import React from "react";

export type ChannelType = "all" | "news" | "social" | "podcast" | "music" | "tv_movies";

export type CollectionType = "read_later" | "favorites";

interface Channel {
  key: ChannelType;
  label: string;
  count: number;
}

interface Collection {
  key: CollectionType;
  label: string;
  count: number;
}

interface TimelineSidebarProps {
  activeChannel: ChannelType | null;
  activeCollection: CollectionType | null;
  channels: Channel[];
  collections: Collection[];
  onChannelClick: (channel: ChannelType) => void;
  onCollectionClick: (collection: CollectionType) => void;
}

export default function TimelineSidebar({
  activeChannel,
  activeCollection,
  channels,
  collections,
  onChannelClick,
  onCollectionClick,
}: TimelineSidebarProps) {
  return (
    <aside
      style={{
        width: "240px",
        flexShrink: 0,
        paddingRight: "32px",
        paddingTop: "24px",
      }}
    >
      {/* CHANNELS Section */}
      <div style={{ marginBottom: "40px" }}>
        <h3
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--studio-text-muted)",
            marginBottom: "16px",
          }}
        >
          CHANNELS
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {channels.map((channel) => (
            <button
              key={channel.key}
              type="button"
              onClick={() => onChannelClick(channel.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "6px",
                background: activeChannel === channel.key ? "var(--studio-coral-light)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeChannel === channel.key ? 500 : 400,
                color: activeChannel === channel.key ? "var(--studio-coral-dark)" : "var(--studio-text)",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (activeChannel !== channel.key) {
                  e.currentTarget.style.background = "var(--studio-gray-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeChannel !== channel.key) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span>{channel.label}</span>
              {channel.count > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: activeChannel === channel.key ? "var(--studio-coral-dark)" : "var(--studio-text-muted)",
                    background: activeChannel === channel.key ? "var(--studio-white)" : "var(--studio-gray-100)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {channel.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* MY COLLECTIONS Section */}
      <div>
        <h3
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--studio-text-muted)",
            marginBottom: "16px",
          }}
        >
          MY COLLECTIONS
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {collections.map((collection) => (
            <button
              key={collection.key}
              type="button"
              onClick={() => onCollectionClick(collection.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "6px",
                background: activeCollection === collection.key ? "var(--studio-coral-light)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeCollection === collection.key ? 500 : 400,
                color: activeCollection === collection.key ? "var(--studio-coral-dark)" : "var(--studio-text)",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (activeCollection !== collection.key) {
                  e.currentTarget.style.background = "var(--studio-gray-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeCollection !== collection.key) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span>{collection.label}</span>
              {collection.count > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: activeCollection === collection.key ? "var(--studio-coral-dark)" : "var(--studio-text-muted)",
                    background: activeCollection === collection.key ? "var(--studio-white)" : "var(--studio-gray-100)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {collection.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
