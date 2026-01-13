import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { saveLocal, unsaveLocal, isLocallySaved } from "../data/savedLocal";
import { showToast } from "../components/ui/Toast";
import FeedPostTumblr from "../components/feed/FeedPostTumblr";
import FeedPostSkeleton from "../components/feed/FeedPostSkeleton";
import ExploreCardSkeleton from "../components/explore/ExploreCardSkeleton";
import { useSession } from "../auth/useSession";
import LoginModal from "../components/auth/LoginModal";
import { getBadge } from "../utils/badgeHelpers";

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
  created_at?: string | null;
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
type FeedResponse = { 
  feed: FeedItem[]; 
  fresh?: FeedItem[];
  today?: FeedItem[];
  debug?: Record<string, unknown> 
};

type FeedSection = {
  id: string;
  title: string;
  subtitle?: string;
  items: FeedItem[];
};

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

// Component-level function to handle save with auth check
function useExploreSave() {
  const { isAuthed } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ contentId: string; shouldSave: boolean } | null>(null);

  async function handleSave(contentId: string, shouldSave: boolean) {
    if (!isAuthed) {
      // Store pending action and show login modal
      const { storePendingAction } = await import("../utils/pendingActions");
      storePendingAction({ type: "save", contentId, shouldSave });
      setPendingSave({ contentId, shouldSave });
      setShowLoginModal(true);
      return;
    }
    await syncSaveToAccount(contentId, shouldSave);
    saveLocal(contentId);
  }

  return { handleSave, showLoginModal, setShowLoginModal, pendingSave };
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
  const [exploreDisplayCount, setExploreDisplayCount] = useState(24); // Number of cards to display
  const [exploreLoadingMore, setExploreLoadingMore] = useState(false);
  const [exploreHasMore, setExploreHasMore] = useState(true);
  const [quickFilter, setQuickFilter] = useState<string | null>(null); // "fresh" | "tech" | "culture" | "finance" | "music" | null
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
  const [feedSections, setFeedSections] = useState<FeedSection[]>([]);
  const [showFreshOnly, setShowFreshOnly] = useState(false);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const feedLoadMoreRef = useRef<HTMLDivElement>(null);
  const exploreLoadMoreRef = useRef<HTMLDivElement>(null);

  // Echo composer state for Explore mode
  const [exploreEchoCardId, setExploreEchoCardId] = useState<string | null>(null);

  // Save handler with login modal
  const { handleSave, showLoginModal, setShowLoginModal, pendingSave } = useExploreSave();

  // Shared state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
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
      setExploreDisplayCount(24); // Reset display count on new load
      setExploreHasMore(final.length > 24);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load explore content.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // Helper to get item timestamp (coalesce published_at, ingested_at)
  function getItemTimestamp(item: FeedItem): string | null {
    return item.published_at ?? (item.metadata as any)?.ingested_at ?? null;
  }

  // Load Feed content with multiple sections
  async function loadFeed() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErr("");

    try {
      // Get current user for personalized feed (optional)
      let token: string | null = null;
      try {
        token = await getAccessTokenWithRetry({ tries: 2, delayMs: 50 });
      } catch {
        token = null;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Fetch main feed for scoring/trending
      const { data: feedData, error: feedError } = await supabase.functions.invoke<FeedResponse>("social_feed", {
        method: "POST",
        headers,
        body: { limit: 200 }, // Get more items for sectioning
      });

      if (feedError) {
        console.error("[Feed] Edge Function error:", feedError);
        const status = (feedError as any).status ?? "no-status";
        const msg = (feedError as any).message ?? "no-message";
        throw new Error(`social_feed failed (${status}): ${msg}`);
      }

      if (!feedData?.feed) throw new Error("Invalid feed response (missing feed array).");

      // Also query feed_items directly for more sections
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Query feed_items for sections (order by published_at desc, fallback to ingested_at)
      const { data: allItems, error: itemsError } = await supabase
        .from("feed_items")
        .select("id,source,external_id,url,title,summary,author,image_url,published_at,tags,topics,metadata,ingested_at")
        .order("published_at", { ascending: false, nullsLast: true })
        .limit(500);

      if (itemsError) {
        console.warn("[Feed] Error querying feed_items directly:", itemsError);
      }

      // Convert feed_items to FeedItem format
      const allFeedItems: FeedItem[] = (allItems || []).map((item: any) => ({
        id: item.id,
        source: item.source as FeedSource,
        external_id: item.external_id,
        url: item.url,
        title: item.title,
        summary: item.summary,
        author: item.author,
        image_url: item.image_url,
        published_at: item.published_at,
        tags: item.tags,
        topics: item.topics,
        metadata: { ...(item.metadata || {}), ingested_at: item.ingested_at }, // Store ingested_at in metadata for getItemTimestamp
        score: 0, // Will be set from feedData if available
      }));

      // Merge scores from feedData
      const scoredMap = new Map<string, FeedItem>();
      for (const item of feedData.feed) {
        scoredMap.set(item.id, item);
      }
      for (const item of allFeedItems) {
        const scored = scoredMap.get(item.id);
        if (scored) {
          item.score = scored.score;
        }
      }

      // Track seen IDs to prevent duplicates across sections
      const seenIds = new Set<string>();

      // Helper to filter and dedupe items
      function filterAndDedupe(items: FeedItem[], filterFn: (item: FeedItem) => boolean, limit: number): FeedItem[] {
        const filtered = items.filter((item) => {
          if (seenIds.has(item.id)) return false;
          return filterFn(item);
        });
        const result = filtered.slice(0, limit);
        result.forEach((item) => seenIds.add(item.id));
        return result;
      }

      // Build sections
      const sections: FeedSection[] = [];

      // 1. Fresh: last 6h ordered by time desc
      const freshItems = filterAndDedupe(allFeedItems, (item) => {
        const ts = getItemTimestamp(item);
        if (!ts) return false;
        return ts >= sixHoursAgo;
      }, 20);
      if (freshItems.length > 0) {
        freshItems.sort((a, b) => {
          const tsA = getItemTimestamp(a) ?? "";
          const tsB = getItemTimestamp(b) ?? "";
          return tsB.localeCompare(tsA);
        });
        sections.push({
          id: "fresh",
          title: "Fresh",
          subtitle: "Last 6 hours",
          items: freshItems,
        });
      }

      // 2. Today: last 24h ordered by time desc
      const todayItems = filterAndDedupe(allFeedItems, (item) => {
        const ts = getItemTimestamp(item);
        if (!ts) return false;
        return ts >= twentyFourHoursAgo && ts < sixHoursAgo;
      }, 20);
      if (todayItems.length > 0) {
        todayItems.sort((a, b) => {
          const tsA = getItemTimestamp(a) ?? "";
          const tsB = getItemTimestamp(b) ?? "";
          return tsB.localeCompare(tsA);
        });
        sections.push({
          id: "today",
          title: "Today",
          subtitle: "Last 24 hours",
          items: todayItems,
        });
      }

      // 3. Trending: last 48h ordered by score desc
      const trendingItems = filterAndDedupe(allFeedItems, (item) => {
        const ts = getItemTimestamp(item);
        if (!ts) return false;
        return ts >= fortyEightHoursAgo && ts < twentyFourHoursAgo;
      }, 20);
      if (trendingItems.length > 0) {
        trendingItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        sections.push({
          id: "trending",
          title: "Trending",
          subtitle: "Last 48 hours",
          items: trendingItems,
        });
      }

      // 4. Deep cuts: 7-30 days old ordered by score desc
      const deepCutsItems = filterAndDedupe(allFeedItems, (item) => {
        const ts = getItemTimestamp(item);
        if (!ts) return false;
        return ts >= thirtyDaysAgo && ts < sevenDaysAgo;
      }, 20);
      if (deepCutsItems.length > 0) {
        deepCutsItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        sections.push({
          id: "deep-cuts",
          title: "Deep Cuts",
          subtitle: "7-30 days ago",
          items: deepCutsItems,
        });
      }

      // 5. Category rows: tech/culture/finance/music
      const categoryKeywords: Record<string, string[]> = {
        tech: ["tech", "technology", "ai", "startup", "engineering", "software", "coding", "developer", "programming"],
        culture: ["culture", "film", "movie", "tv", "television", "entertainment", "arts", "media", "cinema"],
        finance: ["finance", "money", "economy", "market", "trading", "investment", "business", "vc", "startup"],
        music: ["music", "album", "song", "artist", "band", "concert", "festival", "playlist", "spotify"],
      };

      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        const categoryItems = filterAndDedupe(allFeedItems, (item) => {
          const blob = `${item.title} ${item.summary || ""} ${(item.tags || []).join(" ")} ${(item.topics || []).join(" ")}`.toLowerCase();
          return keywords.some((kw) => blob.includes(kw));
        }, 15);
        if (categoryItems.length > 0) {
          categoryItems.sort((a, b) => {
            const tsA = getItemTimestamp(a) ?? "";
            const tsB = getItemTimestamp(b) ?? "";
            return tsB.localeCompare(tsA);
          });
          sections.push({
            id: `category-${category}`,
            title: category.charAt(0).toUpperCase() + category.slice(1),
            subtitle: "Curated",
            items: categoryItems,
          });
        }
      }

      // Set sections and fallback to flat feed if no sections
      if (sections.length > 0) {
        setFeedSections(sections);
        setFeedItems([]); // Clear flat feed when using sections
      } else {
        // Fallback to original feed if sections are empty
        setFeedItems(feedData.feed);
        setFeedSections([]);
      }
      
      // Reset pagination state
      setFeedOffset(500); // Next load starts at 500 (we already loaded first 500)
      setFeedHasMore((allItems?.length ?? 0) >= 500); // Has more if we got full batch
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

  // Helper to get domain from URL
  function getDomainFromUrl(url?: string | null): string {
    if (!url) return "";
    try {
      const u = new URL(url);
      return u.hostname.replace("www.", "").toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  // Explore mode filtered list with search and quick filters
  const filteredExplore = useMemo(() => {
    const q = cleanText(query);
    let filtered = exploreCards;

    // Quick filter: Fresh (last 2 hours)
    if (quickFilter === "fresh") {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      filtered = filtered.filter((c) => {
        const timestamp = c.created_at;
        if (!timestamp) return false;
        return timestamp >= twoHoursAgo;
      });
    }

    // Quick filter: Tech
    if (quickFilter === "tech") {
      filtered = filtered.filter((c) => {
        const titleLower = (c.title || "").toLowerCase();
        const tagsLower = (c.tags || []).join(" ").toLowerCase();
        const sourceLower = (c.source || "").toLowerCase();
        const blob = `${titleLower} ${tagsLower} ${sourceLower}`;
        return (
          blob.includes("tech") ||
          blob.includes("technology") ||
          blob.includes("ai") ||
          blob.includes("startup") ||
          blob.includes("engineering") ||
          blob.includes("software") ||
          blob.includes("coding") ||
          blob.includes("developer")
        );
      });
    }

    // Quick filter: Culture
    if (quickFilter === "culture") {
      filtered = filtered.filter((c) => {
        const titleLower = (c.title || "").toLowerCase();
        const tagsLower = (c.tags || []).join(" ").toLowerCase();
        const sourceLower = (c.source || "").toLowerCase();
        const blob = `${titleLower} ${tagsLower} ${sourceLower}`;
        return (
          blob.includes("culture") ||
          blob.includes("film") ||
          blob.includes("movie") ||
          blob.includes("tv") ||
          blob.includes("television") ||
          blob.includes("entertainment") ||
          blob.includes("arts") ||
          blob.includes("media") ||
          blob.includes("cinema")
        );
      });
    }

    // Quick filter: Finance
    if (quickFilter === "finance") {
      filtered = filtered.filter((c) => {
        const titleLower = (c.title || "").toLowerCase();
        const tagsLower = (c.tags || []).join(" ").toLowerCase();
        const sourceLower = (c.source || "").toLowerCase();
        const blob = `${titleLower} ${tagsLower} ${sourceLower}`;
        return (
          blob.includes("finance") ||
          blob.includes("money") ||
          blob.includes("economy") ||
          blob.includes("market") ||
          blob.includes("trading") ||
          blob.includes("investment") ||
          blob.includes("business") ||
          blob.includes("vc")
        );
      });
    }

    // Quick filter: Music
    if (quickFilter === "music") {
      filtered = filtered.filter((c) => {
        const titleLower = (c.title || "").toLowerCase();
        const tagsLower = (c.tags || []).join(" ").toLowerCase();
        const sourceLower = (c.source || "").toLowerCase();
        const blob = `${titleLower} ${tagsLower} ${sourceLower}`;
        return (
          blob.includes("music") ||
          blob.includes("album") ||
          blob.includes("song") ||
          blob.includes("artist") ||
          blob.includes("band") ||
          blob.includes("concert") ||
          blob.includes("festival") ||
          blob.includes("playlist") ||
          blob.includes("spotify")
        );
      });
    }

    // Kind filter
    filtered = filtered.filter((c) => (kindFilter === "all" ? true : c.kind === kindFilter));

    // Search filter: title + domain
    if (q) {
      filtered = filtered.filter((c) => {
        const titleMatch = matchesQuery(c, q);
        const domain = getDomainFromUrl(c.url);
        const domainMatch = domain.includes(q.toLowerCase());
        return titleMatch || domainMatch;
      });
    }

    return filtered;
  }, [exploreCards, kindFilter, query, quickFilter]);

  useEffect(() => {
    setExploreCursor((c) => Math.max(0, Math.min(c, Math.max(0, filteredExplore.length - 1))));
    // Update hasMore based on filtered results
    setExploreHasMore(exploreDisplayCount < filteredExplore.length);
    // Reset display count when filters change
    setExploreDisplayCount(24);
  }, [filteredExplore.length, exploreDisplayCount, query, quickFilter, kindFilter]);

  // IntersectionObserver for Explore infinite scroll
  useEffect(() => {
    if (exploreMode !== "browse" || !exploreLoadMoreRef.current || exploreLoadingMore || !exploreHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && exploreHasMore && !exploreLoadingMore) {
          setExploreLoadingMore(true);
          // Simulate loading delay for better UX
          setTimeout(() => {
            setExploreDisplayCount((prev) => Math.min(prev + 24, filteredExplore.length));
            setExploreLoadingMore(false);
          }, 300);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(exploreLoadMoreRef.current);

    return () => observer.disconnect();
  }, [exploreMode, exploreHasMore, exploreLoadingMore, filteredExplore.length]);

  // Load more Feed items
  async function loadMoreFeed() {
    if (feedLoadingMore || !feedHasMore) return;
    setFeedLoadingMore(true);

    try {
      const newOffset = feedOffset + 500;
      const { data: moreItems, error: itemsError } = await supabase
        .from("feed_items")
        .select("id,source,external_id,url,title,summary,author,image_url,published_at,tags,topics,metadata,ingested_at")
        .order("published_at", { ascending: false, nullsLast: true })
        .range(feedOffset, newOffset - 1);

      if (itemsError) {
        console.warn("[Feed] Error loading more items:", itemsError);
        setFeedHasMore(false);
        return;
      }

      if (!moreItems || moreItems.length === 0) {
        setFeedHasMore(false);
        return;
      }

      // Convert to FeedItem format
      const newFeedItems: FeedItem[] = (moreItems || []).map((item: any) => ({
        id: item.id,
        source: item.source as FeedSource,
        external_id: item.external_id,
        url: item.url,
        title: item.title,
        summary: item.summary,
        author: item.author,
        image_url: item.image_url,
        published_at: item.published_at,
        tags: item.tags,
        topics: item.topics,
        metadata: { ...(item.metadata || {}), ingested_at: item.ingested_at },
        score: 0,
      }));

      // Append to flat feedItems (sections will be rebuilt on next full load)
      setFeedItems((prev) => [...prev, ...newFeedItems]);
      setFeedOffset(newOffset);
      setFeedHasMore(moreItems.length === 500); // If we got less than 500, we're done
    } catch (e: any) {
      console.error("[Feed] Error loading more:", e);
      setFeedHasMore(false);
    } finally {
      setFeedLoadingMore(false);
    }
  }

  // IntersectionObserver for Feed infinite scroll
  useEffect(() => {
    if (pageMode !== "feed" || !feedLoadMoreRef.current || feedLoadingMore || !feedHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feedHasMore && !feedLoadingMore) {
          loadMoreFeed();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(feedLoadMoreRef.current);

    return () => observer.disconnect();
  }, [pageMode, feedHasMore, feedLoadingMore, feedOffset]);

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
                      boxShadow: "var(--shadow-soft)",
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
                                background: "var(--border)",
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
                      boxShadow: "var(--shadow-soft)",
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
                          border: "2px solid var(--border-strong)",
                          background: "var(--surface)",
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
                        background: "var(--border)",
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
                          background: "var(--surface)",
                          border: "1px solid var(--border-strong)",
                          fontSize: 11,
                          fontWeight: 950,
                          color: "var(--ink)",
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

                      <div style={{ marginTop: 8, fontSize: 14, color: "var(--ink-muted)" }}>
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
                            color: "var(--ink-muted)",
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
                            border: "1px solid var(--border-strong)",
                            backgroundColor: "var(--border)",
                            textDecoration: "none",
                            transition: "background-color 0.2s, border-color 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--border-strong)";
                            e.currentTarget.style.borderColor = "var(--border-strong)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--border)";
                            e.currentTarget.style.borderColor = "var(--border-strong)";
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
                            border: "1px solid var(--border-strong)",
                            cursor: "pointer",
                            background: "var(--surface)",
                            fontWeight: 950,
                            fontSize: "20px",
                          }}
                        >
                          ✕
                        </button>
                        <span style={{ fontSize: 12, opacity: 0.65, color: "var(--ink-tertiary)" }}>Not my vibe</span>
                      </div>

                      <ExploreEchoButton
                        cardId={currentExplore.id}
                        onEchoClick={() => setExploreEchoCardId(currentExplore.id)}
                      />

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={exploreHandleMatch}
                          title="Match (→)"
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 999,
                            border: "1px solid var(--border-strong)",
                            cursor: "pointer",
                            background: "var(--surface)",
                            fontWeight: 950,
                            fontSize: "20px",
                          }}
                        >
                          ♥
                        </button>
                        <span style={{ fontSize: 12, opacity: 0.65, color: "var(--ink-tertiary)" }}>This feels like a yes</span>
                      </div>
                    </div>

                    {/* Inline Echo Composer */}
                    {exploreEchoCardId === currentExplore.id && (
                      <div
                        style={{
                          padding: "20px",
                          paddingTop: "20px",
                          backgroundColor: "var(--border)",
                        }}
                      >
                        <EchoComposer
                          contentId={currentExplore.id}
                          inline={true}
                          onClose={() => setExploreEchoCardId(null)}
                          onSaved={async () => {
                            setExploreEchoCardId(null);
                            showToast("Saved to Timeline");
                            // Reload explore to refresh state
                            await loadExplore({ shuffleOnLoad: false });
                          }}
                        />
                      </div>
                    )}
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
                      boxShadow: "var(--shadow-soft)",
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
                {/* Search and Quick Filters */}
                <div style={{ marginBottom: "24px" }}>
                  {/* Search Input */}
                  <div style={{ marginBottom: "16px" }}>
                    <input
                      type="text"
                      placeholder="Search by title or domain..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{
                        width: "100%",
                        maxWidth: "500px",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface)",
                        color: "var(--ink)",
                        fontSize: "14px",
                        outline: "none",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-strong)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                      }}
                    />
                  </div>

                  {/* Quick Filter Chips */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {[
                      { id: "fresh", label: "Fresh", emoji: "🆕" },
                      { id: "tech", label: "Tech", emoji: "💻" },
                      { id: "culture", label: "Culture", emoji: "🎬" },
                      { id: "finance", label: "Finance", emoji: "💰" },
                      { id: "music", label: "Music", emoji: "🎵" },
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setQuickFilter(quickFilter === filter.id ? null : filter.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 14px",
                          borderRadius: "20px",
                          border: "1px solid var(--border)",
                          backgroundColor: quickFilter === filter.id ? "var(--ink)" : "var(--surface)",
                          color: quickFilter === filter.id ? "var(--bg)" : "var(--ink)",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (quickFilter !== filter.id) {
                            e.currentTarget.style.backgroundColor = "var(--control-bg)";
                            e.currentTarget.style.borderColor = "var(--border-strong)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (quickFilter !== filter.id) {
                            e.currentTarget.style.backgroundColor = "var(--surface)";
                            e.currentTarget.style.borderColor = "var(--border)";
                          }
                        }}
                      >
                        <span>{filter.emoji}</span>
                        <span>{filter.label}</span>
                      </button>
                    ))}
                    {quickFilter && (
                      <button
                        onClick={() => setQuickFilter(null)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "20px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--surface)",
                          color: "var(--ink-muted)",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Image-forward grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 16,
                  }}
                >
                  {filteredExplore.slice(0, exploreDisplayCount).map((c) => {
                    const isEchoOpen = exploreEchoCardId === c.id;
                    return (
                      <div key={c.id}>
                        <div
                          style={{
                            borderRadius: "6px",
                            overflow: "hidden",
                            background: "var(--surface)",
                            cursor: "pointer",
                            transition: "transform 0.2s",
                            border: "1px solid var(--border)",
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
                              background: "var(--border)",
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
                                background: "var(--surface)",
                                color: "var(--ink)",
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
                          <div
                            style={{
                              padding: "8px",
                              borderTop: "1px solid var(--border)",
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExploreEchoCardId(isEchoOpen ? null : c.id);
                              }}
                              style={{
                                width: "100%",
                                padding: "6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-strong)",
                                background: isEchoOpen ? "var(--border)" : "transparent",
                                cursor: "pointer",
                                fontSize: "12px",
                                color: "var(--ink-muted)",
                              }}
                            >
                              💭 Echo
                            </button>
                          </div>
                          {isEchoOpen && (
                            <div
                              style={{
                                padding: "12px",
                                paddingTop: "12px",
                                backgroundColor: "var(--border)",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <EchoComposer
                                contentId={c.id}
                                inline={true}
                                onClose={() => setExploreEchoCardId(null)}
                                onSaved={async () => {
                                  setExploreEchoCardId(null);
                                  showToast("Saved to Timeline");
                                  // Reload explore to refresh state
                                  await loadExplore({ shuffleOnLoad: false });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Infinite scroll trigger and load more for Explore */}
                {exploreMode === "browse" && exploreDisplayCount < filteredExplore.length && (
                  <div ref={exploreLoadMoreRef} style={{ height: "20px", marginTop: "20px" }} />
                )}
                {exploreMode === "browse" && exploreLoadingMore && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 16,
                      marginTop: "16px",
                    }}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <ExploreCardSkeleton key={`explore-skeleton-${i}`} />
                    ))}
                  </div>
                )}
                {exploreMode === "browse" && exploreDisplayCount < filteredExplore.length && !exploreLoadingMore && (
                  <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button
                      onClick={() => {
                        setExploreLoadingMore(true);
                        setTimeout(() => {
                          setExploreDisplayCount((prev) => Math.min(prev + 24, filteredExplore.length));
                          setExploreLoadingMore(false);
                        }, 100);
                      }}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--control-bg)",
                        color: "var(--ink)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 500,
                      }}
                    >
                      Load More
                    </button>
                  </div>
                )}
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

            {/* Fresh Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "var(--control-bg)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => setShowFreshOnly(!showFreshOnly)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: showFreshOnly ? "var(--ink)" : "var(--surface)",
                  color: showFreshOnly ? "var(--bg)" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                {showFreshOnly ? "✓ Fresh Only" : "Show Fresh Only"}
              </button>
              <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                {feedSections.length > 0
                  ? `${feedSections.reduce((sum, s) => sum + s.items.length, 0)} items across ${feedSections.length} sections`
                  : feedItems.length > 0
                  ? `${feedItems.length} items`
                  : ""}
              </span>
            </div>

            {/* Feed Posts - Section-based or flat */}
            {loading ? (
              <div>
                {[1, 2, 3].map((i) => (
                  <FeedPostSkeleton key={i} />
                ))}
              </div>
            ) : feedSections.length > 0 ? (
              // Render sections
              <div>
                {feedSections
                  .filter((section) => !showFreshOnly || section.id === "fresh")
                  .map((section) => (
                    <div key={section.id} style={{ marginBottom: "40px" }}>
                      {/* Section Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "16px",
                          paddingBottom: "12px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <h2
                          style={{
                            fontSize: "18px",
                            fontWeight: 600,
                            margin: 0,
                            color: "var(--ink)",
                          }}
                        >
                          {section.title}
                        </h2>
                        {section.subtitle && (
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--ink-muted)",
                            }}
                          >
                            {section.subtitle}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--ink-tertiary)",
                            marginLeft: "auto",
                          }}
                        >
                          {section.items.length} items
                        </span>
                      </div>
                      {/* Section Items */}
                      <div>
                        {section.items.map((it, index) => {
                          // Calculate badge for this item using all items in the section
                          const badge = getBadge(
                            it.published_at,
                            (it.metadata as any)?.ingested_at,
                            it.score,
                            section.items.map((i) => ({
                              score: i.score,
                              published_at: i.published_at,
                              ingested_at: (i.metadata as any)?.ingested_at,
                            }))
                          );
                          return (
                            <FeedPostTumblr
                              key={it.id}
                              item={it}
                              index={index}
                              allItems={section.items.map((i) => ({
                                score: i.score,
                                published_at: i.published_at,
                                ingested_at: (i.metadata as any)?.ingested_at,
                              }))}
                              badge={badge}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                {/* Infinite scroll trigger for Feed sections */}
                {feedHasMore && (
                  <div ref={feedLoadMoreRef} style={{ height: "20px", marginTop: "20px" }} />
                )}
                {feedLoadingMore && (
                  <div style={{ marginTop: "20px" }}>
                    {[1, 2, 3].map((i) => (
                      <FeedPostSkeleton key={`feed-skeleton-${i}`} />
                    ))}
                  </div>
                )}
                {feedHasMore && !feedLoadingMore && (
                  <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button
                      onClick={loadMoreFeed}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--control-bg)",
                        color: "var(--ink)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 500,
                      }}
                    >
                      Load More
                    </button>
                  </div>
                )}
              </div>
            ) : feedItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--ink-muted)",
                }}
              >
                <p style={{ fontSize: "15px", marginBottom: "6px" }}>No posts yet</p>
                <p style={{ fontSize: "13px" }}>Your feed will appear here once content is available.</p>
              </div>
            ) : (
              // Fallback to flat feed
              <div>
                {feedItems.map((it, index) => (
                  <FeedPostTumblr key={it.id} item={it} index={index} />
                ))}
                {/* Infinite scroll trigger for flat feed */}
                {feedHasMore && (
                  <div ref={feedLoadMoreRef} style={{ height: "20px", marginTop: "20px" }} />
                )}
                {feedLoadingMore && (
                  <div style={{ marginTop: "20px" }}>
                    {[1, 2, 3].map((i) => (
                      <FeedPostSkeleton key={`feed-flat-skeleton-${i}`} />
                    ))}
                  </div>
                )}
                {feedHasMore && !feedLoadingMore && (
                  <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button
                      onClick={loadMoreFeed}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--control-bg)",
                        color: "var(--ink)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 500,
                      }}
                    >
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Echo Composer - removed, now inline in cards */}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Sign in to save"
        message="We'll send you a magic link to sign in."
        pendingAction={pendingSave ? { type: "save", contentId: pendingSave.contentId, shouldSave: pendingSave.shouldSave } : undefined}
      />
    </div>
  );
}

