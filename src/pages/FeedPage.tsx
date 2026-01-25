// src/pages/FeedPage.tsx
// Simplified Feed page using social_feed Edge Function
// Replaces the 2081-line ExploreFeed.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { saveItem, unsaveItem, fetchSavedIds } from "../data/savesApi";
import Card from "../ui/Card";
import Container from "../ui/Container";
import EmptyState from "../ui/EmptyState";
import ErrorBoundary from "../ui/ErrorBoundary";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import FeedItemCard from "../components/feed/FeedItemCard";
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

interface FeedItem {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: string;
  author?: string | null;
  published_at?: string | null;
  tags?: string[];
  isSaved?: boolean;
}

interface FeedSection {
  id: string;
  title: string;
  subtitle: string;
  items: FeedItem[];
}

export default function FeedPage() {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load saved IDs on mount
  useEffect(() => {
    loadSavedIds();
  }, []);

  async function loadSavedIds() {
    try {
      const ids = await fetchSavedIds();
      setSavedIds(new Set(ids));
    } catch (e) {
      console.error("Error loading saved IDs:", e);
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
      author: item.author || null,
      published_at: item.published_at || null,
      tags: item.tags || [],
      isSaved: savedIds.has(item.id),
    };
  }

  // Helper to get item timestamp
  function getItemTimestamp(item: SocialFeedItem): string | null {
    return item.published_at ?? (item.metadata?.ingested_at as string) ?? null;
  }

  const loadContent = useCallback(async () => {
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

      const allItems = feedData.feed || [];
      const freshItems = feedData.fresh || [];
      const todayItems = feedData.today || [];

      // Build sections: Fresh (6h), Today (24h), Trending (48h)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

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
    } catch (e: any) {
      console.error("Error loading feed:", e);
      setError(e.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load content on mount
  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Memoize sections to prevent unnecessary re-renders
  const memoizedSections = useMemo(() => sections, [sections]);

  // Memoize save handler
  const handleToggleSave = useCallback(async (item: FeedItem, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (item.isSaved) {
        await unsaveItem(item.id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setSections((prev) =>
          prev.map((section) => ({
            ...section,
            items: section.items.map((it) => (it.id === item.id ? { ...it, isSaved: false } : it)),
          }))
        );
      } else {
        await saveItem(item.id);
        setSavedIds((prev) => new Set([...prev, item.id]));
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
  }, []);

  // Memoize retry handler
  const handleRetry = useCallback(() => {
    loadContent();
  }, [loadContent]);

  // Check if we're inside Timeline (hide header)
  const isInTimeline = window.location.pathname.includes("/timeline");

  return (
    <ErrorBoundary>
      <div className="studio-page" data-theme="light" style={isInTimeline ? { paddingTop: 0 } : {}}>
        <Container maxWidth="xl" style={isInTimeline ? { paddingTop: 0, paddingBottom: "48px" } : { paddingTop: "96px", paddingBottom: "48px" }}>
          {!isInTimeline && <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", marginBottom: "24px" }}>Feed</h1>}

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

        {/* Feed Sections */}
        {!loading && !error && memoizedSections.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            {memoizedSections.map((section) => (
              <div key={section.id} style={{ marginBottom: "48px" }}>
                <div style={{ marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--studio-text)", marginBottom: "4px" }}>{section.title}</h2>
                  <div style={{ fontSize: "14px", color: "var(--studio-text-secondary)" }}>{section.subtitle} • {section.items.length} items</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                  {section.items.map((item) => (
                    <FeedItemCard
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      description={item.description}
                      image_url={item.image_url}
                      url={item.url}
                      source={item.source}
                      author={item.author}
                      published_at={item.published_at}
                      tags={item.tags}
                      isSaved={item.isSaved}
                      onSaveClick={(e) => handleToggleSave(item, e)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sections.length === 0 && (
          <EmptyState
            title="Your feed is empty"
            message="Check back soon for new updates"
          />
        )}
      </Container>
      </div>
    </ErrorBoundary>
  );
}

