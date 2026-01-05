import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listWavesFeed } from "../data/wavesApi";
import type { WavesFeedItem } from "../data/wavesApi";
import PageHeader from "../ui/PageHeader";

import { getUserId } from "../data/savesApi";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";

type TrendingTab = "hot" | "rising" | "favorites" | "comeback";

export default function Waves() {
  const navigate = useNavigate();

  const [feed, setFeed] = useState<WavesFeedItem[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TrendingTab>("hot");

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

  // Group items by category for trending display
  const trendingByCategory = useMemo(() => {
    const categories: Record<string, WavesFeedItem[]> = {};
    currentFeed.forEach((row) => {
      const category = row.content.kind || "Other";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(row);
    });
    return categories;
  }, [currentFeed]);

  return (
    <div className="page">
      <PageHeader 
        title="Waves" 
        subtitle="See what's resonating with others. Maybe you'll find something new." 
        icon="🌊"
      />

      <div className="center-wrap">
        {/* Time of Day Section */}
        <div className="waves-section">
          <div className="waves-section-title">⏰ Activity by time of day</div>
          
          <div className="waves-time-cards">
            <div className="waves-time-card waves-time-morning">
              <div className="waves-time-icon">🌅</div>
              <h3>Morning (6-12am)</h3>
              <div className="waves-time-stat">Most popular: <strong>Movement</strong></div>
              <div className="waves-time-stat">Peak time: 7-9am</div>
            </div>

            <div className="waves-time-card waves-time-afternoon">
              <div className="waves-time-icon">☀️</div>
              <h3>Afternoon (12-6pm)</h3>
              <div className="waves-time-stat">Most popular: <strong>Creative work</strong></div>
              <div className="waves-time-stat">Peak time: 2-4pm</div>
            </div>

            <div className="waves-time-card waves-time-evening">
              <div className="waves-time-icon">🌙</div>
              <h3>Evening (6pm-12am)</h3>
              <div className="waves-time-stat">Most popular: <strong>Reflection</strong></div>
              <div className="waves-time-stat">Peak time: 8-10pm</div>
            </div>
          </div>
        </div>

        {/* Trending Section */}
        {loading ? (
          <div className="waves-trending-section">
            <p className="muted">Loading…</p>
          </div>
        ) : error ? (
          <div className="waves-trending-section">
            <p className="muted">{error}</p>
            <div className="spacer-16" />
            <button className="waves-btn" onClick={() => navigate("/explore")} type="button">
              Browse everything →
            </button>
          </div>
        ) : !hasItems ? (
          <div className="waves-trending-section">
            <p className="muted">Nothing is trending yet.</p>
            <div className="spacer-16" />
            <button className="waves-btn" onClick={() => navigate("/explore")} type="button">
              Browse everything →
            </button>
          </div>
        ) : (
          <div className="waves-trending-section">
            <div className="waves-section-title">🔥 Trending by category</div>
            
            <div className="waves-trending-grid">
              {Object.entries(trendingByCategory).slice(0, 3).map(([category, items]) => (
                <div key={category} className="waves-trending-category">
                  <h4>
                    {category} 🔥
                  </h4>
                  {items.slice(0, 3).map((row) => {
                    const item = row.content;
                    const icon = item.kind?.toLowerCase().includes("movement") ? "🚶" :
                                 item.kind?.toLowerCase().includes("prompt") ? "📝" :
                                 item.kind?.toLowerCase().includes("reflection") ? "🙏" : "✨";

                    return (
                      <div
                        key={`${item.id}-${row.usage_tag}`}
                        className="waves-trending-item"
                        onClick={() => navigate(`/item/${item.id}`)}
                      >
                        <div className="waves-trending-item-icon">{icon}</div>
                        <div className="waves-trending-item-name">{item.title}</div>
                        <div className="waves-trending-item-count">{row.uses}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="waves-filter-tabs">
              <button
                className={`waves-filter-tab ${activeTab === "hot" ? "waves-filter-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("hot")}
              >
                🔥 Hot Now
              </button>
              <button
                className={`waves-filter-tab ${activeTab === "rising" ? "waves-filter-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("rising")}
              >
                📈 Rising
              </button>
              <button
                className={`waves-filter-tab ${activeTab === "favorites" ? "waves-filter-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("favorites")}
              >
                ⭐ All-Time
              </button>
              <button
                className={`waves-filter-tab ${activeTab === "comeback" ? "waves-filter-tab-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("comeback")}
              >
                ⚡ Making a Comeback
              </button>
            </div>
          </div>
        )}

        {!isAuthed && !loading && hasItems && (
          <div className="waves-card">
            <p className="muted" style={{ margin: 0 }}>
              Want to save things you like? Sign in to bookmark them.
            </p>
            <button className="waves-signin-btn" onClick={() => navigate("/login", { state: { from: "/waves" } })} type="button">
              Sign in →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}




















