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
        method: "POST",
        body: {
          limit: 50,
          cursor: currentCursor,
        },
      });

      if (invokeError) {
        console.error("[ExplorePage] Edge Function error:", invokeError);
        // Provide more helpful error message
        if (invokeError.message?.includes("Failed to send") || invokeError.message?.includes("fetch")) {
          throw new Error(
            "Edge Function not available. " +
            "Please ensure explore_feed_v2 is deployed: " +
            "`supabase functions deploy explore_feed_v2`"
          );
        }
        throw new Error(invokeError.message || "Failed to fetch explore feed");
      }

      if (!data) {
        throw new Error("No data returned from explore_feed_v2");
      }

      if (!Array.isArray(data.items)) {
        throw new Error("Invalid response from explore_feed_v2: expected items array");
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
      console.error("[ExplorePage] Error loading explore feed:", e);
      // Provide user-friendly error message
      let errorMessage = "Failed to load explore feed";
      if (e.message) {
        errorMessage = e.message;
      } else if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === "string") {
        errorMessage = e;
      }
      setError(errorMessage);
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

  // Check if we're inside Timeline (hide header)
  const isInTimeline = window.location.pathname.includes("/timeline");

  return (
    <ErrorBoundary>
      <div className="studio-page" data-theme="light" style={isInTimeline ? { paddingTop: 0 } : {}}>
        <Container maxWidth="xl" style={isInTimeline ? { paddingTop: 0, paddingBottom: "48px" } : { paddingTop: "96px", paddingBottom: "48px" }}>
          {!isInTimeline && <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", marginBottom: "24px" }}>Explore</h1>}

          {/* Loading State */}
          {loading && <LoadingSkeleton count={6} type="grid" />}

        {/* Error State */}
        {error && (
          <Card style={{ 
            padding: "24px", 
            marginBottom: "24px", 
            background: "#FEE2E2", 
            border: "1px solid #DC2626",
            borderRadius: "12px"
          }}>
            <div style={{ color: "#DC2626", fontWeight: 500, marginBottom: "8px" }}>Error</div>
            <div style={{ color: "#991B1B", fontSize: "14px", marginBottom: "16px" }}>{error}</div>
            <button
              onClick={handleRetry}
              style={{
                padding: "10px 20px",
                background: "var(--studio-coral)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Try again
            </button>
          </Card>
        )}

        {/* Content Grid */}
        {!loading && !error && memoizedItems.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", marginTop: "24px" }}>
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
                background: loadingMore ? "var(--studio-gray-400)" : "var(--studio-coral)",
                color: "white",
                border: "none",
                borderRadius: "8px",
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
            title="No content yet"
            message="Check back soon for new discoveries"
          />
        )}
      </Container>
      </div>
    </ErrorBoundary>
  );
}

