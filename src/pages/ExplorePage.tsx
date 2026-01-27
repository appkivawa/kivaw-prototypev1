// src/pages/ExplorePage.tsx
// Explore page using explore_feed_v2 Edge Function (FIXED)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../ui/Card";
import Container from "../ui/Container";
import EmptyState from "../ui/EmptyState";
import ErrorBoundary from "../ui/ErrorBoundary";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import ExploreItemCard from "../components/explore/ExploreItemCard";
import "../styles/studio.css";

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
  nextCursor: string | null;
  hasMore: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function ExplorePage() {
  const [items, setItems] = useState<UnifiedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const nextCursorRef = useRef<string | null>(null);

  const cacheRef = useRef<{
    data: UnifiedContentItem[];
    timestamp: number;
    cursor: string | null;
    hasMore: boolean;
  } | null>(null);

  const loadContent = useCallback(async (append = false) => {
    if (!append && cacheRef.current) {
      const cacheAge = Date.now() - cacheRef.current.timestamp;
      if (cacheAge < CACHE_TTL_MS) {
        setItems(cacheRef.current.data);
        setNextCursor(cacheRef.current.cursor);
        setHasMore(cacheRef.current.hasMore);
        nextCursorRef.current = cacheRef.current.cursor;
        setLoading(false);
        return;
      }
    }

    if (append) setLoadingMore(true);
    else setLoading(true);

    setError(null);

    try {
      const cursor = append ? nextCursorRef.current : null;

      const { data, error: invokeError } = await supabase.functions.invoke<ExploreFeedV2Response>(
        "explore_feed_v2",
        {
          body: {
            limit: 50,
            cursor,
          },
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to fetch explore feed");
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error("Invalid response from explore_feed_v2");
      }

      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
        cacheRef.current = {
          data: data.items,
          timestamp: Date.now(),
          cursor: data.nextCursor,
          hasMore: data.hasMore,
        };
      }

      setNextCursor(data.nextCursor);
      nextCursorRef.current = data.nextCursor;
      setHasMore(!!data.hasMore);
    } catch (e: any) {
      setError(e?.message || "Failed to load explore feed");
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadContent(false);
  }, [loadContent]);

  const memoizedItems = useMemo(() => items, [items]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    loadContent(true);
  }, [hasMore, loadingMore, loadContent]);

  const handleRetry = useCallback(() => {
    cacheRef.current = null;
    nextCursorRef.current = null;
    setNextCursor(null);
    setHasMore(false);
    loadContent(false);
  }, [loadContent]);

  const isInTimeline = window.location.pathname.includes("/timeline");

  return (
    <ErrorBoundary>
      <div className="studio-page" data-theme="light" style={isInTimeline ? { paddingTop: 0 } : {}}>
        <Container
          maxWidth="xl"
          style={
            isInTimeline
              ? { paddingTop: 0, paddingBottom: "48px" }
              : { paddingTop: "96px", paddingBottom: "48px" }
          }
        >
          {!isInTimeline && (
            <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", marginBottom: "24px" }}>
              Explore
            </h1>
          )}

          {loading && <LoadingSkeleton count={6} type="grid" />}

          {error && (
            <Card
              style={{
                padding: "24px",
                marginBottom: "24px",
                background: "#FEE2E2",
                border: "1px solid #DC2626",
                borderRadius: "12px",
              }}
            >
              <div style={{ color: "#DC2626", fontWeight: 600, marginBottom: "8px" }}>Explore Error</div>
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
                  fontWeight: 600,
                }}
              >
                Retry
              </button>
            </Card>
          )}

          {!loading && !error && memoizedItems.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
                marginTop: "24px",
              }}
            >
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
                  fontWeight: 600,
                  cursor: loadingMore ? "not-allowed" : "pointer",
                }}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}

          {!loading && !error && memoizedItems.length === 0 && (
            <EmptyState title="No content yet" message="Sync content, then refresh Explore." />
          )}
        </Container>
      </div>
    </ErrorBoundary>
  );
}



