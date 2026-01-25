// src/components/collection/CollectionSidebar.tsx
// Left sidebar for Collection page

import React from "react";
import type { LibraryFilter } from "../../utils/collectionHelpers";

interface LibraryItem {
  key: LibraryFilter;
  label: string;
  count: number;
}

interface JournalItem {
  key: "echoes" | "history";
  label: string;
  count?: number;
}

interface BoardItem {
  key: string;
  label: string;
  count?: number;
}

interface CollectionSidebarProps {
  activeLibraryFilter: LibraryFilter | null;
  activeJournalFilter: "echoes" | "history" | null;
  activeBoard: string | null;
  libraryItems: LibraryItem[];
  journalItems: JournalItem[];
  boards: BoardItem[];
  onLibraryClick: (filter: LibraryFilter) => void;
  onJournalClick: (filter: "echoes" | "history") => void;
  onBoardClick: (boardKey: string) => void;
  onNewBoardClick: () => void;
}

export default function CollectionSidebar({
  activeLibraryFilter,
  activeJournalFilter,
  activeBoard,
  libraryItems,
  journalItems,
  boards,
  onLibraryClick,
  onJournalClick,
  onBoardClick,
  onNewBoardClick,
}: CollectionSidebarProps) {
  return (
    <aside
      style={{
        width: "240px",
        flexShrink: 0,
        paddingRight: "32px",
        paddingTop: "24px",
      }}
    >
      {/* MY LIBRARY Section */}
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
          MY LIBRARY
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {libraryItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onLibraryClick(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "6px",
                background: activeLibraryFilter === item.key ? "var(--studio-coral-light)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeLibraryFilter === item.key ? 500 : 400,
                color: activeLibraryFilter === item.key ? "var(--studio-coral-dark)" : "var(--studio-text)",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (activeLibraryFilter !== item.key) {
                  e.currentTarget.style.background = "var(--studio-gray-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeLibraryFilter !== item.key) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span>{item.label}</span>
              {item.count > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: activeLibraryFilter === item.key ? "var(--studio-coral-dark)" : "var(--studio-text-muted)",
                    background: activeLibraryFilter === item.key ? "var(--studio-white)" : "var(--studio-gray-100)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* JOURNAL Section */}
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
          JOURNAL
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {journalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onJournalClick(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "6px",
                background: activeJournalFilter === item.key ? "var(--studio-coral-light)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeJournalFilter === item.key ? 500 : 400,
                color: activeJournalFilter === item.key ? "var(--studio-coral-dark)" : "var(--studio-text)",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (activeJournalFilter !== item.key) {
                  e.currentTarget.style.background = "var(--studio-gray-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeJournalFilter !== item.key) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: activeJournalFilter === item.key ? "var(--studio-coral-dark)" : "var(--studio-text-muted)",
                    background: activeJournalFilter === item.key ? "var(--studio-white)" : "var(--studio-gray-100)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* BOARDS Section */}
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
          BOARDS
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {boards.map((board) => (
            <button
              key={board.key}
              type="button"
              onClick={() => onBoardClick(board.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "6px",
                background: activeBoard === board.key ? "var(--studio-coral-light)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeBoard === board.key ? 500 : 400,
                color: activeBoard === board.key ? "var(--studio-coral-dark)" : "var(--studio-text)",
                textAlign: "left",
                width: "100%",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (activeBoard !== board.key) {
                  e.currentTarget.style.background = "var(--studio-gray-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeBoard !== board.key) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span>{board.label}</span>
              {board.count !== undefined && board.count > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: activeBoard === board.key ? "var(--studio-coral-dark)" : "var(--studio-text-muted)",
                    background: activeBoard === board.key ? "var(--studio-white)" : "var(--studio-gray-100)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {board.count}
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={onNewBoardClick}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: "6px",
              background: "var(--studio-coral-light)",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--studio-coral-dark)",
              textAlign: "left",
              width: "100%",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
              marginTop: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--studio-coral)";
              e.currentTarget.style.color = "var(--studio-white)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--studio-coral-light)";
              e.currentTarget.style.color = "var(--studio-coral-dark)";
            }}
          >
            + New Board
          </button>
        </div>
      </div>
    </aside>
  );
}
