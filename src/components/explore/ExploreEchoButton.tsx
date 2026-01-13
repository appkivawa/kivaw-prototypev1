import React, { useState } from "react";

type ExploreEchoButtonProps = {
  cardId: string;
  onEchoClick: () => void;
};

export function ExploreEchoButton({ onEchoClick }: ExploreEchoButtonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <button
        onClick={onEchoClick}
        title="Echo"
        style={{
          width: 58,
          height: 58,
          borderRadius: 999,
          border: "1px solid var(--border-strong)",
          cursor: "pointer",
          background: "var(--surface)",
          fontWeight: 950,
          fontSize: "20px",
        }}
        >
        💭
      </button>
      <span style={{ fontSize: 12, opacity: 0.65, color: "var(--ink-tertiary)" }}>Echo</span>
    </div>
  );
}

