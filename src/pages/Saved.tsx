import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import ItemCard from "../ui/ItemCard";

import { supabase } from "../lib/supabaseClient";
import { fetchSavedIds, unsaveItem, getUserId } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";
import { requireAuth } from "../auth/requireAuth";

type ViewMode = "grid" | "list";
type SortBy = "recent" | "category" | "title";

export default function Saved() {
  const navigate = useNavigate();

  const [isAuthed, setIsAuthed] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  async function loadSaved() {
    setErr("");
    setLoading(true);

    try {
      const uid = await getUserId();
      const authed = !!uid;
      setIsAuthed(authed);

      if (!authed) {
        setItems([]);
        return;
      }

      const saved = await fetchSavedIds(); // newest-first

      if (saved.length === 0) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
        )
        .in("id", saved);

      if (error) throw error;

      // preserve saved order
      const map = new Map<string, ContentItem>();
      for (const it of (data || []) as ContentItem[]) map.set(it.id, it);

      const ordered = saved.map((id) => map.get(id)).filter(Boolean) as ContentItem[];
      setItems(ordered);
    } catch (e: any) {
      setErr(e?.message || "Couldn't load your saved items right now. Try refreshing?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeSaved(contentId: string) {
    const uid = await requireAuth(navigate, "/saved");
    if (!uid) return;

    if (busyId) return;
    setBusyId(contentId);

    // optimistic UI
    setItems((prev) => prev.filter((x) => x.id !== contentId));

    try {
      await unsaveItem(contentId);
    } catch (e) {
      console.error(e);
      await loadSaved();
      alert("Couldn’t update saved right now.");
    } finally {
      setBusyId(null);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((it) => isPublicDiscoverableContentItem(it));
  }, [items]);

  const internalCount = useMemo(() => {
    return items.length - visibleItems.length;
  }, [items.length, visibleItems.length]);

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...visibleItems];
    if (sortBy === "category") {
      sorted.sort((a, b) => (a.kind || "").localeCompare(b.kind || ""));
    } else if (sortBy === "title") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    // "recent" is already sorted (newest first from API)
    return sorted;
  }, [visibleItems, sortBy]);

  // Get most common category
  const mostCommonCategory = useMemo(() => {
    if (visibleItems.length === 0) return null;
    const categoryCounts = new Map<string, number>();
    visibleItems.forEach((item) => {
      const cat = item.kind || "Other";
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });
    let maxCount = 0;
    let maxCat = "";
    categoryCounts.forEach((count, cat) => {
      if (count > maxCount) {
        maxCount = count;
        maxCat = cat;
      }
    });
    return maxCat;
  }, [visibleItems]);

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <h1>Saved</h1>
        <p>Your personal stash of "this actually helped."</p>
      </div>

      <div className="center-wrap">
        {!isAuthed ? (
          <Card className="center card-pad">
            <div>
              <p className="muted" style={{ marginBottom: 10 }}>
                Sign in to see what you've saved.
              </p>
              <button
                className="btn"
                type="button"
                onClick={() => navigate("/login", { state: { from: "/saved" } })}
              >
                Continue →
              </button>
            </div>
          </Card>
        ) : loading ? (
          <Card className="center card-pad">
            <p className="muted">Loading…</p>
          </Card>
        ) : err ? (
          <Card className="center card-pad">
            <p className="muted">{err}</p>
          </Card>
        ) : visibleItems.length === 0 ? (
          <div className="saved-empty-state">
            <div className="saved-empty-icon">💜</div>
            <h3 className="saved-empty-title">Your collection starts here</h3>
            <p className="saved-empty-text">
              Save activities that resonate with you. Build a personalized toolkit for different moods and moments.
            </p>
            <div className="saved-empty-preview">
              <p className="saved-empty-preview-label">Here's what a collection looks like:</p>
              <div className="saved-empty-preview-grid">
                {[
                  { emoji: "🚶", title: "Hard Reset Walk", tag: "Movement" },
                  { emoji: "📝", title: "Big Idea Dump", tag: "Prompt" },
                  { emoji: "🙏", title: "Faith & Vision", tag: "Reflection" },
                ].map((item, index) => (
                  <div key={index} className="saved-empty-preview-item">
                    <div className="saved-empty-preview-emoji">{item.emoji}</div>
                    <p className="saved-empty-preview-title">{item.title}</p>
                    <p className="saved-empty-preview-tag">{item.tag}</p>
                  </div>
                ))}
              </div>
            </div>
            <button className="saved-empty-cta" type="button" onClick={() => navigate("/explore")}>
              Explore activities →
            </button>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="saved-stats">
              <Card className="saved-stat-card saved-stat-red">
                <div className="saved-stat-icon">♥</div>
                <div className="saved-stat-content">
                  <div className="saved-stat-value">{visibleItems.length}</div>
                  <div className="saved-stat-label">Saved activities</div>
                </div>
              </Card>
              <Card className="saved-stat-card saved-stat-green">
                <div className="saved-stat-icon">✓</div>
                <div className="saved-stat-content">
                  <div className="saved-stat-value">{visibleItems.length}</div>
                  <div className="saved-stat-label">In your collection</div>
                </div>
              </Card>
              <Card className="saved-stat-card saved-stat-blue">
                <div className="saved-stat-icon">📈</div>
                <div className="saved-stat-content">
                  <div className="saved-stat-value">{mostCommonCategory || "—"}</div>
                  <div className="saved-stat-label">Most saved category</div>
                </div>
              </Card>
            </div>

            {/* Toolbar */}
            <Card className="saved-toolbar">
              <div className="saved-toolbar-left">
                <button
                  className={`saved-view-btn ${viewMode === "grid" ? "saved-view-btn-active" : ""}`}
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  ⬜
                </button>
                <button
                  className={`saved-view-btn ${viewMode === "list" ? "saved-view-btn-active" : ""}`}
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  ☰
                </button>
              </div>
              <div className="saved-toolbar-right">
                <span className="saved-sort-label">Sort by:</span>
                <select
                  className="saved-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                >
                  <option value="recent">Recently saved</option>
                  <option value="category">Category</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </Card>

            {/* Saved Items */}
            <Card className="center card-pad">
              {internalCount > 0 ? (
                <div className="echo-empty" style={{ marginBottom: 12 }}>
                  Hidden internal items: {internalCount}
                </div>
              ) : null}

              <div className={viewMode === "grid" ? "kivaw-rec-grid" : "saved-list-view"}>
                {sortedItems.map((it) => {
                  const isBusy = busyId === it.id;

                  return (
                    <ItemCard
                      key={it.id}
                      item={it}
                      onOpen={() => navigate(`/item/${it.id}`)}
                      topMeta={
                        <>
                          <span className="kivaw-meta-pill">{it.kind || "Item"}</span>
                          {it.byline ? (
                            <>
                              <span className="kivaw-meta-dot">•</span>
                              <span className="kivaw-meta-soft">{it.byline}</span>
                            </>
                          ) : null}
                        </>
                      }
                      action={
                        <button
                          className="kivaw-heart"
                          type="button"
                          aria-label="Remove"
                          disabled={isBusy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeSaved(it.id);
                          }}
                        >
                          {isBusy ? "…" : "♥"}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            </Card>

            {/* Recommendations */}
            {visibleItems.length > 0 && (
              <Card className="saved-recommendations">
                <h3 className="saved-recommendations-title">
                  <span className="saved-recommendations-icon">✨</span>
                  You might also like
                </h3>
                <p className="saved-recommendations-desc">Based on your saved activities</p>
                <div className="saved-recommendations-grid">
                  {[
                    { emoji: "✍️", title: "Write the Truth", category: "Prompt" },
                    { emoji: "🎨", title: "Raw Expression", category: "Creative" },
                    { emoji: "🏃", title: "Power Movement", category: "Movement" },
                  ].map((item, index) => (
                    <button
                      key={index}
                      className="saved-recommendation-card"
                      type="button"
                      onClick={() => navigate("/explore")}
                    >
                      <div className="saved-recommendation-emoji">{item.emoji}</div>
                      <h4 className="saved-recommendation-title">{item.title}</h4>
                      <span className="saved-recommendation-category">{item.category}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Usage Analytics */}
            {visibleItems.length > 0 && (
              <Card className="saved-analytics">
                <div className="saved-analytics-header">
                  <span className="saved-analytics-icon">📊</span>
                  <h3 className="saved-analytics-title">Your journey</h3>
                </div>
                <div className="saved-analytics-grid">
                  <div className="saved-analytics-item">
                    <div className="saved-analytics-value">{visibleItems.length}</div>
                    <div className="saved-analytics-label">Items in your collection</div>
                  </div>
                  <div className="saved-analytics-item">
                    <div className="saved-analytics-value">{mostCommonCategory || "—"}</div>
                    <div className="saved-analytics-label">Most saved category</div>
                  </div>
                  <div className="saved-analytics-item">
                    <div className="saved-analytics-value">Growing</div>
                    <div className="saved-analytics-label">Keep building your toolkit</div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}













