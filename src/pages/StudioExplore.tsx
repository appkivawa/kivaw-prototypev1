// src/pages/StudioExplore.tsx
// Public discovery page with full filtering options
// Three-column layout: sidebar filters, main feed, profile (on desktop)
// Uses explore_feed_v2 Edge Function for unified content

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import ErrorBoundary from "../ui/ErrorBoundary";
import "../styles/studio.css";

// Unified content item from explore_feed_v2
interface UnifiedContentItem {
  id: string;
  kind: string;
  title: string;
  byline: string | null;
  image_url: string | null;
  url: string | null;
  provider: string;
  external_id: string | null;
  tags: string[];
  created_at: string;
  raw: Record<string, unknown> | null;
  score: number | null;
}

// FeedItem (compatible with existing UI)
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
  badge?: string;
  badgeColor?: string;
}

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ExploreFeedV2Response {
  items: UnifiedContentItem[];
  nextCursor?: string;
  hasMore: boolean;
}

// Signal toggles for sidebar
const SIGNAL_TOGGLES = [
  { key: "news", label: "News", icon: "📰" },
  { key: "social", label: "Social", icon: "💬" },
  { key: "podcasts", label: "Podcasts", icon: "🎧" },
  { key: "music", label: "Music", icon: "🎵" },
  { key: "video", label: "Video", icon: "📺" },
  { key: "movies", label: "Movies", icon: "🎬" },
  { key: "tv", label: "TV Shows", icon: "📺" },
  { key: "kdrama", label: "K-Drama", icon: "🇰🇷" },
  { key: "books", label: "Books", icon: "📚" },
];

// Map StudioExplore filter keys to unified kind values
function mapFilterToKinds(signals: string[]): string[] {
  const kindMap: Record<string, string> = {
    movies: "watch",
    tv: "watch",
    kdrama: "watch",
    books: "read",
    news: "rss",
    social: "rss",
    podcasts: "podcast",
    music: "music",
    video: "video",
  };
  
  const kinds = new Set<string>();
  signals.forEach(signal => {
    const kind = kindMap[signal];
    if (kind) {
      kinds.add(kind);
    }
  });
  
  return Array.from(kinds);
}

// Transform UnifiedContentItem to FeedItem for UI compatibility
function transformToFeedItem(item: UnifiedContentItem): FeedItem {
  // Determine display type from kind
  let displayType = item.kind;
  if (item.kind === "watch") {
    // Check if it's K-drama (heuristic: check raw data or tags)
    const raw = item.raw || {};
    const isKdrama = 
      (raw.origin_country && Array.isArray(raw.origin_country) && raw.origin_country.includes("KR")) ||
      raw.original_language === "ko" ||
      (item.title && /[\uAC00-\uD7AF]/.test(item.title)) ||
      item.tags.some(tag => tag.toLowerCase().includes("korea") || tag.toLowerCase().includes("kdrama"));
    
    // Check if it's TV (has first_air_date or name in raw)
    const isTV = !!(raw.first_air_date || raw.name);
    
    if (isKdrama) {
      displayType = "kdrama";
    } else if (isTV) {
      displayType = "tv";
    } else {
      displayType = "movies";
    }
  } else if (item.kind === "read") {
    displayType = "books";
  }
  
  return {
    id: item.id,
    title: item.title || "Untitled",
    description: item.raw?.description || item.raw?.overview || null,
    image_url: item.image_url || null,
    url: item.url || null,
    source: item.provider || "unknown",
    type: displayType,
    tags: item.tags || [],
    meta: item.raw?.release_date || item.raw?.first_air_date || item.created_at || "",
    badge: displayType.charAt(0).toUpperCase() + displayType.slice(1),
    badgeColor: getBadgeClass(displayType),
  };
}

// Badge color mapping
function getBadgeClass(type: string): string {
  const map: Record<string, string> = {
    kdrama: "studio-category-badge--kdrama",
    movie: "studio-category-badge--movie",
    movies: "studio-category-badge--movie",
    tv: "studio-category-badge--tv",
    book: "studio-category-badge--book",
    books: "studio-category-badge--book",
    news: "studio-category-badge--news",
    podcast: "studio-category-badge--podcast",
    podcasts: "studio-category-badge--podcast",
    music: "studio-category-badge--music",
    video: "studio-category-badge--music",
  };
  return map[type] || "";
}

// Get initials for row badge
function getInitials(source: string): string {
  const map: Record<string, string> = {
    tmdb: "TM",
    open_library: "OL",
    rss: "RS",
    youtube: "YT",
    spotify: "SP",
    twitter: "TW",
    techcrunch: "TC",
  };
  return map[source.toLowerCase()] || source.slice(0, 2).toUpperCase();
}

export default function StudioExplore() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Content state
  const [items, setItems] = useState<FeedItem[]>([]);
  const [featuredItem, setFeaturedItem] = useState<FeedItem | null>(null);
  const [trendingItems, setTrendingItems] = useState<FeedItem[]>([]);
  const [forYouItems, setForYouItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextCursorRef = useRef<string | undefined>(); // Ref to avoid stale closure
  
  // Filter state
  const [activeSignals, setActiveSignals] = useState<string[]>(["movies", "tv", "kdrama", "books"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"blended" | "recent" | "popular">("blended");
  
  // Cache state
  const cacheRef = useRef<{
    data: FeedItem[];
    timestamp: number;
    cursor?: string;
  } | null>(null);

  // Last ingestion state (for "Last updated" label)
  const [lastIngestion, setLastIngestion] = useState<Date | null>(null);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsSignedIn(!!data.session);
      setUserEmail(data.session?.user?.email || null);
    });
  }, []);

  // Load last ingestion time on mount
  useEffect(() => {
    loadLastIngestion();
  }, []);

  async function loadLastIngestion() {
    try {
      // Get last successful ingestion run (cron_runner orchestrator)
      const { data, error } = await supabase
        .rpc("get_last_successful_ingestion", { job_name_param: "cron_runner" })
        .maybeSingle();

      if (error) {
        console.error("Error loading last ingestion:", error);
        return;
      }

      if (data?.finished_at) {
        setLastIngestion(new Date(data.finished_at));
      }
    } catch (e) {
      console.error("Error loading last ingestion:", e);
    }
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

  // Load content from explore_feed_v2 Edge Function
  const loadContent = useCallback(async (append = false) => {
    // Check cache if not appending
    if (!append && cacheRef.current) {
      const cacheAge = Date.now() - cacheRef.current.timestamp;
      if (cacheAge < CACHE_TTL_MS) {
        setItems(cacheRef.current.data);
        setNextCursor(cacheRef.current.cursor);
        setLoading(false);
        return;
      }
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Map active signals to unified kinds
      const kinds = mapFilterToKinds(activeSignals);
      
      // Map sortBy to Edge Function sort parameter
      const sortMap: Record<string, "featured" | "recent" | "score"> = {
        blended: "featured",
        recent: "recent",
        popular: "score",
      };
      const sort = sortMap[sortBy] || "featured";

      // Get current cursor from ref for pagination (avoid stale closure)
      const currentCursor = append ? nextCursorRef.current : undefined;

      // Call explore_feed_v2 Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke<ExploreFeedV2Response>("explore_feed_v2", {
        body: {
          limit: 50,
          cursor: currentCursor,
          kinds: kinds.length > 0 ? kinds : undefined,
          sort: sort,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to fetch explore feed");
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error("Invalid response from explore_feed_v2");
      }

      // Transform UnifiedContentItem to FeedItem
      const transformedItems: FeedItem[] = data.items.map(transformToFeedItem);

      // Filter by active signals (client-side filtering for display types)
      // Note: This is necessary because display types (movies/tv/kdrama) are derived from unified kinds
      const filteredItems = transformedItems.filter((item) => {
        if (activeSignals.length === 0) return true;
        return activeSignals.includes(item.type);
      });

      // Update state
      if (append) {
        // Append to existing items (pagination)
        setItems(prev => {
          const combined = [...prev, ...filteredItems];
          
          // Update featured/trending/forYou with all items
          const featured = combined.find((item) => item.image_url);
          setFeaturedItem(featured || null);
          const remaining = combined.filter((item) => item.id !== featured?.id);
          setTrendingItems(remaining.slice(0, 5));
          setForYouItems(remaining.slice(5, 15));
          
          return combined;
        });
      } else {
        // Replace items (initial load or filter change)
        setItems(filteredItems);
        
        // Update cache
        cacheRef.current = {
          data: filteredItems,
          timestamp: Date.now(),
          cursor: data.nextCursor,
        };
        
        // Update featured/trending/forYou
        const featured = filteredItems.find((item) => item.image_url);
        setFeaturedItem(featured || null);
        const remaining = filteredItems.filter((item) => item.id !== featured?.id);
        setTrendingItems(remaining.slice(0, 5));
        setForYouItems(remaining.slice(5, 15));
      }

      setNextCursor(data.nextCursor);
      nextCursorRef.current = data.nextCursor; // Keep ref in sync
      setHasMore(data.hasMore);
    } catch (e: any) {
      console.error("Error loading content:", e);
      setError(e.message || "Failed to load content");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeSignals, sortBy]);

  // Load content when filters change
  useEffect(() => {
    setNextCursor(undefined); // Reset pagination on filter change
    nextCursorRef.current = undefined; // Reset ref too
    loadContent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSignals, sortBy]);

  function toggleSignal(key: string) {
    setActiveSignals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setIsSignedIn(false);
    navigate("/");
  }

  // Memoize filtered items to prevent unnecessary re-renders
  const memoizedFeaturedItem = useMemo(() => featuredItem, [featuredItem]);
  const memoizedTrendingItems = useMemo(() => trendingItems, [trendingItems]);
  const memoizedForYouItems = useMemo(() => forYouItems, [forYouItems]);

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
            <button className="studio-nav__link studio-nav__link--active" onClick={() => navigate("/studio/explore")}>
              Discover
            </button>
            <button className="studio-nav__link" onClick={() => navigate("/studio/feed")}>
              Feed
            </button>
          </div>

          <div className="studio-nav__actions">
            {isSignedIn ? (
              <>
                <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => navigate("/profile")}>
                  New profile
                </button>
                <button className="studio-btn studio-btn--primary studio-btn--sm" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <button className="studio-btn studio-btn--primary" onClick={() => navigate("/login")}>
                Continue
              </button>
            )}
            <button className="studio-btn studio-btn--ghost" onClick={toggle}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>

      {/* Sub-navigation */}
      <div style={{ 
        background: "var(--studio-white)", 
        borderBottom: "1px solid var(--studio-border)",
        padding: "0 24px"
      }}>
        <div style={{ 
          maxWidth: "var(--studio-max-width)", 
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", gap: "24px" }}>
            <button 
              style={{ 
                padding: "12px 0", 
                background: "none", 
                border: "none",
                borderBottom: "2px solid var(--studio-coral)",
                color: "var(--studio-text)",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              Explore
            </button>
            <button 
              style={{ 
                padding: "12px 0", 
                background: "none", 
                border: "none",
                borderBottom: "2px solid transparent",
                color: "var(--studio-text-muted)",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer"
              }}
              onClick={() => navigate("/studio/feed")}
            >
              Feed
            </button>
            <button 
              style={{ 
                padding: "12px 0", 
                background: "none", 
                border: "none",
                borderBottom: "2px solid transparent",
                color: "var(--studio-text-muted)",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer"
              }}
              onClick={() => navigate("/waves")}
            >
              Collections
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: "var(--studio-text-muted)" }}>
            <span>
              {lastIngestion 
                ? `Last updated ${formatTimeAgo(lastIngestion)}` 
                : "Updated just now"}
            </span>
            <button 
              className="studio-btn studio-btn--ghost studio-btn--sm"
              onClick={loadContent}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="studio-feed-layout">
        {/* Left Sidebar */}
        <aside className="studio-sidebar">
          {/* Profile section */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Profile</div>
            <h3 className="studio-sidebar__title">Studio feed</h3>
            <p className="studio-sidebar__desc">
              All the news, posts, podcasts and videos that stay in your lane.
            </p>
          </div>

          {/* Signals On */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Signals On</div>
            <div className="studio-signal-grid">
              {SIGNAL_TOGGLES.map((signal) => (
                <button
                  key={signal.key}
                  className={`studio-signal-toggle ${activeSignals.includes(signal.key) ? "studio-signal-toggle--active" : ""}`}
                  onClick={() => toggleSignal(signal.key)}
                >
                  <span className="studio-signal-toggle__icon">{signal.icon}</span>
                  <span className="studio-signal-toggle__label">{signal.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pace */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Pace</div>
            <p className="studio-sidebar__desc">
              You are seeing fresh only across the last 48 hours.
            </p>
          </div>

          {/* Echo */}
          <div className="studio-sidebar__section">
            <div className="studio-sidebar__label">Echo</div>
            <p className="studio-sidebar__desc">
              Use Echo on any item to pull in more from that creator, topic, or tone.
            </p>
          </div>
        </aside>

        {/* Main Feed */}
        <main className="studio-main">
          {/* Feed Header */}
          <div className="studio-feed-header">
            <div>
              <h1 className="studio-feed-header__title">Feed</h1>
              <p className="studio-feed-header__desc">
                A single, quiet place for everything that actually interests you.
              </p>
              <div className="studio-feed-header__meta">
                <span>Show fresh only</span>
                <span>•</span>
                <span>{items.length} items</span>
                <span>•</span>
                <span>{activeSignals.length} sources</span>
                <span>•</span>
                <span>last 48 hours</span>
              </div>
            </div>
            <div className="studio-feed-header__actions">
              <button className="studio-btn studio-btn--primary studio-btn--sm">
                Edit interests
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="studio-filters">
            <button 
              className={`studio-filters__toggle ${searchQuery ? "studio-filters__toggle--active" : ""}`}
            >
              🔍 Search in your studio
            </button>
            <div className="studio-filters__divider" />
            <div className="studio-filters__search">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="studio-filters__sort">
              <span>Sort:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="blended">blended</option>
                <option value="recent">recent</option>
                <option value="popular">popular</option>
              </select>
            </div>
            <div className="studio-filters__sort">
              <span>Focus:</span>
              <select>
                <option value="all">deep work</option>
                <option value="chill">chill</option>
                <option value="explore">explore</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="studio-empty">
              <div className="studio-empty__icon">⏳</div>
              <div className="studio-empty__title">Loading content...</div>
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

          {/* Featured Card */}
          {!loading && !error && memoizedFeaturedItem && (
            <div className="studio-featured">
              <div className="studio-featured__image">
                {memoizedFeaturedItem.image_url ? (
                  <img 
                    src={memoizedFeaturedItem.image_url} 
                    alt={memoizedFeaturedItem.title || "Featured item"}
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      if (target.parentElement) {
                        const placeholder = document.createElement("span");
                        placeholder.textContent = memoizedFeaturedItem.title?.charAt(0) || "?";
                        target.parentElement.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <span>{memoizedFeaturedItem.title?.charAt(0) || "?"}</span>
                )}
              </div>
              <div className="studio-featured__content">
                <div className="studio-featured__meta">
                  <span className="studio-featured__source">{memoizedFeaturedItem.source}</span>
                  <span>•</span>
                  <span className={`studio-featured__tag ${memoizedFeaturedItem.badgeColor}`}>
                    {memoizedFeaturedItem.badge}
                  </span>
                  <span>•</span>
                  <span>1 item</span>
                  <span>•</span>
                  <span>surfaced for: AI, robotics, future cities</span>
                </div>
                <h2 className="studio-featured__title">{memoizedFeaturedItem.title}</h2>
                <p className="studio-featured__desc">
                  {memoizedFeaturedItem.description || "Your AI signal is tuned to long-horizon, infrastructure-level stories — this is why it showed up here."}
                </p>
                <div className="studio-featured__tags">
                  {(memoizedFeaturedItem.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag} className="studio-tag">{tag}</span>
                  ))}
                </div>
                <div className="studio-featured__actions">
                  {memoizedFeaturedItem.url && (
                    <button 
                      className="studio-btn studio-btn--ghost studio-btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(memoizedFeaturedItem.url!, "_blank");
                      }}
                    >
                      📂 Open
                    </button>
                  )}
                  <button className="studio-btn studio-btn--ghost studio-btn--sm">
                    📡 Echo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Trending Section */}
          {!loading && !error && memoizedTrendingItems.length > 0 && (
            <div className="studio-section">
              <div className="studio-section__header">
                <h3 className="studio-section__title">Trending</h3>
                <span className="studio-section__meta">Last 48 hours • {memoizedTrendingItems.length} items</span>
              </div>
              {memoizedTrendingItems.map((item) => (
                <div 
                  key={item.id} 
                  className="studio-row"
                  onClick={() => item.url && window.open(item.url, "_blank")}
                >
                  <div className={`studio-row__badge ${getBadgeClass(item.type)}`}>
                    {getInitials(item.source)}
                  </div>
                  <div className="studio-row__content">
                    <h4 className="studio-row__title">{item.title}</h4>
                    <div className="studio-row__meta">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{item.meta || "Recent"}</span>
                    </div>
                  </div>
                  <span className={`studio-row__type ${getBadgeClass(item.type)}`}>
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* For You Section */}
          {!loading && !error && memoizedForYouItems.length > 0 && (
            <div className="studio-section">
              <div className="studio-section__header">
                <h3 className="studio-section__title">For you</h3>
                <span className="studio-section__meta">Blended across news, social, podcasts and video</span>
              </div>
              {memoizedForYouItems.map((item) => (
                <div 
                  key={item.id} 
                  className="studio-row"
                  onClick={() => item.url && window.open(item.url, "_blank")}
                  style={{ cursor: item.url ? "pointer" : "default" }}
                >
                  <div className={`studio-row__badge ${getBadgeClass(item.type)}`}>
                    {getInitials(item.source)}
                  </div>
                  <div className="studio-row__content">
                    <h4 className="studio-row__title">{item.title}</h4>
                    <div className="studio-row__meta">
                      <span>{item.source}</span>
                      {item.meta && (
                        <>
                          <span>•</span>
                          <span>{item.meta}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`studio-row__type ${getBadgeClass(item.type)}`}>
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {!loading && !error && hasMore && (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <button
                className="studio-btn studio-btn--secondary"
                onClick={() => loadContent(true)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          {loadingMore && (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <div className="studio-empty__icon">⏳</div>
              <div className="studio-empty__title" style={{ fontSize: "14px", marginTop: "8px" }}>
                Loading more...
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && items.length === 0 && (
            <div className="studio-empty">
              <div className="studio-empty__icon">📭</div>
              <div className="studio-empty__title">No content yet</div>
              <div className="studio-empty__desc">
                Toggle some signals on in the sidebar to see content.
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Profile (hidden on smaller screens via CSS) */}
        <aside className="studio-profile">
          <div className="studio-profile__card">
            <div className="studio-sidebar__label">KIVAW</div>
            <div className="studio-profile__avatar">
              <div style={{ 
                width: "100%", 
                height: "100%", 
                background: "var(--studio-coral)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "white",
                fontSize: "32px",
                fontWeight: 700
              }}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : "K"}
              </div>
            </div>
            <h2 className="studio-profile__name">
              {userEmail ? userEmail.split("@")[0] : "Guest"}
            </h2>
            <p className="studio-profile__stat">
              {isSignedIn ? "42 Public Collections" : "Sign in to save"}
            </p>
            <div className="studio-profile__tabs">
              <span className="studio-profile__tab studio-profile__tab--active">Overview</span>
              <span className="studio-profile__tab">Collections</span>
              <span className="studio-profile__tab">Liked Media</span>
            </div>
          </div>

          {/* Featured Collections */}
          <div className="studio-collections">
            <h3 className="studio-collections__title">Featured Collections</h3>
            <div className="studio-collections__grid">
              <div className="studio-collection">
                <div style={{ 
                  width: "100%", 
                  height: "100%", 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ color: "white", fontSize: "24px" }}>🎵</span>
                </div>
                <div className="studio-collection__label">Midnight Jazz</div>
              </div>
              <div className="studio-collection">
                <div style={{ 
                  width: "100%", 
                  height: "100%", 
                  background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ color: "white", fontSize: "24px" }}>🎬</span>
                </div>
                <div className="studio-collection__label">Sci-Fi Classics</div>
              </div>
              <div className="studio-collection">
                <div style={{ 
                  width: "100%", 
                  height: "100%", 
                  background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ color: "white", fontSize: "24px" }}>📺</span>
                </div>
                <div className="studio-collection__label">K-Drama Picks</div>
              </div>
              <div className="studio-collection">
                <div style={{ 
                  width: "100%", 
                  height: "100%", 
                  background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ color: "white", fontSize: "24px" }}>📚</span>
                </div>
                <div className="studio-collection__label">Reading List</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
    </ErrorBoundary>
  );
}
