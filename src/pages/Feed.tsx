// pages/feed.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import FeedPost from "../components/feed/FeedPost";
import FeedPostSkeleton from "../components/feed/FeedPostSkeleton";

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

  // Swipe visual state
  const rotation = viewMode === "swipe" ? dragOffset * 0.06 : 0;
  const opacity = viewMode === "swipe" ? Math.max(0.35, 1 - Math.abs(dragOffset) / 320) : 1;
  const swipeLabel = viewMode === "swipe" && dragOffset > 40 ? "LIKE" : viewMode === "swipe" && dragOffset < -40 ? "PASS" : "";
  const swipeLabelOpacity = viewMode === "swipe" ? Math.min(1, Math.abs(dragOffset) / 140) : 0;
  const animX = animDir === "right" ? 420 : -420;
  const transform = isAnimating
    ? `translateX(${animX}px) rotate(${animDir === "right" ? 8 : -8}deg)`
    : viewMode === "swipe"
    ? `translateX(${dragOffset}px) rotate(${rotation}deg)`
    : "none";
  const transition = isDragging ? "none" : "transform 240ms ease, opacity 240ms ease";

  useEffect(() => {
    load();
  }, []);

  const [showDebug, setShowDebug] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "rgba(250, 248, 245, 0.5)",
        padding: "24px 16px",
      }}
    >
      {/* Main Feed Container */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 680px) minmax(0, 1fr)",
          gap: "24px",
          maxWidth: "1400px",
          margin: "0 auto",
        }}
        className="feed-layout"
      >
        <style>{`
          @media (min-width: 1024px) {
            .feed-sidebar-left,
            .feed-sidebar-right {
              display: block !important;
            }
          }
        `}</style>

        {/* Left Sidebar (placeholder for filters) - hidden on mobile */}
        <aside
          style={{
            display: "none",
          }}
          className="feed-sidebar-left"
        >
          <div
            style={{
              position: "sticky",
              top: "24px",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.08)",
              backgroundColor: "rgba(255,255,255,0.6)",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "rgba(0,0,0,0.7)" }}>
              Filters
            </h3>
            <p style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)" }}>Coming soon</p>
          </div>
        </aside>

        {/* Center Feed Column */}
        <main style={{ width: "100%" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "32px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "clamp(24px, 4vw, 32px)",
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: "8px",
                  color: "rgba(0,0,0,0.9)",
                }}
              >
                Your Feed
              </h1>
              <p
                style={{
                  fontSize: "15px",
                  color: "rgba(0,0,0,0.6)",
                  margin: 0,
                }}
              >
                One scroll. Everything you care about.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {/* View Mode Selector */}
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  padding: "4px",
                  borderRadius: "8px",
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.9)",
                }}
              >
                <button
                  onClick={() => setViewMode("1col")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "1col" ? "rgba(0,0,0,0.1)" : "transparent",
                    cursor: "pointer",
                    fontWeight: viewMode === "1col" ? 600 : 500,
                    fontSize: "12px",
                    color: "rgba(0,0,0,0.8)",
                    transition: "all 0.2s",
                  }}
                >
                  1 Col
                </button>
                <button
                  onClick={() => setViewMode("2col")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "2col" ? "rgba(0,0,0,0.1)" : "transparent",
                    cursor: "pointer",
                    fontWeight: viewMode === "2col" ? 600 : 500,
                    fontSize: "12px",
                    color: "rgba(0,0,0,0.8)",
                    transition: "all 0.2s",
                  }}
                >
                  2 Col
                </button>
                <button
                  onClick={() => setViewMode("swipe")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "swipe" ? "rgba(0,0,0,0.1)" : "transparent",
                    cursor: "pointer",
                    fontWeight: viewMode === "swipe" ? 600 : 500,
                    fontSize: "12px",
                    color: "rgba(0,0,0,0.8)",
                    transition: "all 0.2s",
                  }}
                >
                  Swipe
                </button>
              </div>
              <button
                onClick={load}
                disabled={loading}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: loading ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.9)",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "rgba(0,0,0,0.8)",
                  transition: "all 0.2s",
                  opacity: loading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = "rgba(255,255,255,1)";
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.9)";
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)";
                  }
                }}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              {debug && (
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(255,255,255,0.9)",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "12px",
                    color: "rgba(0,0,0,0.6)",
                  }}
                >
                  {showDebug ? "Hide" : "Show"} Debug
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {err && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                backgroundColor: "rgba(239, 68, 68, 0.05)",
                color: "rgba(239, 68, 68, 0.9)",
              }}
            >
              <strong>Error:</strong> {err}
              <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}>
                Check the console for more details.
              </div>
            </div>
          )}

          {/* Debug Info */}
          {showDebug && debug && (
            <div
              style={{
                marginBottom: "24px",
                padding: "12px",
                borderRadius: "6px",
                backgroundColor: "rgba(0,0,0,0.03)",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "rgba(0,0,0,0.6)",
                overflow: "auto",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(debug, null, 2)}</pre>
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
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "rgba(0,0,0,0.5)",
              }}
            >
              <p style={{ fontSize: "16px", marginBottom: "8px" }}>No posts yet</p>
              <p style={{ fontSize: "14px" }}>Your feed will appear here once content is available.</p>
            </div>
          ) : viewMode === "swipe" ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "680px",
                margin: "0 auto",
                height: "600px",
              }}
            >
              {/* Next card (behind) */}
              {nextItem && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "50%",
                    transform: "translateX(-50%) scale(0.97)",
                    width: "100%",
                    zIndex: 1,
                    opacity: 0.6,
                    pointerEvents: "none",
                  }}
                >
                  <FeedPost item={nextItem} index={swipeIndex + 1} />
              </div>
              )}
              {/* Current card (on top) */}
              {currentItem && (
                <div
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: `translateX(calc(-50% + ${isAnimating ? 0 : dragOffset}px)) ${isAnimating ? "" : `rotate(${rotation}deg)`}`,
                    width: "100%",
                    zIndex: 2,
                    opacity,
                    transition,
                    cursor: isDragging ? "grabbing" : "grab",
                    touchAction: "none",
                  }}
                >
                  {swipeLabel && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: "48px",
                        fontWeight: 900,
                        color: swipeLabel === "LIKE" ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)",
                        opacity: swipeLabelOpacity,
                        pointerEvents: "none",
                        zIndex: 10,
                        textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      {swipeLabel}
              </div>
                  )}
                  <FeedPost item={currentItem} index={swipeIndex} />
                </div>
              )}
              {/* Swipe instructions */}
              <div
                style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "16px",
                  zIndex: 3,
                }}
              >
                <button
                  onClick={() => handleSwipe("left")}
                  disabled={!currentItem || isAnimating}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    background: "rgba(255,255,255,0.9)",
                    cursor: !currentItem || isAnimating ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "rgba(239, 68, 68, 0.9)",
                    opacity: !currentItem || isAnimating ? 0.5 : 1,
                  }}
                >
                  ❌ Pass
                </button>
                <button
                  onClick={() => handleSwipe("right")}
                  disabled={!currentItem || isAnimating}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    background: "rgba(255,255,255,0.9)",
                    cursor: !currentItem || isAnimating ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "rgba(34, 197, 94, 0.9)",
                    opacity: !currentItem || isAnimating ? 0.5 : 1,
                  }}
                >
                  ♥ Like
                </button>
              </div>
            </div>
          ) : viewMode === "2col" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "24px",
              }}
            >
              {items.map((it, index) => (
                <FeedPost key={it.id} item={it} index={index} />
              ))}
            </div>
          ) : (
            <div>
              {items.map((it, index) => (
                <FeedPost key={it.id} item={it} index={index} />
              ))}
            </div>
          )}
        </main>

        {/* Right Sidebar (placeholder for saved) - hidden on mobile */}
        <aside
          style={{
            display: "none",
          }}
          className="feed-sidebar-right"
        >
          <div
            style={{
              position: "sticky",
              top: "24px",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.08)",
              backgroundColor: "rgba(255,255,255,0.6)",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "rgba(0,0,0,0.7)" }}>
              Saved
            </h3>
            <p style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)" }}>Coming soon</p>
          </div>
        </aside>
      </div>
    </div>
  );
}



