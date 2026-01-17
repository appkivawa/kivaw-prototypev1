import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import ContentCard, { ContentCardItem } from "../components/feed/ContentCard";
import FeedPostSkeleton from "../components/feed/FeedPostSkeleton";
import FeedUpdateStatus from "../components/feed/FeedUpdateStatus";
import Container from "../ui/Container";
import Card from "../ui/Card";
import Button from "../ui/Button";
import SectionHeader from "../ui/SectionHeader";
import EmptyState from "../ui/EmptyState";
import Tag from "../ui/Tag";

const EXPLORE_CACHE_KEY = "kivaw_explore_cache";
const REFETCH_INTERVAL_MS = 90 * 1000; // 90 seconds

type ExploreCache = {
  items: ContentCardItem[];
  timestamp: number;
};

export default function Explore() {
  const [items, setItems] = useState<ContentCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentKindFilter, setContentKindFilter] = useState<string>("all");

  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load cached feed from localStorage
  function loadCachedFeed(): ExploreCache | null {
    try {
      const cached = localStorage.getItem(EXPLORE_CACHE_KEY);
      if (!cached) return null;

      const parsed: ExploreCache = JSON.parse(cached);
      return parsed;
    } catch {
      return null;
    }
  }

  // Save feed to cache
  function saveFeedToCache(items: ContentCardItem[]) {
    try {
      const cache: ExploreCache = {
        items,
        timestamp: Date.now(),
      };
      localStorage.setItem(EXPLORE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("[Explore] Failed to cache feed:", e);
    }
  }

  const loadFeed = useCallback(
    async (showStale = false) => {
      if (loadingRef.current) return;

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Load from cache instantly if available (stale-while-revalidate)
      if (showStale) {
        const cached = loadCachedFeed();
        if (cached && cached.items.length > 0) {
          setItems(cached.items);
          // Calculate last updated from max published_at/created_at
          const maxDate = cached.items.reduce((max, item) => {
            const published = item.published_at ? new Date(item.published_at).getTime() : 0;
            const created = item.created_at ? new Date(item.created_at).getTime() : 0;
            const itemMax = Math.max(published, created);
            return Math.max(max, itemMax);
          }, 0);
          if (maxDate > 0) {
            setLastUpdated(new Date(maxDate));
          }
          setLoading(false);
        }
      } else {
        loadingRef.current = true;
        setLoading(true);
      }

      setErr("");

      try {
        // Query the explore_items_v1 view
        const { data, error } = await supabase.from("explore_items_v1").select("*").limit(100);

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (error) {
          console.error("[Explore] Query error:", error);
          throw new Error(error.message || "Failed to load explore feed");
        }

        if (!data || !Array.isArray(data)) {
          throw new Error("Invalid response from explore_items_v1");
        }

        // Calculate last updated from max published_at/created_at
        const maxDate = data.reduce((max, item) => {
          const published = item.published_at ? new Date(item.published_at).getTime() : 0;
          const created = item.created_at ? new Date(item.created_at).getTime() : 0;
          const itemMax = Math.max(published, created);
          return Math.max(max, itemMax);
        }, 0);

        setItems(data);
        if (maxDate > 0) {
          setLastUpdated(new Date(maxDate));
        } else {
          setLastUpdated(new Date());
        }
        saveFeedToCache(data);
      } catch (e: any) {
        // Don't show error if request was aborted
        if (abortController.signal.aborted) {
          return;
        }
        console.error("[Explore] Load error:", e);
        // Only set error if we don't have cached data
        // Check if we have items from stale cache
        const hasCachedData = loadCachedFeed()?.items.length > 0;
        if (!hasCachedData) {
          setErr(e?.message ?? "Failed to load explore feed.");
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    []
  );

  // Initial load: show stale data instantly, then revalidate
  useEffect(() => {
    // Load stale data instantly
    loadFeed(true);
    // Then revalidate in background
    loadFeed(false);
  }, [loadFeed]);

  // Stale-while-revalidate: refetch on interval (90s)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!loadingRef.current) {
        loadFeed(false);
      }
    }, REFETCH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadFeed]);

  // Stale-while-revalidate: refetch on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (!loadingRef.current) {
        loadFeed(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadFeed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Filter items by content_kind and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filter by content_kind
      if (contentKindFilter !== "all" && item.content_kind !== contentKindFilter) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          item.title,
          item.summary,
          ...(item.tags || []),
          ...(item.topics || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [items, contentKindFilter, searchQuery]);

  // Get unique content kinds from items
  const availableContentKinds = useMemo(() => {
    const kinds = new Set<string>();
    items.forEach((item) => {
      if (item.content_kind) {
        kinds.add(item.content_kind);
      }
    });
    return Array.from(kinds).sort();
  }, [items]);

  // Format time ago helper
  const formatTimeAgo = useCallback((date: Date): string => {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 10) return "just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    const hrs = Math.floor(diffMins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, []);

  return (
    <div className="feed-page">
      <Container maxWidth="xl">
        <div className="feed-layout">
          {/* Left Rail */}
          <aside className="feed-rail">
            <Card variant="default" className="feed-rail-card">
              <div className="feed-rail-label">EXPLORE</div>
              <div className="feed-rail-title">Discover</div>
              <div className="feed-rail-desc">
                Discover content from all sources, curated for you.
              </div>
            </Card>

            <Card variant="default" className="feed-rail-card">
              <div className="feed-rail-label">UPDATE STATUS</div>
              <FeedUpdateStatus jobName="rss_ingest" staleThresholdMinutes={30} />
            </Card>
          </aside>

          {/* Main Feed */}
          <main className="feed-main">
            <SectionHeader
              title="Explore"
              subtitle={
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span>Discover content from all sources, curated for you.</span>
                  {lastUpdated && (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Updated {formatTimeAgo(lastUpdated)}
                    </span>
                  )}
                </div>
              }
              level={1}
            />

            {/* Controls */}
            <div className="feed-controls" style={{ marginTop: "24px", marginBottom: "24px" }}>
              <div className="feed-control-row">
                <input
                  type="text"
                  placeholder="Search explore…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="feed-search"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "14px",
                    background: "var(--surface)",
                  }}
                />
              </div>
              <div className="feed-control-row" style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Tag
                  label="All"
                  selected={contentKindFilter === "all"}
                  onClick={() => setContentKindFilter("all")}
                />
                {availableContentKinds.map((kind) => (
                  <Tag
                    key={kind}
                    label={kind.charAt(0).toUpperCase() + kind.slice(1)}
                    selected={contentKindFilter === kind}
                    onClick={() => setContentKindFilter(kind)}
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {err && (
              <Card className="feed-error-card" variant="outlined" style={{ marginBottom: "24px", padding: "20px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <strong>Error:</strong> {err}
                </div>
                <Button onClick={() => loadFeed()} variant="secondary" size="sm">
                  Try again
                </Button>
              </Card>
            )}

            {/* Feed Content */}
            {loading && items.length === 0 ? (
              <div className="feed-skeletons">
                {[1, 2, 3, 4].map((i) => (
                  <FeedPostSkeleton key={i} />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title={searchQuery || contentKindFilter !== "all" ? "No matches" : "Nothing to explore yet"}
                message={
                  searchQuery || contentKindFilter !== "all"
                    ? "Try adjusting your filters or search query."
                    : "Content will appear here once it's been ingested."
                }
                action={
                  searchQuery || contentKindFilter !== "all"
                    ? {
                        label: "Clear filters",
                        onClick: () => {
                          setSearchQuery("");
                          setContentKindFilter("all");
                        },
                      }
                    : {
                        label: "Refresh",
                        onClick: () => loadFeed(),
                      }
                }
              />
            ) : (
              <>
                {/* Featured Item */}
                {filteredItems.length > 0 && (
                  <Card className="feed-featured-card" variant="elevated" style={{ marginBottom: "32px" }}>
                    <ContentCard item={filteredItems[0]} index={0} featured />
                  </Card>
                )}

                {/* Grid of remaining items */}
                {filteredItems.length > 1 && (
                  <div
                    className="feed-section-items"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                      gap: "24px",
                    }}
                  >
                    {filteredItems.slice(1).map((item, index) => (
                      <Card key={item.id} className="feed-section-item">
                        <ContentCard item={item} index={index + 1} />
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </Container>
    </div>
  );
}
