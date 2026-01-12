import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { saveLocal, unsaveLocal, isLocallySaved } from "../data/savedLocal";
import EchoComposer from "../components/echo/EchoComposer";
import FeedPost from "../components/feed/FeedPost";
import FeedPostSkeleton from "../components/feed/FeedPostSkeleton";

// ============================================================
// Types
// ============================================================
type PageMode = "explore" | "feed";

// Explore mode types (timeless content)
type ExploreCard = {
  id: string;
  kind: "movie" | "book" | "podcast" | "music" | "creator" | "event" | "other";
  title: string;
  byline?: string | null;
  meta?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: string;
  tags?: string[] | null;
  headline?: string | null;
  story?: string | null;
  prompts?: string[] | null;
  opener?: string | null;
  bio?: string | null;
  blurb?: string | null;
};

type ExploreResponse = { feed: ExploreCard[]; debug?: Record<string, unknown> };
type SwipeDir = "left" | "right";
type Tone = "playful" | "mysterious" | "cozy";
type SwipeAction = { id: string; kind: string; ts: number };
type ExploreMode = "swipe" | "browse";
type KindFilter = "all" | ExploreCard["kind"];

// Feed mode types (timely content)
type FeedSource = "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";
type FeedItem = {
  id: string;
  source: FeedSource;
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

// ============================================================
// Helpers
// ============================================================
function getInitialMode(location: { pathname: string }): PageMode {
  // Check URL first - if on /feed, start in feed mode
  if (location.pathname === "/feed") return "feed";
  // Otherwise check localStorage
  try {
    const stored = localStorage.getItem("kivaw_page_mode_v1");
    if (stored === "explore" || stored === "feed") return stored;
  } catch {
    // ignore
  }
  return "explore"; // default
}

function setStoredMode(mode: PageMode) {
  try {
    localStorage.setItem("kivaw_page_mode_v1", mode);
  } catch {
    // ignore
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cleanText(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((x) => {
    if (!x?.id) return false;
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

function getSessionTone(): Tone {
  const stored = sessionStorage.getItem("kivaw_tone_v1");
  if (stored === "playful" || stored === "mysterious" || stored === "cozy") return stored;
  const tones: Tone[] = ["playful", "mysterious", "cozy"];
  const tone = tones[Math.floor(Math.random() * tones.length)];
  sessionStorage.setItem("kivaw_tone_v1", tone);
  return tone;
}

function getLocalStorageActions(key: string): SwipeAction[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLocalStorageAction(key: string, action: SwipeAction) {
  try {
    const existing = getLocalStorageActions(key);
    const filtered = existing.filter((a) => a.id !== action.id);
    localStorage.setItem(key, JSON.stringify([...filtered, action]));
  } catch {
    // ignore
  }
}

function getMatchCount(): number {
  return getLocalStorageActions("kivaw_matches_v1").length;
}

function getPassCount(): number {
  return getLocalStorageActions("kivaw_passes_v1").length;
}

function kindEmoji(kind: string) {
  switch (kind) {
    case "movie":
      return "🎬";
    case "book":
      return "📚";
    case "podcast":
      return "🎧";
    case "music":
      return "🎵";
    case "creator":
      return "🧑‍🎨";
    case "event":
      return "📍";
    default:
      return "✨";
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case "movie":
      return "Movie";
    case "book":
      return "Book";
    case "podcast":
      return "Podcast";
    case "music":
      return "Music";
    case "creator":
      return "Creator";
    case "event":
      return "Event";
    default:
      return "Pick";
  }
}

function formatMeta(kind: string, meta?: string | null) {
  const m = cleanText(meta);
  if (!m) return null;
  if (kind === "book") {
    if (/^published\s*:/i.test(m)) return m;
    if (/^\d{4}$/.test(m)) return `Published: ${m}`;
  }
  return m;
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function matchesQuery(card: ExploreCard, q: string) {
  if (!q) return true;
  const query = q.toLowerCase();
  const hay = [
    card.title,
    card.byline,
    card.meta,
    ...(card.tags ?? []),
    card.source,
    card.kind,
    card.blurb,
    card.bio,
    card.story,
    card.opener,
    card.headline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

async function getAccessTokenWithRetry(opts?: { tries?: number; delayMs?: number }) {
  const tries = opts?.tries ?? 10;
  const delayMs = opts?.delayMs ?? 120;
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return token;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function syncSaveToAccount(contentId: string, shouldSave: boolean) {
  const uid = await getUserId();
  if (!uid) return;
  if (shouldSave) {
    await supabase.from("saved_items").upsert([{ user_id: uid, content_id: contentId }], {
      onConflict: "user_id,content_id",
    });
  } else {
    await supabase.from("saved_items").delete().eq("user_id", uid).eq("content_id", contentId);
  }
}

// ============================================================
// Component
// ============================================================
export default function ExploreFeed() {
  const location = useLocation();
  const navigate = useNavigate();
  // Mode state - initialize from URL or localStorage
  const [pageMode, setPageMode] = useState<PageMode>(getInitialMode(location));

  // Explore mode state
  const [exploreCards, setExploreCards] = useState<ExploreCard[]>([]);
  const [exploreMode, setExploreMode] = useState<ExploreMode>("browse");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [exploreCursor, setExploreCursor] = useState(0);
  const [exploreIsDragging, setExploreIsDragging] = useState(false);
  const [exploreDragStartX, setExploreDragStartX] = useState(0);
  const [exploreDragOffset, setExploreDragOffset] = useState(0);
  const [exploreIsAnimating, setExploreIsAnimating] = useState(false);
  const [exploreAnimDir, setExploreAnimDir] = useState<SwipeDir>("right");
  const [tone] = useState<Tone>(getSessionTone());
  const [matchCount, setMatchCount] = useState(getMatchCount());
  const [passCount, setPassCount] = useState(getPassCount());

  // Feed mode state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  // Shared state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showEchoComposer, setShowEchoComposer] = useState(false);
  const [echoContentId, setEchoContentId] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const safeMode = false;

  // Load Explore content (timeless)
  async function loadExplore(opts?: { shuffleOnLoad?: boolean }) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErr("");

    try {
      let token: string | null = null;
      try {
        token = await getAccessTokenWithRetry({ tries: 2, delayMs: 50 });
      } catch {
        token = null;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const { data, error } = await supabase.functions.invoke<ExploreResponse>("feed", {
        method: "POST",
        headers,
        body: { tone, safeMode },
      });

      if (error) {
        console.error("[Explore] Edge Function error:", error);
        const statusCode = (error as any).status || (error as any).code;
        if (statusCode === 401 || (error as any).message?.includes("401")) {
          throw new Error("Authentication required. Please try signing in.");
        }
        throw new Error(error.message || "Failed to load explore content");
      }

      if (!data || !Array.isArray(data.feed)) {
        throw new Error("Invalid response from feed function");
      }

      const sanitized = (data.feed ?? [])
        .filter(Boolean)
        .filter((c) => typeof (c as any).id === "string" && typeof (c as any).title === "string")
        .map((c) => {
          const kindRaw = (c.kind ?? "other") as ExploreCard["kind"];
          const kind =
            kindRaw === "movie" ||
            kindRaw === "book" ||
            kindRaw === "podcast" ||
            kindRaw === "music" ||
            kindRaw === "creator" ||
            kindRaw === "event" ||
            kindRaw === "other"
              ? kindRaw
              : "other";

          return {
            ...c,
            kind,
            title: cleanText(c.title),
            byline: c.byline ? cleanText(c.byline) : c.byline,
            meta: c.meta ? cleanText(c.meta) : c.meta,
            tags: Array.isArray(c.tags) ? c.tags.map((t) => cleanText(String(t))).filter(Boolean) : c.tags,
            source: String(c.source ?? "unknown"),
          } as ExploreCard;
        });

      const unique = dedupeById(sanitized);
      const final = opts?.shuffleOnLoad ? shuffle(unique) : unique;

      setExploreCards(final);
      setExploreCursor(0);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load explore content.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // Load Feed content (timely)
  async function loadFeed() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErr("");

    try {
      const { data, error } = await supabase.functions.invoke<FeedResponse>("social_feed", {
        body: { limit: 50 },
      });

      if (error) {
        console.error("[Feed] Edge Function error:", error);
        const status = (error as any).status ?? "no-status";
        const msg = (error as any).message ?? "no-message";
        throw new Error(`social_feed failed (${status}): ${msg}`);
      }

      if (!data?.feed) throw new Error("Invalid feed response (missing feed array).");

      setFeedItems(data.feed);
    } catch (e: any) {
      console.error("[Feed load error]", e);
      setErr(e?.message ?? "Failed to load feed");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // Sync mode with URL on mount and URL changes
  useEffect(() => {
    const urlMode = location.pathname === "/feed" ? "feed" : "explore";
    if (urlMode !== pageMode) {
      setPageMode(urlMode);
      setStoredMode(urlMode);
    }
  }, [location.pathname]); // Only depend on pathname, not pageMode to avoid loops

  // Load content based on current mode
  useEffect(() => {
    if (pageMode === "explore") {
      loadExplore({ shuffleOnLoad: true });
    } else {
      loadFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMode, tone, safeMode]);

  // Handle mode change
  function handleModeChange(mode: PageMode) {
    setPageMode(mode);
    setStoredMode(mode);
    setErr("");
    // Update URL to match mode
    if (mode === "explore" && location.pathname === "/feed") {
      navigate("/explore", { replace: true });
    } else if (mode === "feed" && location.pathname === "/explore") {
      navigate("/feed", { replace: true });
    }
  }

  // Explore mode filtered list
  const filteredExplore = useMemo(() => {
    const q = cleanText(query);
    return exploreCards
      .filter((c) => (kindFilter === "all" ? true : c.kind === kindFilter))
      .filter((c) => matchesQuery(c, q));
  }, [exploreCards, kindFilter, query]);

  useEffect(() => {
    setExploreCursor((c) => Math.max(0, Math.min(c, Math.max(0, filteredExplore.length - 1))));
  }, [filteredExplore.length]);

  const currentExplore = filteredExplore[exploreCursor] ?? null;
  const nextExplore = filteredExplore.slice(exploreCursor + 1, exploreCursor + 7);

  // Explore swipe functionality
  const SWIPE_THRESHOLD = 110;
  const exploreRotation = exploreDragOffset * 0.06;
  const exploreOpacity = clamp(1 - Math.abs(exploreDragOffset) / 320, 0.35, 1);
  const exploreSwipeLabel = exploreDragOffset > 40 ? "LIKE" : exploreDragOffset < -40 ? "NOPE" : "";
  const exploreSwipeLabelOpacity = clamp(Math.abs(exploreDragOffset) / 140, 0, 1);
  const exploreAnimX = exploreAnimDir === "right" ? 420 : -420;
  const exploreTransform = exploreIsAnimating
    ? `translateX(${exploreAnimX}px) rotate(${exploreAnimDir === "right" ? 8 : -8}deg)`
    : `translateX(${exploreDragOffset}px) rotate(${exploreRotation}deg)`;
  const exploreTransition = exploreIsDragging ? "none" : "transform 240ms ease, opacity 240ms ease";

  function exploreNextCard() {
    setExploreCursor((c) => {
      const next = c + 1;
      return next >= filteredExplore.length ? c : next;
    });
  }

  function exploreDoSwipe(dir: SwipeDir) {
    if (!currentExplore || exploreIsAnimating) return;

    const action: SwipeAction = { id: currentExplore.id, kind: currentExplore.kind, ts: Date.now() };
    if (dir === "right") {
      saveLocalStorageAction("kivaw_matches_v1", action);
      setMatchCount(getMatchCount());
      saveLocal(currentExplore.id);
      syncSaveToAccount(currentExplore.id, true).catch(console.warn);
    } else {
      saveLocalStorageAction("kivaw_passes_v1", action);
      setPassCount(getPassCount());
    }

    setExploreIsDragging(false);
    setExploreDragOffset(0);
    setExploreDragStartX(0);
    setExploreAnimDir(dir);
    setExploreIsAnimating(true);

    setTimeout(() => {
      exploreNextCard();
      setExploreIsAnimating(false);
    }, 240);
  }

  function exploreHandlePass() {
    exploreDoSwipe("left");
  }

  function exploreHandleMatch() {
    exploreDoSwipe("right");
  }

  function getClientX(e: MouseEvent | TouchEvent): number {
    if ("touches" in e) return e.touches[0]?.clientX ?? 0;
    return e.clientX;
  }

  function exploreHandleDragStart(e: React.MouseEvent | React.TouchEvent) {
    if (!currentExplore || exploreIsAnimating) return;
    const clientX = getClientX(e.nativeEvent);
    setExploreIsDragging(true);
    setExploreDragStartX(clientX);
    setExploreDragOffset(0);
  }

  useEffect(() => {
    if (!exploreIsDragging || !currentExplore || exploreMode !== "swipe") return;

    function handleMove(e: MouseEvent | TouchEvent) {
      if ("touches" in e) e.preventDefault();
      const clientX = getClientX(e);
      setExploreDragOffset(clientX - exploreDragStartX);
    }

    function handleEnd() {
      const abs = Math.abs(exploreDragOffset);
      if (abs >= SWIPE_THRESHOLD) {
        exploreDragOffset < 0 ? exploreHandlePass() : exploreHandleMatch();
        return;
      }
      setExploreIsDragging(false);
      setExploreDragOffset(0);
      setExploreDragStartX(0);
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
  }, [exploreIsDragging, exploreDragStartX, exploreDragOffset, currentExplore, exploreIsAnimating, exploreMode]);


  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;

      if (pageMode === "explore" && exploreMode === "swipe") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          exploreHandlePass();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          exploreHandleMatch();
        }
      }


      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        if (pageMode === "explore") {
          loadExplore({ shuffleOnLoad: true });
        } else {
          loadFeed();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pageMode, exploreMode, currentExplore, exploreIsAnimating]);

  const desc =
    cleanText(currentExplore?.blurb) ||
    cleanText(currentExplore?.bio) ||
    cleanText(currentExplore?.story) ||
    cleanText(currentExplore?.opener) ||
    "";
  const shortDesc = desc.length > 190 ? desc.slice(0, 190).trimEnd() + "…" : desc;

  const toneLabels: Record<Tone, string> = {
    playful: "✨ Playful",
    mysterious: "🌙 Mysterious",
    cozy: "☕ Cozy",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        padding: pageMode === "feed" ? "20px 16px" : "24px 16px",
      }}
    >
      <div style={{ maxWidth: pageMode === "feed" ? "680px" : "1400px", margin: "0 auto" }}>
        {/* Mode Toggle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: pageMode === "feed" ? "24px" : "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "4px",
              borderRadius: "12px",
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <button
              onClick={() => handleModeChange("explore")}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: pageMode === "explore" ? "var(--border-strong)" : "transparent",
                cursor: "pointer",
                fontWeight: pageMode === "explore" ? 600 : 500,
                fontSize: "14px",
                color: "var(--ink-muted)",
                transition: "all 0.2s",
              }}
            >
              Explore
            </button>
            <button
              onClick={() => handleModeChange("feed")}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: pageMode === "feed" ? "var(--border-strong)" : "transparent",
                cursor: "pointer",
                fontWeight: pageMode === "feed" ? 600 : 500,
                fontSize: "14px",
                color: "var(--ink-muted)",
                transition: "all 0.2s",
              }}
            >
              Feed
            </button>
          </div>
        </div>

        {/* Error Message */}
        {err && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "rgba(239, 68, 68, 0.9)",
              fontSize: "14px",
            }}
          >
            <strong>Error:</strong> {err}
          </div>
        )}

        {/* EXPLORE MODE */}
        {pageMode === "explore" && (
          <div>
            {/* Header - tighter spacing */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: "24px",
                maxWidth: "1180px",
                margin: "0 auto 24px",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: "6px",
                    color: "var(--ink)",
                  }}
                >
                  Explore
                </h1>
                <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "var(--border)",
                      color: "var(--ink-muted)",
                    }}
                  >
                    {toneLabels[tone]}
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink-tertiary)" }}>
                    <span>Matches: <strong>{matchCount}</strong></span>
                    <span>Passes: <strong>{passCount}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  style={{
                    width: 200,
                    maxWidth: "72vw",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-strong)",
                    outline: "none",
                    background: "var(--control-bg)",
                    fontSize: "13px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setExploreCards((c) => shuffle(c));
                    setExploreCursor(0);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-strong)",
                    background: "var(--control-bg)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Shuffle
                </button>
                <button
                  type="button"
                  onClick={() => loadExplore({ shuffleOnLoad: true })}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-strong)",
                    background: "var(--control-bg)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Mode switch - tighter */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "1180px", margin: "0 auto 20px" }}>
              <button
                type="button"
                onClick={() => setExploreMode("browse")}
                style={{
                  fontSize: 12,
                  fontWeight: exploreMode === "browse" ? 600 : 500,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-strong)",
                  background: exploreMode === "browse" ? "var(--border)" : "transparent",
                  cursor: "pointer",
                }}
              >
                Browse
              </button>
              <button
                type="button"
                onClick={() => setExploreMode("swipe")}
                style={{
                  fontSize: 12,
                  fontWeight: exploreMode === "swipe" ? 600 : 500,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-strong)",
                  background: exploreMode === "swipe" ? "var(--border)" : "transparent",
                  cursor: "pointer",
                }}
              >
                Swipe
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "48px", color: "var(--ink-tertiary)" }}>Loading…</div>
            ) : filteredExplore.length === 0 ? (
              <div
                style={{
                  maxWidth: "680px",
                  margin: "0 auto",
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid var(--border-strong)",
                  background: "var(--control-bg)",
                  opacity: 0.9,
                }}
              >
                Nothing matches your filters/search. Try clearing search or switching filters.
              </div>
            ) : exploreMode === "swipe" && currentExplore ? (
              <div
                style={{
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 680px) minmax(0, 1fr)",
                  gap: 24,
                  alignItems: "start",
                  maxWidth: "1400px",
                  margin: "0 auto",
                }}
              >
                {/* Left rail */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 18, alignSelf: "start" }}>
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", opacity: 0.7, marginBottom: "12px" }}>
                      UP NEXT
                    </div>
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      {nextExplore.length ? (
                        nextExplore.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const idx = filteredExplore.findIndex((x) => x.id === c.id);
                              if (idx >= 0) setExploreCursor(idx);
                            }}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              padding: "10px",
                              borderRadius: "8px",
                              border: "1px solid var(--border-strong)",
                              background: "var(--surface)",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--cardSolid)";
                              e.currentTarget.style.borderColor = "var(--border-strong)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--surface)";
                              e.currentTarget.style.borderColor = "var(--border-strong)";
                            }}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                overflow: "hidden",
                                background: "rgba(0,0,0,0.06)",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {c.image_url ? (
                                <img src={c.image_url} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ fontSize: 18 }}>{kindEmoji(c.kind)}</div>
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 950, lineHeight: 1.2 }}>
                                {cleanText(c.title).slice(0, 50)}
                                {cleanText(c.title).length > 50 ? "…" : ""}
                              </div>
                              <div style={{ marginTop: 2, fontSize: 12, opacity: 0.65 }}>
                                {kindEmoji(c.kind)} {kindLabel(c.kind)}
                                {c.byline ? ` • ${cleanText(c.byline).slice(0, 34)}` : ""}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div style={{ opacity: 0.65, fontSize: 13 }}>You're at the end. Refresh to get more.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main card */}
                <div style={{ display: "grid", placeItems: "center" }}>
                  <div
                    style={{
                      width: "min(680px, 92vw)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface)",
                      cursor: exploreIsDragging ? "grabbing" : "grab",
                      userSelect: "none",
                      touchAction: "pan-y pinch-zoom",
                      WebkitUserSelect: "none",
                      transform: exploreTransform,
                      opacity: exploreIsAnimating ? 0 : exploreOpacity,
                      transition: exploreTransition,
                      position: "relative",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                    onMouseDown={exploreHandleDragStart}
                    onTouchStart={exploreHandleDragStart}
                  >
                    {exploreSwipeLabel && (
                      <div
                        style={{
                          position: "absolute",
                          top: 16,
                          left: exploreSwipeLabel === "LIKE" ? 16 : "auto",
                          right: exploreSwipeLabel === "NOPE" ? 16 : "auto",
                          zIndex: 5,
                          padding: "8px 12px",
                          borderRadius: 12,
                          border: "2px solid rgba(0,0,0,0.22)",
                          background: "rgba(255,255,255,0.72)",
                          fontWeight: 950,
                          letterSpacing: "1px",
                          opacity: exploreSwipeLabelOpacity,
                          transform: `rotate(${exploreSwipeLabel === "LIKE" ? -10 : 10}deg)`,
                        }}
                      >
                        {exploreSwipeLabel}
                      </div>
                    )}

                    <div
                      style={{
                        height: "400px",
                        background: "rgba(0,0,0,0.04)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {currentExplore.image_url ? (
                        <img
                          src={currentExplore.image_url}
                          alt={currentExplore.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 54 }}>{kindEmoji(currentExplore.kind)}</div>
                            <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {kindLabel(currentExplore.kind)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          position: "absolute",
                          left: 14,
                          bottom: 14,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.72)",
                          border: "1px solid rgba(0,0,0,0.12)",
                          fontSize: 11,
                          fontWeight: 950,
                          color: "rgba(0,0,0,0.72)",
                          backdropFilter: "blur(4px)",
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <span>{kindEmoji(currentExplore.kind)}</span>
                        <span>{kindLabel(currentExplore.kind)}</span>
                        <span style={{ opacity: 0.55 }}>•</span>
                        <span style={{ opacity: 0.75 }}>{currentExplore.source}</span>
                      </div>
                    </div>

                    <div style={{ padding: "20px" }}>
                      <h2
                        style={{
                          fontSize: "clamp(18px, 2vw, 22px)",
                          fontWeight: 600,
                          margin: 0,
                          marginBottom: "12px",
                          lineHeight: 1.4,
                          color: "var(--ink)",
                        }}
                      >
                        {currentExplore.title}
                      </h2>

                      <div style={{ marginTop: 8, fontSize: 14, color: "rgba(0,0,0,0.72)" }}>
                        {currentExplore.byline ? <span style={{ fontWeight: 800 }}>{cleanText(currentExplore.byline)}</span> : null}
                        {currentExplore.byline && formatMeta(currentExplore.kind, currentExplore.meta) ? (
                          <span style={{ opacity: 0.6 }}> • </span>
                        ) : null}
                        {formatMeta(currentExplore.kind, currentExplore.meta) ? (
                          <span style={{ opacity: 0.7 }}>{formatMeta(currentExplore.kind, currentExplore.meta)}</span>
                        ) : null}
                      </div>

                      {shortDesc ? (
                        <div
                          style={{
                            marginTop: "12px",
                            fontSize: "15px",
                            lineHeight: 1.6,
                            color: "rgba(0,0,0,0.75)",
                            marginBottom: "12px",
                          }}
                        >
                          {shortDesc}
                        </div>
                      ) : (
                        <div style={{ marginTop: "12px", fontSize: "14px", opacity: 0.6, marginBottom: "12px" }}>
                          No description yet.
                        </div>
                      )}

                      {currentExplore.url ? (
                        <a
                          href={currentExplore.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            marginTop: "16px",
                            padding: "12px",
                            borderRadius: "6px",
                            border: "1px solid rgba(0,0,0,0.1)",
                            backgroundColor: "rgba(0,0,0,0.02)",
                            textDecoration: "none",
                            transition: "background-color 0.2s, border-color 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)";
                            e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)";
                            e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)";
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                color: "rgba(0,0,0,0.6)",
                                fontWeight: 500,
                              }}
                            >
                              {currentExplore.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </span>
                            <span
                              style={{
                                fontSize: "13px",
                                color: "rgba(0,0,0,0.5)",
                              }}
                            >
                              Open ↗
                            </span>
                          </div>
                        </a>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16, padding: "0 20px 20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={exploreHandlePass}
                          title="Pass (←)"
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 999,
                            border: "1px solid rgba(0,0,0,0.12)",
                            cursor: "pointer",
                            background: "rgba(255,255,255,0.9)",
                            fontWeight: 950,
                            fontSize: "20px",
                          }}
                        >
                          ✕
                        </button>
                        <span style={{ fontSize: 12, opacity: 0.65, color: "rgba(0,0,0,0.65)" }}>Not my vibe</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => {
                            setEchoContentId(currentExplore.id);
                            setShowEchoComposer(true);
                          }}
                          title="Echo"
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 999,
                            border: "1px solid rgba(0,0,0,0.12)",
                            cursor: "pointer",
                            background: "rgba(255,255,255,0.9)",
                            fontWeight: 950,
                            fontSize: "20px",
                          }}
                        >
                          💭
                        </button>
                        <span style={{ fontSize: 12, opacity: 0.65, color: "rgba(0,0,0,0.65)" }}>Echo</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={exploreHandleMatch}
                          title="Match (→)"
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 999,
                            border: "1px solid rgba(0,0,0,0.12)",
                            cursor: "pointer",
                            background: "rgba(255,255,255,0.9)",
                            fontWeight: 950,
                            fontSize: "20px",
                          }}
                        >
                          ♥
                        </button>
                        <span style={{ fontSize: 12, opacity: 0.65, color: "rgba(0,0,0,0.65)" }}>This feels like a yes</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right rail */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 18, alignSelf: "start" }}>
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", opacity: 0.7, marginBottom: "12px" }}>
                      QUICK PICKS
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)" }}>Coming soon</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
                {/* Image-forward grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 16,
                  }}
                >
                  {filteredExplore.slice(0, 24).map((c) => {
                    const m = formatMeta(c.kind, c.meta);

                    return (
                      <div
                        key={c.id}
                        style={{
                          borderRadius: "6px",
                          overflow: "hidden",
                          background: "rgba(255,255,255,0.6)",
                          cursor: "pointer",
                          transition: "transform 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.02)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        onClick={() => {
                          const idx = filteredExplore.findIndex((x) => x.id === c.id);
                          if (idx >= 0) {
                            setExploreMode("swipe");
                            setExploreCursor(idx);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: "3/4",
                            background: "rgba(0,0,0,0.04)",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {c.image_url ? (
                            <img
                              src={c.image_url}
                              alt={c.title}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 32 }}>
                              {kindEmoji(c.kind)}
                            </div>
                          )}
                          <div
                            style={{
                              position: "absolute",
                              bottom: 8,
                              left: 8,
                              right: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "6px 8px",
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.9)",
                              color: "var(--ink-muted)",
                              display: "flex",
                              gap: 4,
                              alignItems: "center",
                            }}
                          >
                            <span>{kindEmoji(c.kind)}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cleanText(c.title).slice(0, 30)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEED MODE - Text-forward, Tumblr-style */}
        {pageMode === "feed" && (
          <div>
            {/* Minimal header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  margin: 0,
                  color: "rgba(0,0,0,0.9)",
                }}
              >
                Feed
              </h1>
              <button
                onClick={loadFeed}
                disabled={loading}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: loading ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.8)",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  fontSize: "13px",
                  color: "rgba(0,0,0,0.7)",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {/* Feed Posts - Tumblr-style vertical feed (single column, text-forward) */}
            {loading ? (
              <div>
                {[1, 2, 3].map((i) => (
                  <FeedPostSkeleton key={i} />
                ))}
              </div>
            ) : feedItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "rgba(0,0,0,0.5)",
                }}
              >
                <p style={{ fontSize: "15px", marginBottom: "6px" }}>No posts yet</p>
                <p style={{ fontSize: "13px" }}>Your feed will appear here once content is available.</p>
              </div>
            ) : (
              <div>
                {feedItems.map((it, index) => (
                  <FeedPost key={it.id} item={it} index={index} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Echo Composer */}
        {showEchoComposer && (
          <EchoComposer
            contentId={echoContentId}
            onClose={() => {
              setShowEchoComposer(false);
              setEchoContentId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

