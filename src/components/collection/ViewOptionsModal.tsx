// src/components/collection/ViewOptionsModal.tsx
// Modal for view options (grid density, list view)

import React from "react";

export type ViewDensity = "compact" | "comfortable" | "spacious";
export type ViewMode = "grid" | "list";

interface ViewOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  density: ViewDensity;
  viewMode: ViewMode;
  onDensityChange: (density: ViewDensity) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewOptionsModal({
  isOpen,
  onClose,
  density,
  viewMode,
  onDensityChange,
  onViewModeChange,
}: ViewOptionsModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--studio-white)",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "400px",
          width: "90%",
          zIndex: 1001,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--studio-text)",
            marginBottom: "24px",
          }}
        >
          View Options
        </h2>

        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--studio-text)",
              marginBottom: "12px",
            }}
          >
            Layout
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: "8px",
                border: viewMode === "grid" ? "2px solid var(--studio-coral)" : "1px solid var(--studio-border)",
                background: viewMode === "grid" ? "var(--studio-coral-light)" : "var(--studio-white)",
                color: viewMode === "grid" ? "var(--studio-coral-dark)" : "var(--studio-text)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: "8px",
                border: viewMode === "list" ? "2px solid var(--studio-coral)" : "1px solid var(--studio-border)",
                background: viewMode === "list" ? "var(--studio-coral-light)" : "var(--studio-white)",
                color: viewMode === "list" ? "var(--studio-coral-dark)" : "var(--studio-text)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              List
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--studio-text)",
              marginBottom: "12px",
            }}
          >
            Density
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(["compact", "comfortable", "spacious"] as ViewDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDensityChange(d)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: density === d ? "2px solid var(--studio-coral)" : "1px solid var(--studio-border)",
                  background: density === d ? "var(--studio-coral-light)" : "var(--studio-white)",
                  color: density === d ? "var(--studio-coral-dark)" : "var(--studio-text)",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  textTransform: "capitalize",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "var(--studio-coral)",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
