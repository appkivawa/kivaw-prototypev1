// src/pages/ExplorePage.tsx
// Simplified Explore page using explore_feed_v2 Edge Function
// Replaces the 2081-line ExploreFeed.tsx

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../ui/Card";
import Container from "../ui/Container";
import EmptyState from "../ui/EmptyState";
import ErrorBoundary from "../ui/ErrorBoundary";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import ExploreItemCard from "../components/explore/ExploreItemCard";

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

interface ExploreFeedV2Response {
  items: UnifiedContentItem[];
  nextCursor?: string;
  hasMore: boolean;
}

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

export default function ExplorePage() {
  const [items, setItems] = useState<UnifiedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextCursorRef = useRef<string | undefined>();
  
  // Cache state
  const cacheRef = useRef<{
    data: UnifiedContentItem[];
    timestamp: number;
    cursor?: string;
  } | null>(null);

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
      const currentCursor = append ? nextCursorRef.current : undefined;

      // Call explore_feed_v2 Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke<ExploreFeedV2Response>("explore_feed_v2", {
        body: {
          limit: 50,
          cursor: currentCursor,
          sort: "featured", // Default sort
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to fetch explore feed");
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error("Invalid response from explore_feed_v2");
      }

      // Update state
      if (append) {
        setItems(prev => [...prev, ...data.items]);
      } else {
        setItems(data.items);
        cacheRef.current = {
          data: data.items,
          timestamp: Date.now(),
          cursor: data.nextCursor,
        };
      }

      setNextCursor(data.nextCursor);
      nextCursorRef.current = data.nextCursor;
      setHasMore(data.hasMore);
    } catch (e: any) {
      console.error("Error loading explore feed:", e);
      setError(e.message || "Failed to load explore feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load content on mount
  useEffect(() => {
    loadContent(false);
  }, [loadContent]);

  // Memoize items list to prevent unnecessary re-renders
  const memoizedItems = useMemo(() => items, [items]);

  // Memoize load more handler
  const handleLoadMore = useCallback(() => {
    loadContent(true);
  }, [loadContent]);

  // Memoize retry handler
  const handleRetry = useCallback(() => {
    loadContent(false);
  }, [loadContent]);

  return (
    <ErrorBoundary>
      <div className="page">
        <Container>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "24px" }}>Explore</h1>

          {/* Loading State */}
          {loading && <LoadingSkeleton count={6} type="grid" />}

        {/* Error State */}
        {error && (
          <Card style={{ padding: "24px", marginBottom: "24px", background: "#FEE2E2", border: "1px solid #DC2626" }}>
            <div style={{ color: "#DC2626", fontWeight: 500 }}>Error</div>
            <div style={{ color: "#991B1B", fontSize: "14px", marginTop: "8px" }}>{error}</div>
            <button
              onClick={handleRetry}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                background: "#DC2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Try again
            </button>
          </Card>
        )}

        {/* Content Grid */}
        {!loading && !error && memoizedItems.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {memoizedItems.map((item) => (
              <ExploreItemCard
                key={item.id}
                id={item.id}
                kind={item.kind}
                title={item.title}
                byline={item.byline}
                image_url={item.image_url}
                url={item.url}
                provider={item.provider}
                tags={item.tags}
                created_at={item.created_at}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {!loading && !error && hasMore && (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                padding: "10px 20px",
                background: loadingMore ? "#9CA3AF" : "#10B981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: loadingMore ? "not-allowed" : "pointer",
              }}
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon="📭"
            title="No content yet"
            subtitle="Check back soon for new discoveries"
          />
        )}
      </Container>
      </div>
    </ErrorBoundary>
  );
}

