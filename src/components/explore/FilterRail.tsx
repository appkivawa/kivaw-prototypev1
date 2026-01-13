import React, { useState, useEffect } from "react";

export type ContentType = "movie" | "tv" | "book" | "podcast" | "news" | "reddit" | "youtube" | "all";
export type SortOption = "foryou" | "trending" | "new" | "short" | "long";
export type MoodFilter = "all" | "blank" | "destructive" | "expansive" | "minimize";

const MOOD_OPTIONS: { value: MoodFilter; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "blank", label: "Blank", emoji: "☁️" },
  { value: "destructive", label: "Destructive", emoji: "🔥" },
  { value: "expansive", label: "Expansive", emoji: "🌱" },
  { value: "minimize", label: "Minimize", emoji: "🌙" },
];

type FilterRailProps = {
  selectedTypes: ContentType[];
  onTypesChange: (types: ContentType[]) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  moodFilter: MoodFilter;
  onMoodChange: (mood: MoodFilter) => void;
};

export default function FilterRail({
  selectedTypes,
  onTypesChange,
  sortOption,
  onSortChange,
  moodFilter,
  onMoodChange,
}: FilterRailProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-close on mobile when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (window.innerWidth < 768 && !target.closest(".filter-rail")) {
        setIsOpen(false);
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  const toggleType = (type: ContentType) => {
    if (type === "all") {
      onTypesChange(["all"]);
    } else {
      const newTypes = selectedTypes.includes(type)
        ? selectedTypes.filter((t) => t !== type && t !== "all")
        : [...selectedTypes.filter((t) => t !== "all"), type];
      onTypesChange(newTypes.length === 0 ? ["all"] : newTypes);
    }
  };

  const contentTypes: { value: ContentType; label: string; emoji: string }[] = [
    { value: "movie", label: "Movies", emoji: "🎬" },
    { value: "tv", label: "TV", emoji: "📺" },
    { value: "book", label: "Books", emoji: "📚" },
    { value: "podcast", label: "Podcasts", emoji: "🎧" },
    { value: "news", label: "News", emoji: "📰" },
    { value: "reddit", label: "Reddit", emoji: "👽" },
    { value: "youtube", label: "YouTube", emoji: "▶️" },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "foryou", label: "For you" },
    { value: "trending", label: "Trending" },
    { value: "new", label: "New" },
    { value: "short", label: "Short" },
    { value: "long", label: "Long" },
  ];

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: window.innerWidth < 768 ? "flex" : "none",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: "16px",
        }}
      >
        <span>🔍</span>
        <span>Filters</span>
        {isOpen ? " ▲" : " ▼"}
      </button>

      {/* Filter rail */}
      <div
        className="filter-rail"
        style={{
          position: window.innerWidth < 768 ? "fixed" : "sticky",
          top: window.innerWidth < 768 ? "0" : "24px",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          display: window.innerWidth < 768 ? (isOpen ? "block" : "none") : "block",
          backgroundColor: window.innerWidth < 768 ? "var(--bg)" : "transparent",
          padding: window.innerWidth < 768 ? "20px" : "0",
          overflowY: "auto",
          maxHeight: window.innerWidth < 768 ? "100vh" : "calc(100vh - 48px)",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "20px",
            maxWidth: window.innerWidth < 768 ? "100%" : "240px",
            boxShadow: window.innerWidth < 768 ? "var(--shadow)" : "none",
          }}
        >
          {/* Content Types */}
          <div style={{ marginBottom: "24px" }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "var(--ink-tertiary)",
                marginBottom: "12px",
              }}
            >
              Content Type
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {contentTypes.map((type) => {
                const isSelected = selectedTypes.includes(type.value) || (selectedTypes.includes("all") && type.value !== "all");
                return (
                  <label
                    key={type.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "var(--ink)",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: isSelected ? "var(--border)" : "transparent",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "var(--border)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleType(type.value)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <span>{type.emoji}</span>
                    <span>{type.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Mood/Energy Filter */}
          <div style={{ marginBottom: "24px" }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "var(--ink-tertiary)",
                marginBottom: "12px",
              }}
            >
              Mood / Energy
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => onMoodChange(mood.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid var(--border-strong)",
                    background: moodFilter === mood.value ? "var(--ink)" : "transparent",
                    color: moodFilter === mood.value ? "var(--bg)" : "var(--ink-muted)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: moodFilter === mood.value ? 600 : 500,
                    transition: "all 0.2s",
                  }}
                >
                  <span>{mood.emoji}</span> <span>{mood.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "var(--ink-tertiary)",
                marginBottom: "12px",
              }}
            >
              Sort
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {sortOptions.map((sort) => (
                <button
                  key={sort.value}
                  onClick={() => onSortChange(sort.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-strong)",
                    background: sortOption === sort.value ? "var(--border)" : "transparent",
                    color: sortOption === sort.value ? "var(--ink)" : "var(--ink-muted)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: sortOption === sort.value ? 600 : 400,
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

