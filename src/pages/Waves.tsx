import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";

import { listWavesFeed } from "../data/wavesApi";
import type { WavesFeedItem } from "../data/wavesApi";

import { fetchSavedIds, saveItem, unsaveItem, getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/requireAuth";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";

type TrendingTab = "hot" | "rising" | "favorites" | "comeback";

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;

  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export default function Waves() {
  const navigate = useNavigate();

  const [feed, setFeed] = useState<WavesFeedItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TrendingTab>("hot");
  const [timeOfDay, setTimeOfDay] = useState<string>("morning");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay("morning");
    else if (hour < 18) setTimeOfDay("afternoon");
    else setTimeOfDay("evening");
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setLoading(true);

        const rows = await listWavesFeed(60);
        if (cancelled) return;

        const filtered = (rows || []).filter((r) => isPublicDiscoverableContentItem(r.content));
        setFeed(filtered);

        const uid = await getUserId();
        if (cancelled) return;

        const authed = !!uid;
        setIsAuthed(authed);

        if (authed) {
          const saved = await fetchSavedIds();
          if (!cancelled) setSavedIds(saved || []);
        } else {
          setSavedIds([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load Waves.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleSave(contentId: string, isSaved: boolean) {
    const uid = await requireAuth(navigate, "/waves");
    if (!uid) return;

    if (busyId) return;
    setBusyId(contentId);

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

  const hasItems = useMemo(() => feed.length > 0, [feed]);

  // Categorize feed items by trending status
  const categorizedFeed = useMemo(() => {
    const sorted = [...feed].sort((a, b) => b.uses - a.uses);
    const hot = sorted.slice(0, 3);
    const rising = sorted.slice(3, 6);
    const favorites = sorted.slice(0, 6); // All-time favorites (top 6 by total uses)
    const comeback = sorted.slice(6, 8);

    return { hot, rising, favorites, comeback };
  }, [feed]);

  // Get current tab items
  const currentFeed = useMemo(() => {
    return categorizedFeed[activeTab] || [];
  }, [categorizedFeed, activeTab]);

  // Get category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, WavesFeedItem[]>();
    feed.forEach((item) => {
      const cat = item.content.kind || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return Array.from(map.entries())
      .map(([cat, items]) => ({
        category: cat,
        items: items.sort((a, b) => b.uses - a.uses).slice(0, 3),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [feed]);

  // Community stats
  const communityStats = useMemo(() => {
    const totalUses = feed.reduce((sum, item) => sum + item.uses, 0);
    const avgUses = feed.length > 0 ? Math.round(totalUses / feed.length) : 0;
    return {
      totalUses,
      itemCount: feed.length,
      avgUses,
    };
  }, [feed]);

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <div className="waves-header-icon">🌊</div>
        <h1>Waves</h1>
        <p>See how the community uses activities. Discover new ways.</p>
      </div>

      <div className="center-wrap">
        {/* Time-based Insights */}
        {hasItems && !loading && (
          <div className="waves-time-insights">
            <div className="waves-section-header">
              <span className="waves-section-icon">🕐</span>
              <h2 className="waves-section-title">Activity by time of day</h2>
            </div>
            <div className="waves-time-grid">
              <Card className="waves-time-card waves-time-morning">
                <div className="waves-time-icon">🌅</div>
                <div className="waves-time-content">
                  <h4 className="waves-time-period">Morning (6-12am)</h4>
                  <p className="waves-time-popular">
                    Most popular: <span className="waves-time-popular-value">Movement</span>
                  </p>
                  <p className="waves-time-peak">Peak time: 7-9am</p>
                </div>
              </Card>
              <Card className="waves-time-card waves-time-afternoon">
                <div className="waves-time-icon">☀️</div>
                <div className="waves-time-content">
                  <h4 className="waves-time-period">Afternoon (12-6pm)</h4>
                  <p className="waves-time-popular">
                    Most popular: <span className="waves-time-popular-value">Creative work</span>
                  </p>
                  <p className="waves-time-peak">Peak time: 2-4pm</p>
                </div>
              </Card>
              <Card className="waves-time-card waves-time-evening">
                <div className="waves-time-icon">🌙</div>
                <div className="waves-time-content">
                  <h4 className="waves-time-period">Evening (6pm-12am)</h4>
                  <p className="waves-time-popular">
                    Most popular: <span className="waves-time-popular-value">Reflection</span>
                  </p>
                  <p className="waves-time-peak">Peak time: 8-10pm</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Category Trending */}
        {categoryBreakdown.length > 0 && !loading && (
          <div className="waves-category-trending">
            <div className="waves-section-header">
              <span className="waves-section-icon">🎯</span>
              <h2 className="waves-section-title">Trending by category</h2>
            </div>
            <div className="waves-category-grid">
              {categoryBreakdown.slice(0, 3).map((cat) => (
                <Card key={cat.category} className="waves-category-card">
                  <div className="waves-category-header">
                    <h4 className="waves-category-name">{cat.category}</h4>
                    <span className="waves-category-icon">🔥</span>
                  </div>
                  <div className="waves-category-list">
                    {cat.items.map((item) => (
                      <div key={item.content.id} className="waves-category-item">
                        <span className="waves-category-emoji">
                          {item.content.kind?.toLowerCase().includes("movement") ? "🚶" :
                           item.content.kind?.toLowerCase().includes("prompt") ? "📝" :
                           item.content.kind?.toLowerCase().includes("reflection") ? "🙏" : "✨"}
                        </span>
                        <span className="waves-category-item-name">{item.content.title}</span>
                        <span className="waves-category-item-uses">{item.uses}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Trending Tabs */}
        {hasItems && !loading && (
          <Card className="waves-tabs-wrapper">
            <div className="waves-tabs">
              <button
                className={`waves-tab ${activeTab === "hot" ? "waves-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("hot")}
              >
                <span className="waves-tab-icon">🔥</span>
                Hot Now
              </button>
              <button
                className={`waves-tab ${activeTab === "rising" ? "waves-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("rising")}
              >
                <span className="waves-tab-icon">📈</span>
                Rising
              </button>
              <button
                className={`waves-tab ${activeTab === "favorites" ? "waves-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("favorites")}
              >
                <span className="waves-tab-icon">⭐</span>
                All-Time
              </button>
              <button
                className={`waves-tab ${activeTab === "comeback" ? "waves-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("comeback")}
              >
                <span className="waves-tab-icon">⚡</span>
                Making a Comeback
              </button>
            </div>
          </Card>
        )}

        <Card className="center card-pad">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : error ? (
            <div>
              <p className="muted">{error}</p>
              <div className="spacer-16" />
              <button className="btn" onClick={() => navigate("/explore")} type="button">
                Browse everything →
              </button>
            </div>
          ) : !hasItems ? (
            <div>
              <p className="muted">Nothing is trending yet.</p>
              <div className="spacer-16" />
              <button className="btn" onClick={() => navigate("/explore")} type="button">
                Browse everything →
              </button>
            </div>
          ) : (
            <>
              {!isAuthed ? (
                <div className="kivaw-signinPrompt">
                  <p className="muted" style={{ margin: 0 }}>
                    Want to save items? Sign in to heart them.
                  </p>
                  <button className="btn btn-ghost" onClick={() => navigate("/login", { state: { from: "/waves" } })} type="button">
                    Sign in →
                  </button>
                </div>
              ) : null}

              {/* Ranked Items with Trending Badges */}
              <div className="waves-ranked-grid">
                {currentFeed.map((row, index) => {
                  const item = row.content;
                  const isSaved = savedIds.includes(item.id);
                  const isBusy = busyId === item.id;
                  const rank = index + 1;
                  const isHot = rank <= 2;
                  const isRising = rank > 2 && rank <= 4;

                  return (
                    <Card key={`${item.id}-${row.usage_tag}-${row.last_used_at}`} className="waves-ranked-card">
                      <div className="waves-rank-badge">#{rank}</div>
                      <div className="waves-card-header">
                        <div className="waves-card-left">
                          <div className="waves-card-emoji">
                            {item.kind?.toLowerCase().includes("movement") ? "🚶" :
                             item.kind?.toLowerCase().includes("prompt") ? "📝" :
                             item.kind?.toLowerCase().includes("reflection") ? "🙏" : "✨"}
                          </div>
                          <div className="waves-card-meta">
                            <div className="waves-card-badges">
                              <span className="waves-category-badge">{item.kind || "Item"}</span>
                              {isHot && <span className="waves-trending-badge waves-trending-hot">🔥 Hot today</span>}
                              {isRising && <span className="waves-trending-badge waves-trending-rising">📈 Rising</span>}
                            </div>
                            <h3 className="waves-card-title">{item.title}</h3>
                          </div>
                        </div>
                        <button
                          className={`waves-heart-btn ${isSaved ? "waves-heart-btn-saved" : ""}`}
                          type="button"
                          aria-label={isSaved ? "Unsave" : "Save"}
                          disabled={isBusy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSave(item.id, isSaved);
                          }}
                        >
                          {isBusy ? "…" : isSaved ? "♥" : "♡"}
                        </button>
                      </div>
                      {item.byline && <p className="waves-card-description">{item.byline}</p>}
                      <div className="waves-card-stats">
                        <div className="waves-stat">
                          <span className="waves-stat-icon">👥</span>
                          <span className="waves-stat-value">{row.uses.toLocaleString()}</span>
                          <span className="waves-stat-label">uses</span>
                        </div>
                        <div className="waves-stat">
                          <span className="waves-stat-icon">🕐</span>
                          <span className="waves-stat-text">last used {timeAgo(row.last_used_at)} ago</span>
                        </div>
                        <div className="waves-stat">
                          <span className="waves-stat-icon">⭐</span>
                          <span className="waves-stat-text">4.8</span>
                        </div>
                      </div>
                      {row.usage_tag && (
                        <div className="waves-context">
                          <span className="waves-context-icon">✨</span>
                          <span className="waves-context-text">Popular tag: #{row.usage_tag}</span>
                        </div>
                      )}
                      <button
                        className="waves-try-btn"
                        type="button"
                        onClick={() => navigate(`/item/${item.id}`)}
                      >
                        ▶ Try it now
                      </button>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* Community Stats */}
        {hasItems && !loading && (
          <Card className="waves-community-stats">
            <div className="waves-community-header">
              <span className="waves-community-icon">📊</span>
              <h2 className="waves-community-title">Community Pulse</h2>
            </div>
            <div className="waves-stats-grid">
              <div className="waves-stat-card">
                <div className="waves-stat-value">{communityStats.totalUses.toLocaleString()}</div>
                <div className="waves-stat-label">Total uses</div>
              </div>
              <div className="waves-stat-card">
                <div className="waves-stat-value">{communityStats.itemCount}</div>
                <div className="waves-stat-label">Trending items</div>
              </div>
              <div className="waves-stat-card">
                <div className="waves-stat-value">{timeOfDay}</div>
                <div className="waves-stat-label">Peak activity time</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}




















