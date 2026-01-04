import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import ItemCard from "../ui/ItemCard";

import { listContentItems, type ContentItem } from "../data/contentApi";
import { fetchSavedIds, saveItem, unsaveItem, getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/requireAuth";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function stateLabel(tag: string) {
  const t = norm(tag);
  if (t === "all") return "All";
  if (t === "reset") return "Reset";
  if (t === "beauty") return "Beauty";
  if (t === "logic") return "Logic";
  if (t === "faith") return "Faith";
  if (t === "reflect") return "Reflect";
  if (t === "comfort") return "Comfort";
  return tag;
}

const MOODS = ["all", "reset", "beauty", "logic", "faith", "reflect", "comfort"];

const MOOD_CONFIG: Record<string, { emoji: string; label: string }> = {
  all: { emoji: "✨", label: "All Moods" },
  reset: { emoji: "🔄", label: "Reset" },
  beauty: { emoji: "✨", label: "Beauty" },
  logic: { emoji: "🧠", label: "Logic" },
  faith: { emoji: "🙏", label: "Faith" },
  reflect: { emoji: "💭", label: "Reflect" },
  comfort: { emoji: "🛋️", label: "Comfort" },
};

type ViewMode = "grid" | "list";
type SortBy = "recent" | "title" | "category";

export default function Explore() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [showFilters, setShowFilters] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const rows = await listContentItems({ limit: 120 });
        if (cancelled) return;

        // ✅ One rule for internal items
        const visible = (rows || []).filter((it) => isPublicDiscoverableContentItem(it));
        setItems(visible);

        const uid = await getUserId();
        if (cancelled) return;

        const authed = !!uid;
        setIsAuthed(authed);

        if (authed) {
          const ids = await fetchSavedIds();
          if (!cancelled) setSavedIds(ids || []);
        } else {
          setSavedIds([]);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Could not load Explore.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Get unique categories with counts
  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    items.forEach((item) => {
      const cat = item.kind || "Other";
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const cats = Array.from(catMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      count,
    }));
    return [{ id: "All", name: "All", count: items.length }, ...cats];
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = norm(q);
    let filtered = items.filter((it) => {
      if (query) {
        const hay = `${it.title || ""} ${it.byline || ""} ${it.meta || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      if (selectedMood !== "all") {
        const tags = (it.state_tags || []).map(norm);
        if (!tags.includes(norm(selectedMood))) return false;
      }

      if (selectedCategory !== "All") {
        if ((it.kind || "Other") !== selectedCategory) return false;
      }

      return true;
    });

    // Sort
    if (sortBy === "title") {
      filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "category") {
      filtered.sort((a, b) => (a.kind || "").localeCompare(b.kind || ""));
    }
    // "recent" is already sorted (newest first from API)

    return filtered;
  }, [items, q, selectedMood, selectedCategory, sortBy]);

  async function toggleSave(contentId: string, isSaved: boolean) {
    const uid = await requireAuth(navigate, "/explore");
    if (!uid) return;

    if (busyId) return;
    setBusyId(contentId);

    // optimistic
    setSavedIds((prev) => {
      const set = new Set(prev);
      if (isSaved) set.delete(contentId);
      else set.add(contentId);
      return Array.from(set);
    });

    try {
      if (isSaved) await unsaveItem(contentId);
      else await saveItem(contentId);

      const updated = await fetchSavedIds();
      setSavedIds(updated || []);
    } catch {
      try {
        const updated = await fetchSavedIds();
        setSavedIds(updated || []);
      } catch {}
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <h1>Explore</h1>
        <p>Find something that matches your state.</p>
      </div>

      <div className="center-wrap">
        {/* Suggested for You - Only show if there are items and user is browsing */}
        {filteredItems.length > 0 && !loading && filteredItems.length <= items.length * 0.5 && (
          <Card className="explore-suggested">
            <div className="explore-suggested-header">
              <span className="explore-suggested-icon">✨</span>
              <h3 className="explore-suggested-title">Perfect for you right now</h3>
            </div>
            <p className="explore-suggested-desc">Based on your patterns and current mood</p>
            <div className="explore-suggested-grid">
              {filteredItems.slice(0, 3).map((item, i) => (
                <button
                  key={item.id}
                  className="explore-suggested-card"
                  type="button"
                  onClick={() => navigate(`/item/${item.id}`)}
                >
                  <div className="explore-suggested-emoji">
                    {item.kind?.toLowerCase().includes("movement") ? "🚶" :
                     item.kind?.toLowerCase().includes("prompt") ? "📝" :
                     item.kind?.toLowerCase().includes("reflection") ? "🙏" : "✨"}
                  </div>
                  <h4 className="explore-suggested-card-title">{item.title}</h4>
                  <p className="explore-suggested-card-meta">{item.kind || "Item"}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="center card-pad">
          {/* Enhanced Search */}
          <div className="explore-search-wrapper">
            <div className="explore-search-icon">🔍</div>
            <input
              className="explore-search-input"
              placeholder="Search activities..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                className="explore-search-clear"
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Mood Selector */}
          <div className="explore-mood-selector-wrapper">
            <div className="explore-mood-selector">
              {MOODS.map((m) => {
                const config = MOOD_CONFIG[m] || { emoji: "✨", label: stateLabel(m) };
                return (
                  <button
                    key={m}
                    type="button"
                    className={`explore-mood-btn ${selectedMood === m ? "explore-mood-btn-active" : ""}`}
                    onClick={() => setSelectedMood(m)}
                  >
                    <span className="explore-mood-emoji">{config.emoji}</span>
                    <span className="explore-mood-label">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="explore-categories-wrapper">
            <div className="explore-categories">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`explore-category-chip ${selectedCategory === cat.id ? "explore-category-chip-active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span>{cat.name}</span>
                  {cat.count !== undefined && <span className="explore-category-count">({cat.count})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Bar */}
          <div className="explore-controls">
            <div className="explore-controls-left">
              <span className="explore-results-count">
                {filteredItems.length} {filteredItems.length === 1 ? "activity" : "activities"}
              </span>
              {(selectedMood !== "all" || selectedCategory !== "All" || q) && (
                <button
                  className="explore-clear-filters"
                  type="button"
                  onClick={() => {
                    setSelectedMood("all");
                    setSelectedCategory("All");
                    setQ("");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="explore-controls-right">
              <select
                className="explore-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="recent">Recently added</option>
                <option value="title">Title</option>
                <option value="category">Category</option>
              </select>
              <div className="explore-view-toggle">
                <button
                  className={`explore-view-btn ${viewMode === "grid" ? "explore-view-btn-active" : ""}`}
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  ⬜
                </button>
                <button
                  className={`explore-view-btn ${viewMode === "list" ? "explore-view-btn-active" : ""}`}
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {!isAuthed ? (
            <div className="kivaw-signinPrompt" style={{ marginTop: 12, marginBottom: 16 }}>
              <p className="muted" style={{ margin: 0 }}>
                Want to save items? Sign in to heart them.
              </p>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/login", { state: { from: "/explore" } })}>
                Sign in →
              </button>
            </div>
          ) : null}

          {loading ? (
            <p className="muted">Loading…</p>
          ) : err ? (
            <p className="muted">{err}</p>
          ) : filteredItems.length === 0 ? (
            <div className="explore-empty-state">
              <div className="explore-empty-icon">🔍</div>
              <h3 className="explore-empty-title">No activities found</h3>
              <p className="explore-empty-text">Try adjusting your filters or search terms</p>
              <button
                className="explore-empty-btn"
                type="button"
                onClick={() => {
                  setSelectedMood("all");
                  setSelectedCategory("All");
                  setQ("");
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "kivaw-rec-grid" : "explore-list-view"}>
              {filteredItems.map((item) => {
                const isSaved = savedIds.includes(item.id);
                const isBusy = busyId === item.id;

                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onOpen={() => navigate(`/item/${item.id}`)}
                    topMeta={
                      <>
                        <span className="kivaw-meta-pill">{item.kind || "Item"}</span>
                        {item.byline ? (
                          <>
                            <span className="kivaw-meta-dot">•</span>
                            <span className="kivaw-meta-soft">{item.byline}</span>
                          </>
                        ) : null}
                      </>
                    }
                    action={
                      <button
                        className="kivaw-heart"
                        type="button"
                        aria-label={isSaved ? "Unsave" : "Save"}
                        disabled={isBusy}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSave(item.id, isSaved);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === " " || e.key === "Enter") e.preventDefault();
                        }}
                      >
                        {isBusy ? "…" : isSaved ? "♥" : "♡"}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>

        {/* Sign In Prompt at Bottom */}
        {!isAuthed && !loading && (
          <Card className="explore-signin-card">
            <div className="explore-signin-icon">💜</div>
            <h3 className="explore-signin-title">Save your favorites</h3>
            <p className="explore-signin-text">
              Sign in to build your personal collection and track what actually helps you
            </p>
            <div className="explore-signin-actions">
              <button
                className="explore-signin-btn-secondary"
                type="button"
                onClick={() => navigate("/explore")}
              >
                Maybe later
              </button>
              <button
                className="explore-signin-btn-primary"
                type="button"
                onClick={() => navigate("/login", { state: { from: "/explore" } })}
              >
                Sign in →
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}






























