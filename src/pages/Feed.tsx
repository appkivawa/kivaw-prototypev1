// pages/feed.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import FeedPost from "../components/feed/FeedPost";
import FeedPostSkeleton from "../components/feed/FeedPostSkeleton";
import "../styles/feed.css";

type Source = "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";

type FeedItem = {
  id: string;
  source: Source;
  external_id: string;
  url: string;
  title: string;
  summary?: string | null;
  author?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  topics?: string[] | null;
  metadata?: Record<string, unknown>;
  score?: number;
};

type FeedResponse = { feed: FeedItem[]; debug?: Record<string, unknown> };
type ViewMode = "1col" | "2col" | "swipe";

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("1col");
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"left" | "right">("right");
  const [showDebug, setShowDebug] = useState(false);

  const loadingRef = useRef(false);

  async function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErr("");

    try {
      const { data, error } = await supabase.functions.invoke<FeedResponse>("social_feed", {
        body: { limit: 50 },
      });

      if (error) {
        console.error("[social_feed invoke error]", error);
        const status = (error as any).status ?? "no-status";
        const msg = (error as any).message ?? "no-message";
        throw new Error(`social_feed failed (${status}): ${msg}`);
      }

      if (!data?.feed) throw new Error("Invalid feed response (missing feed array).");

      setItems(data.feed);
      setDebug(data.debug ?? null);
    } catch (e: any) {
      console.error("[Feed load error]", e);
      setErr(e?.message ?? "Failed to load feed");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // Swipe functionality
  const SWIPE_THRESHOLD = 110;
  const currentItem = items[swipeIndex] ?? null;
  const nextItem = items[swipeIndex + 1] ?? null;

  function getClientX(e: MouseEvent | TouchEvent): number {
    if ("touches" in e) return e.touches[0]?.clientX ?? 0;
    return e.clientX;
  }

  function handleSwipe(dir: "left" | "right") {
    if (!currentItem || isAnimating) return;
    setAnimDir(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setSwipeIndex((i) => Math.min(i + 1, items.length - 1));
      setIsAnimating(false);
      setIsDragging(false);
      setDragOffset(0);
    }, 240);
  }

  function handleDragStart(e: React.MouseEvent | React.TouchEvent) {
    if (!currentItem || isAnimating || viewMode !== "swipe") return;
    const clientX = getClientX(e.nativeEvent);
    setIsDragging(true);
    setDragStartX(clientX);
    setDragOffset(0);
  }

  useEffect(() => {
    if (!isDragging || !currentItem || viewMode !== "swipe") return;

    function handleMove(e: MouseEvent | TouchEvent) {
      if ("touches" in e) e.preventDefault();
      const clientX = getClientX(e);
      setDragOffset(clientX - dragStartX);
    }

    function handleEnd() {
      const abs = Math.abs(dragOffset);
      if (abs >= SWIPE_THRESHOLD) {
        handleSwipe(dragOffset < 0 ? "left" : "right");
        return;
      }
      setIsDragging(false);
      setDragOffset(0);
      setDragStartX(0);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, dragStartX, dragOffset, currentItem, isAnimating, viewMode]);

  // Keyboard shortcuts for swipe mode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;

      if (viewMode === "swipe") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleSwipe("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleSwipe("right");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, currentItem, isAnimating]);

  // Swipe visual state - single computed transform
  const rotation = viewMode === "swipe" ? dragOffset * 0.06 : 0;
  const opacity = viewMode === "swipe" ? Math.max(0.35, 1 - Math.abs(dragOffset) / 320) : 1;
  const swipeLabel = viewMode === "swipe" && dragOffset > 40 ? "LIKE" : viewMode === "swipe" && dragOffset < -40 ? "PASS" : "";
  const swipeLabelOpacity = viewMode === "swipe" ? Math.min(1, Math.abs(dragOffset) / 140) : 0;
  const animX = animDir === "right" ? 420 : -420;
  const swipeTransform = isAnimating
    ? `translateX(${animX}px) rotate(${animDir === "right" ? 8 : -8}deg)`
    : viewMode === "swipe"
    ? `translateX(calc(-50% + ${dragOffset}px)) rotate(${rotation}deg)`
    : "translateX(-50%)";
  const transition = isDragging ? "none" : "transform 240ms ease, opacity 240ms ease";

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="feed-page">
      <div className="feed-container">
        {/* Header */}
        <header className="feed-header">
          <div className="feed-header-content">
            <h1 className="feed-title">Your Feed</h1>
            <p className="feed-subtitle">One scroll. Everything you care about.</p>
          </div>

          <div className="feed-header-actions">
            {/* View Mode Selector */}
            <div className="segmented-control">
              <button
                onClick={() => setViewMode("1col")}
                className={`segmented-control-button ${viewMode === "1col" ? "active" : ""}`}
              >
                1 Col
              </button>
              <button
                onClick={() => setViewMode("2col")}
                className={`segmented-control-button ${viewMode === "2col" ? "active" : ""}`}
              >
                2 Col
              </button>
              <button
                onClick={() => setViewMode("swipe")}
                className={`segmented-control-button ${viewMode === "swipe" ? "active" : ""}`}
              >
                Swipe
              </button>
            </div>

            <button onClick={load} disabled={loading} className="btn">
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {debug && (
              <button onClick={() => setShowDebug(!showDebug)} className="btn btn-secondary">
                {showDebug ? "Hide" : "Show"} Debug
              </button>
            )}
          </div>
        </header>

        {/* Error Message */}
        {err && (
          <div className="feed-error">
            <strong>Error:</strong> {err}
            <div className="feed-error-detail">Check the console for more details.</div>
          </div>
        )}

        {/* Debug Panel */}
        {debug && (
          <div className="debug-panel">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="debug-panel-header"
              type="button"
            >
              <span>Debug Info</span>
              <span>{showDebug ? "−" : "+"}</span>
            </button>
            {showDebug && (
              <div className="debug-panel-content">
                <pre>{JSON.stringify(debug, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Feed Posts */}
        {loading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <FeedPostSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="feed-empty">
            <p className="feed-empty-title">No posts yet</p>
            <p className="feed-empty-text">Your feed will appear here once content is available.</p>
          </div>
        ) : viewMode === "swipe" ? (
          <div className="feed-swipe-container">
            {/* Next card (behind) */}
            {nextItem && (
              <div className="feed-swipe-next">
                <div className="feed-post-frame">
                  <div className="feed-post-content">
                    <FeedPost item={nextItem} index={swipeIndex + 1} />
                  </div>
                </div>
              </div>
            )}
            {/* Current card (on top) */}
            {currentItem && (
              <div
                className="feed-swipe-current"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                style={{
                  transform: swipeTransform,
                  opacity,
                  transition,
                  cursor: isDragging ? "grabbing" : "grab",
                }}
              >
                {swipeLabel && (
                  <div
                    className={`feed-swipe-label ${swipeLabel === "LIKE" ? "like" : "pass"}`}
                    style={{ opacity: swipeLabelOpacity }}
                  >
                    {swipeLabel}
                  </div>
                )}
                <div className="feed-post-frame">
                  <div className="feed-post-content">
                    <FeedPost item={currentItem} index={swipeIndex} />
                  </div>
                </div>
              </div>
            )}
            {/* Swipe Actions */}
            <div className="feed-swipe-actions">
              <button
                onClick={() => handleSwipe("left")}
                disabled={!currentItem || isAnimating}
                className="btn-swipe btn-swipe-pass"
              >
                Pass
              </button>
              <button
                onClick={() => handleSwipe("right")}
                disabled={!currentItem || isAnimating}
                className="btn-swipe btn-swipe-like"
              >
                Like
              </button>
            </div>
          </div>
        ) : viewMode === "2col" ? (
          <div className="feed-list-2col">
            {items.map((it, index) => (
              <div key={it.id} className="feed-post-frame">
                <div className="feed-post-content">
                  <FeedPost item={it} index={index} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="feed-list-1col">
            {items.map((it, index) => (
              <div key={it.id} className="feed-post-frame">
                <div className="feed-post-content">
                  <FeedPost item={it} index={index} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
