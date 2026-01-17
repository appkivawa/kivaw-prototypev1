// src/pages/StudioFeed.tsx
// Personalized feed page - simpler than Explore, for logged-in users
// Uses social_feed Edge Function with sections: Fresh (6h), Today (24h), Trending (48h)

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { saveItem, unsaveItem, fetchSavedIds } from "../data/savesApi";
import ErrorBoundary from "../ui/ErrorBoundary";
import "../styles/studio.css";

// Feed item from social_feed Edge Function
interface SocialFeedItem {
  id: string;
  source: string;
  external_id?: string | null;
  url: string | null;
  title: string;
  summary?: string | null;
  author?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
  score?: number | null;
}

interface SocialFeedResponse {
  feed: SocialFeedItem[];
  fresh: SocialFeedItem[];
  today: SocialFeedItem[];
  error?: string;
  debug?: Record<string, unknown>;
}

// FeedItem for UI compatibility
interface FeedItem {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: string;
  type: string;
  tags?: string[];
  meta?: string;
  published_at?: string | null;
  isSaved?: boolean;
}

// Feed section
interface FeedSection {
  id: string;
  title: string;
  subtitle: string;
  items: FeedItem[];
}

// Simple focus modes for Feed
const FOCUS_MODES = [
  { key: "all", label: "All", icon: "✨" },
  { key: "watch", label: "Watch", icon: "📺" },
  { key: "read", label: "Read", icon: "📚" },
  { key: "listen", label: "Listen", icon: "🎧" },
];

export default function StudioFeed() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Content state
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  
  // Simple filter state
  const [focus, setFocus] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [lastIngestion, setLastIngestion] = useState<Date | null>(null);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // Redirect to login if not signed in
        navigate("/login", { state: { from: "/studio/feed" } });
        return;
      }
      setIsSignedIn(true);
      setUserEmail(data.session.user?.email || null);
    });
  }, [navigate]);

  // Load saved IDs on mount
  useEffect(() => {
    if (isSignedIn) {
      loadSavedIds();
    }
  }, [isSignedIn]);

  // Load last ingestion time on mount and when content loads
  useEffect(() => {
    if (isSignedIn) {
      loadLastIngestion();
    }
  }, [isSignedIn]);

  // Load content
  useEffect(() => {
    if (isSignedIn) {
      loadContent();
    }
  }, [isSignedIn, focus]);

  async function loadSavedIds() {
    try {
      const ids = await fetchSavedIds();
      setSavedIds(new Set(ids));
    } catch (e) {
      console.error("Error loading saved IDs:", e);
    }
  }

  async function loadLastIngestion() {
    try {
      // Get last successful ingestion run (cron_runner orchestrator)
      const { data, error } = await supabase
        .rpc("get_last_successful_ingestion", { job_name_param: "cron_runner" })
        .maybeSingle();

      if (error) {
        console.error("Error loading last ingestion:", error);
        // Fallback to lastRefresh if query fails
        return;
      }

      if (data?.finished_at) {
        setLastIngestion(new Date(data.finished_at));
      }
    } catch (e) {
      console.error("Error loading last ingestion:", e);
      // Fallback to lastRefresh if query fails
    }
  }

  // Transform SocialFeedItem to FeedItem for UI
  function transformToFeedItem(item: SocialFeedItem): FeedItem {
    return {
      id: item.id,
      title: item.title || "Untitled",
      description: item.summary || null,
      image_url: item.image_url || null,
      url: item.url || null,
      source: item.source || "unknown",
      type: "rss", // Most items from social_feed are RSS/news
      tags: item.tags || [],
      meta: item.published_at ? formatDateMeta(item.published_at) : null,
      published_at: item.published_at || null,
      isSaved: savedIds.has(item.id),
    };
  }

  // Helper to get item timestamp (coalesce published_at, ingested_at, created_at)
  function getItemTimestamp(item: SocialFeedItem): string | null {
    return item.published_at ?? (item.metadata?.ingested_at as string) ?? null;
  }

  // Format date for meta display
  function formatDateMeta(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  async function loadContent() {
    setLoading(true);
    setError(null);

    try {
      // Call social_feed Edge Function
      const { data: feedData, error: invokeError } = await supabase.functions.invoke<SocialFeedResponse>(
        "social_feed",
        {
          body: { limit: 200 },
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to fetch social feed");
      }

      if (!feedData || feedData.error) {
        throw new Error(feedData?.error || "Invalid response from social_feed");
      }

      // social_feed already filters out items with hide/pass actions (score -999)
      // So we can trust the feed items are already filtered

      // Use fresh and today from social_feed response
      const allItems = feedData.feed || [];
      const freshItems = feedData.fresh || [];
      const todayItems = feedData.today || [];

      // Build sections: Fresh (6h), Today (24h), Trending (48h)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

      // Track seen IDs to prevent duplicates across sections
      const seenIds = new Set<string>();

      const builtSections: FeedSection[] = [];

      // 1. Fresh: use fresh array from social_feed (already filtered to 6h)
      if (freshItems.length > 0) {
        const freshFeedItems = freshItems
          .slice(0, 20)
          .map(transformToFeedItem)
          .filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        
        if (freshFeedItems.length > 0) {
          builtSections.push({
            id: "fresh",
            title: "Fresh",
            subtitle: "Last 6 hours",
            items: freshFeedItems,
          });
        }
      }

      // 2. Today: use today array from social_feed (already filtered to 24h)
      if (todayItems.length > 0) {
        const todayFeedItems = todayItems
          .slice(0, 20)
          .map(transformToFeedItem)
          .filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        
        if (todayFeedItems.length > 0) {
          builtSections.push({
            id: "today",
            title: "Today",
            subtitle: "Last 24 hours",
            items: todayFeedItems,
          });
        }
      }

      // 3. Trending: last 48h (excluding Today/Fresh) ordered by score desc
      const trendingItems = allItems
        .filter((item) => {
          if (seenIds.has(item.id)) return false;
          const ts = getItemTimestamp(item);
          if (!ts) return false;
          return ts >= fortyEightHoursAgo && ts < twentyFourHoursAgo;
        })
        .slice(0, 20)
        .map(transformToFeedItem);

      if (trendingItems.length > 0) {
        // Get scores from original feedData items
        const scoreMap = new Map<string, number>();
        for (const item of allItems) {
          if (item.score !== null && item.score !== undefined) {
            scoreMap.set(item.id, item.score);
          }
        }

        trendingItems.sort((a, b) => {
          const scoreA = scoreMap.get(a.id) ?? 0;
          const scoreB = scoreMap.get(b.id) ?? 0;
          return scoreB - scoreA;
        });

        builtSections.push({
          id: "trending",
          title: "Trending",
          subtitle: "Last 48 hours",
          items: trendingItems,
        });
      }

      setSections(builtSections);
      setLastRefresh(new Date());
    } catch (e: any) {
      console.error("Error loading feed:", e);
      setError(e.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  // Handle save/unsave
  async function handleToggleSave(item: FeedItem, e: React.MouseEvent) {
    e.stopPropagation(); // Prevent card click

    if (!isSignedIn) {
      navigate("/login", { state: { from: "/studio/feed" } });
      return;
    }

    try {
      if (item.isSaved) {
        await unsaveItem(item.id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        // Update item in sections
        setSections((prev) =>
          prev.map((section) => ({
            ...section,
            items: section.items.map((it) => (it.id === item.id ? { ...it, isSaved: false } : it)),
          }))
        );
      } else {
        await saveItem(item.id);
        setSavedIds((prev) => new Set([...prev, item.id]));
        // Update item in sections
        setSections((prev) =>
          prev.map((section) => ({
            ...section,
            items: section.items.map((it) => (it.id === item.id ? { ...it, isSaved: true } : it)),
          }))
        );
      }
    } catch (e: any) {
      console.error("Error toggling save:", e);
      alert("Couldn't update saved right now.");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  // Memoize sections to prevent unnecessary re-renders
  const memoizedSections = useMemo(() => sections, [sections]);

  // If not signed in yet, show loading
  if (!isSignedIn) {
    return (
      <ErrorBoundary>
        <div className="studio-page">
          <div className="studio-empty" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="studio-empty__icon">⏳</div>
            <div className="studio-empty__title">Loading...</div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="studio-page">
      {/* Navigation */}
      <nav className="studio-nav">
        <div className="studio-nav__inner">
          <button
            className="studio-nav__brand"
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <span className="studio-nav__brand-icon">K</span>
            <span>KIVAW</span>
          </button>

          <div className="studio-nav__links">
            <button className="studio-nav__link" onClick={() => navigate("/")}>
              Home
            </button>
            <button className="studio-nav__link" onClick={() => navigate("/studio/explore")}>
              Discover
            </button>
            <button className="studio-nav__link studio-nav__link--active" onClick={() => navigate("/studio/feed")}>
              Feed
            </button>
          </div>

          <div className="studio-nav__actions">
            <button 
              className="studio-btn studio-btn--ghost studio-btn--sm"
              onClick={() => navigate("/profile")}
            >
              {userEmail?.split("@")[0] || "Profile"}
            </button>
            <button 
              className="studio-btn studio-btn--primary studio-btn--sm" 
              onClick={handleSignOut}
            >
              Sign out
            </button>
            <button className="studio-btn studio-btn--ghost" onClick={toggle}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>

      {/* Main content - simpler two-column layout */}
      <div className="studio-feed-layout studio-feed-layout--no-profile">
        {/* Left Sidebar - Minimal */}
        <aside className="studio-sidebar">
          {/* User greeting */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Your Feed</div>
            <h3 className="studio-sidebar__title">
              Hey, {userEmail?.split("@")[0] || "there"} 👋
            </h3>
            <p className="studio-sidebar__desc">
              Here's what's fresh based on your interests.
            </p>
          </div>

          {/* Simple focus toggles */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Focus</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {FOCUS_MODES.map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setFocus(mode.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    background: focus === mode.key ? "var(--studio-coral-light)" : "transparent",
                    border: `1px solid ${focus === mode.key ? "var(--studio-coral)" : "var(--studio-border)"}`,
                    borderRadius: "var(--studio-radius)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>{mode.icon}</span>
                  <span style={{ 
                    fontSize: "14px", 
                    fontWeight: 500,
                    color: focus === mode.key ? "var(--studio-coral)" : "var(--studio-text)"
                  }}>
                    {mode.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Activity</div>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "12px",
              marginTop: "8px" 
            }}>
              <div style={{ textAlign: "center", padding: "12px", background: "var(--studio-gray-50)", borderRadius: "var(--studio-radius)" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--studio-text)" }}>
                  {sections.reduce((sum, s) => sum + s.items.length, 0)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--studio-text-muted)" }}>Items</div>
              </div>
              <div style={{ textAlign: "center", padding: "12px", background: "var(--studio-gray-50)", borderRadius: "var(--studio-radius)" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--studio-text)" }}>48h</div>
                <div style={{ fontSize: "11px", color: "var(--studio-text-muted)" }}>Fresh</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Feed */}
        <main className="studio-main">
          {/* Header */}
          <div className="studio-feed-header">
            <div>
              <h1 className="studio-feed-header__title">Your Feed</h1>
              <p className="studio-feed-header__desc">
                Curated content based on your preferences
              </p>
              <div className="studio-feed-header__meta">
                <span>
                  {lastIngestion 
                    ? `Last updated ${formatTimeAgo(lastIngestion)}` 
                    : `Last loaded ${formatTimeAgo(lastRefresh)}`}
                </span>
                {sections.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{sections.reduce((sum, s) => sum + s.items.length, 0)} items</span>
                  </>
                )}
              </div>
            </div>
            <div className="studio-feed-header__actions">
              <button 
                className="studio-btn studio-btn--secondary studio-btn--sm"
                onClick={loadContent}
              >
                ↻ Refresh
              </button>
              <button 
                className="studio-btn studio-btn--primary studio-btn--sm"
                onClick={() => navigate("/preferences")}
              >
                Edit preferences
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
              <div style={{ color: "var(--studio-text-muted)" }}>Loading your feed...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="studio-empty">
              <div className="studio-empty__icon">⚠️</div>
              <div className="studio-empty__title">Something went wrong</div>
              <div className="studio-empty__desc">{error}</div>
              <button className="studio-btn studio-btn--primary" onClick={loadContent}>
                Try again
              </button>
            </div>
          )}

          {/* Feed Sections */}
          {!loading && !error && sections.length > 0 && (
            <div>
              {memoizedSections.map((section) => (
                <div key={section.id} style={{ marginBottom: "48px" }}>
                  <div className="studio-section__header" style={{ marginBottom: "16px" }}>
                    <h3 className="studio-section__title">{section.title}</h3>
                    <span className="studio-section__meta">{section.subtitle} • {section.items.length} items</span>
                  </div>
                  <div className="studio-grid studio-grid--2">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="studio-card"
                        onClick={() => item.url && window.open(item.url, "_blank")}
                        style={{ cursor: item.url ? "pointer" : "default" }}
                      >
                        <div className="studio-card__image">
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.title || "Feed item"}
                              onError={(e) => {
                                // Fallback to placeholder if image fails
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                if (target.parentElement) {
                                  const placeholder = document.createElement("div");
                                  placeholder.style.cssText = `
                                    width: 100%;
                                    height: 100%;
                                    background: linear-gradient(135deg, var(--studio-coral) 0%, #FEB2B2 100%);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 48px;
                                    color: white;
                                    font-weight: 700;
                                  `;
                                  placeholder.textContent = item.title?.charAt(0) || "?";
                                  target.parentElement.appendChild(placeholder);
                                }
                              }}
                            />
                          ) : (
                            <div style={{ 
                              width: "100%", 
                              height: "100%", 
                              background: "linear-gradient(135deg, var(--studio-coral) 0%, #FEB2B2 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "48px",
                              color: "white",
                              fontWeight: 700
                            }}>
                              {item.title?.charAt(0) || "?"}
                            </div>
                          )}
                          <span className="studio-card__badge">
                            📰 News
                          </span>
                        </div>
                        <div className="studio-card__content">
                          <div className="studio-card__meta">
                            <span>{item.source}</span>
                            {item.meta && (
                              <>
                                <span>•</span>
                                <span>{item.meta}</span>
                              </>
                            )}
                          </div>
                          <h3 className="studio-card__title">{item.title}</h3>
                          {item.description && (
                            <p className="studio-card__desc">{item.description}</p>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="studio-card__tags">
                              {item.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="studio-tag">{tag}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                            <button
                              className="studio-btn studio-btn--ghost studio-btn--sm"
                              onClick={(e) => handleToggleSave(item, e)}
                              style={{ fontSize: "12px" }}
                            >
                              {item.isSaved ? "✓ Saved" : "💾 Save"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && sections.length === 0 && (
            <div className="studio-empty">
              <div className="studio-empty__icon">📭</div>
              <div className="studio-empty__title">Your feed is empty</div>
              <div className="studio-empty__desc">
                We're still gathering content for you. Check back soon or explore to discover more.
              </div>
              <button 
                className="studio-btn studio-btn--primary"
                onClick={() => navigate("/studio/explore")}
              >
                Explore content
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
    </ErrorBoundary>
  );
}
