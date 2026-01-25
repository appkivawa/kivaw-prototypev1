// src/components/FilterDrawer.tsx
// Filter drawer component for Explore page filters

import { useEffect } from "react";

type Signal =
  | "all"
  | "news"
  | "social"
  | "podcast"
  | "video"
  | "music"
  | "watch"
  | "read"
  | "creator";

const FILTERS: { id: Signal; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "✨" },
  { id: "news", label: "News", icon: "📰" },
  { id: "social", label: "Social", icon: "💬" },
  { id: "podcast", label: "Podcasts", icon: "🎧" },
  { id: "video", label: "Video", icon: "🎬" },
  { id: "music", label: "Music", icon: "🎵" },
  { id: "watch", label: "Watch", icon: "📺" },
  { id: "read", label: "Read", icon: "📚" },
  { id: "creator", label: "Creators", icon: "👤" },
];

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: Signal;
  onFilterChange: (filter: Signal) => void;
}

export function FilterDrawer({ isOpen, onClose, activeFilter, onFilterChange }: FilterDrawerProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFilterClick = (filterId: Signal) => {
    onFilterChange(filterId);
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="filter-drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Filters</h2>
          <button className="drawer-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="drawer-content">
          <div className="filter-section">
            <h3 className="filter-label">Content type</h3>
            <div className="filter-options">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  className={`filter-option ${activeFilter === filter.id ? "active" : ""}`}
                  onClick={() => handleFilterClick(filter.id)}
                  type="button"
                >
                  <span className="filter-option-icon">{filter.icon}</span>
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <button className="studio-btn studio-btn--secondary" onClick={() => handleFilterClick("all")} type="button">
            Clear all
          </button>
          <button className="studio-btn studio-btn--primary" onClick={onClose} type="button">
            Apply filters
          </button>
        </div>
      </div>
    </>
  );
}
