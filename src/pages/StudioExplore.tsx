// src/pages/StudioExplore.tsx
// Studio Explore — editorial grid + signal filters (WORKING)
// Uses explore_feed_v2 Edge Function (same as ExplorePage.tsx)

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { useSession } from "../auth/useSession";
import { supabase } from "../lib/supabaseClient";
import { saveItem, unsaveItem, fetchSavedIds } from "../data/savesApi";
import { createEcho } from "../data/echoApi";
import "../styles/studio.css";
import { formatProviderName, formatShortDate, normalizeTags, toText, inferSignal } from "../ui/studioNormalize";
import { FilterDrawer } from "../components/FilterDrawer";
import { NewsIcon, MovieIcon, BookIcon, MusicIcon, SparkleIcon } from "../components/icons/ContentIcons";
import { type FetchError } from "../lib/supabaseFetch";

type Signal =
  | "all"
  | "news"
  | "social"
  | "podcast"
  | "video"
  | "music"
  | "watch"
  | "read"
  | "creator";

const SIGNALS: { key: Signal; label: string }[] = [
  { key: "all", label: "All" },
  { key: "news", label: "News" },
  { key: "social", label: "Social" },
  { key: "podcast", label: "Podcasts" },
  { key: "video", label: "Video" },
  { key: "music", label: "Music" },
  { key: "watch", label: "Watch" },
  { key: "read", label: "Read" },
  { key: "creator", label: "Creators" },
];

// Unified item from explore_feed_v2
type UnifiedContentItem = {
  id: string;
  kind: string;
  title: any;
  byline: any;
  image_url: any;
  summary?: any;
  url: any;
  provider: string;
  tags: any[];
  created_at: string;
  score?: number | null;
  raw?: any;
};

type ExploreFeedV2Response = {
  items: UnifiedContentItem[];
  nextCursor?: string;
  hasMore: boolean;
};

function signalToKinds(signal: Signal): string[] | undefined {
  switch (signal) {
    case "news":
      return ["rss", "article", "news"];
    case "social":
      return ["social", "reddit"];
    case "podcast":
      return ["podcast"];
    case "video":
      return ["video", "youtube"];
    case "music":
      return ["music", "spotify", "listen"];
    case "watch":
      // IMPORTANT: Keep Watch as REAL movies/TV (TMDB), not generic video
      return ["watch"];
    case "read":
      // Books (Open Library / Google Books) + articles if you want
      return ["read"];
    case "creator":
      return ["creator"];
    default:
      return undefined;
  }
}

function signalToProviders(signal: Signal): string[] | undefined {
  switch (signal) {
    case "watch":
      return ["tmdb"];
    case "read":
      return ["open_library", "google_books"];
    default:
      return undefined;
  }
}

interface StudioExploreProps {
  hideNav?: boolean;
}

export default function StudioExplore({ hideNav = false }: StudioExploreProps = {}) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { session } = useSession();

  const [activeSignal, setActiveSignal] = useState<Signal>("all");
  const [items, setItems] = useState<UnifiedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [echoInputs, setEchoInputs] = useState<Record<string, string>>({});
  const [echoingId, setEchoingId] = useState<string | null>(null);
  const [openEchoInputs, setOpenEchoInputs] = useState<Record<string, boolean>>({});

  const isDev = import.meta.env.DEV;

  function cleanExploreItems(rawItems: UnifiedContentItem[]): UnifiedContentItem[] {
    // Only filter out "starter pack / pack" items.
    // Allow items without images - they will show a placeholder.
    return rawItems.filter((it) => {
      const title = (toText(it.title) || "").trim();
      const isPack = /pack|starter/i.test(title);
      return !isPack;
    });
  }

  async function loadExploreItems() {
    setLoading(true);
    setError(null);

    try {
      // When "All" is selected, don't filter by kinds or providers - show everything
      const kinds = activeSignal === "all" ? undefined : signalToKinds(activeSignal);
      const providers = activeSignal === "all" ? undefined : signalToProviders(activeSignal);

      const requestPayload: any = {
        limit: 48,
        ...(kinds ? { kinds } : {}),
        ...(providers ? { providers } : {}),
      };

      // Debug logging: Request payload
      console.log("[StudioExplore] Request payload:", {
        function: "explore_feed_v2",
        body: requestPayload,
        timestamp: new Date().toISOString(),
      });

      const { data, error } = await supabase.functions.invoke<ExploreFeedV2Response>("explore_feed_v2", {
        body: requestPayload,
      });

      // Debug logging: HTTP status (from error object if present)
      const errorStatus = (error as any)?.status || (error as any)?.statusCode;
      console.log("[StudioExplore] HTTP status:", error ? errorStatus || "error" : "200 OK");

      if (error) {
        // Debug logging: Error response
        const errStatus = (error as any)?.status || (error as any)?.statusCode;
        console.error("[StudioExplore] Error response:", {
          error,
          message: error.message,
          status: errStatus,
          statusCode: errStatus,
          context: (error as any)?.context,
          name: (error as any)?.name,
          fullError: JSON.stringify(error, null, 2),
        });

        const msg = error.message || "";

        const isDeploymentError =
          errStatus === 404 ||
          (errStatus === 401 &&
            (msg.includes("Missing authorization") ||
              msg.includes("Function not found") ||
              msg.includes("not found"))) ||
          (msg &&
            (msg.includes("Failed to send") ||
              msg.includes("Edge Function") ||
              msg.includes("not found") ||
              msg.includes("Function not found")));

        if (isDeploymentError) {
          throw new Error("Edge Function not deployed. Deploy using: supabase functions deploy explore_feed_v2");
        }

        throw new Error(msg || `Failed to load Explore (status: ${errStatus || "unknown"})`);
      }

      // Debug logging: Success response
      console.log("[StudioExplore] Success response:", {
        itemCount: data?.items?.length || 0,
        hasMore: data?.hasMore || false,
        nextCursor: data?.nextCursor || null,
      });

      // Temporary debug: Count by kind
      if (data?.items) {
        const kindCounts: Record<string, number> = {};
        data.items.forEach((item: any) => {
          const kind = (item.kind || "unknown").toLowerCase();
          kindCounts[kind] = (kindCounts[kind] || 0) + 1;
        });
        console.log("[StudioExplore] Items by kind:", kindCounts);
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error("Invalid response from explore_feed_v2: expected items array");
      }

      // Apply your “real content” rules here
      const cleaned = cleanExploreItems(data.items);

      if (cleaned.length === 0) {
        setItems([]);
        setError({
          message: `No items found for ${activeSignal === "all" ? "all content" : activeSignal}. Try a different filter or refresh.`,
        } as FetchError);
        return;
      }

      setItems(cleaned);
    } catch (e: any) {
      console.error("[StudioExplore] Exception:", e);
      setItems([]);
      setError({
        message: e?.message || "Failed to load Explore",
      } as FetchError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExploreItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSignal]);

  // Load saved IDs on mount
  useEffect(() => {
    async function loadSaved() {
      try {
        const ids = await fetchSavedIds();
        setSavedIds(ids);
      } catch (e) {
        console.error("[StudioExplore] Failed to load saved IDs:", e);
      }
    }
    loadSaved();
  }, []);

  // Helper to get or create content_item ID from explore_feed_v2 item ID
  async function getContentItemId(exploreItemId: string, item: any): Promise<string | null> {
    // If it's already a UUID, return it
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exploreItemId)) {
      return exploreItemId;
    }

    // Handle prefixed IDs from explore_feed_v2
    let externalId: string | null = null;
    let provider: string | null = null;
    let kind: string | null = null;

    if (exploreItemId.startsWith("feed_items:")) {
      const feedId = exploreItemId.replace("feed_items:", "");
      // Try to find existing content_item by external_id
      const { data: existing } = await supabase
        .from("content_items")
        .select("id")
        .eq("external_id", feedId)
        .maybeSingle();
      if (existing) return existing.id;
      
      // Create new content_item from feed_item
      externalId = feedId;
      provider = item.provider || "rss";
      kind = item.kind || "rss";
    } else if (exploreItemId.startsWith("external_content_cache:")) {
      const cacheId = exploreItemId.replace("external_content_cache:", "");
      // Try to find existing content_item
      const { data: existing } = await supabase
        .from("content_items")
        .select("id")
        .eq("external_id", cacheId)
        .maybeSingle();
      if (existing) return existing.id;
      
      externalId = cacheId;
      provider = item.provider || "unknown";
      kind = item.kind || "watch";
    } else if (exploreItemId.startsWith("recommendation:")) {
      // Recommendations might not have external_id, use the recommendation ID
      const recId = exploreItemId.replace("recommendation:", "");
      const { data: existing } = await supabase
        .from("content_items")
        .select("id")
        .eq("external_id", recId)
        .maybeSingle();
      if (existing) return existing.id;
      
      externalId = recId;
      provider = item.provider || "recommendation";
      kind = item.kind || "watch";
    }

    // Create new content_item if we have the data
    if (externalId && kind) {
      const { data: newItem, error } = await supabase
        .from("content_items")
        .insert({
          external_id: externalId,
          kind: kind,
          title: item.title || "Untitled",
          byline: item.byline || null,
          url: item.url || null,
          image_url: item.image_url || null,
          source: provider,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[StudioExplore] Failed to create content_item:", error);
        return null;
      }
      return newItem.id;
    }

    return null;
  }

  async function handleToggleSave(itemId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (savingId === itemId) return;

    const isSaved = savedIds.includes(itemId);
    setSavingId(itemId);

    try {
      // Find the item data
      const item = cards.find((c) => c.id === itemId);
      if (!item) {
        throw new Error("Item not found");
      }

      // Get or create content_item ID
      const contentItemId = await getContentItemId(itemId, item);
      if (!contentItemId) {
        throw new Error("Could not create content item for saving");
      }

      if (isSaved) {
        await unsaveItem(contentItemId);
        setSavedIds((prev) => prev.filter((id) => id !== itemId));
          } else {
        await saveItem(contentItemId);
        setSavedIds((prev) => [...prev, itemId]);
      }
    } catch (error: any) {
      console.error("[StudioExplore] Save error:", error);
      alert(error?.message || "Failed to save item");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateEcho(itemId: string, note: string) {
    if (!note.trim() || echoingId === itemId) return;

    setEchoingId(itemId);
    try {
      await createEcho({
        contentId: itemId,
        note: note.trim(),
      });
      // Clear the input and close it
      setEchoInputs((prev) => ({ ...prev, [itemId]: "" }));
      setOpenEchoInputs((prev) => ({ ...prev, [itemId]: false }));
      // Optionally show success message
    } catch (error: any) {
      console.error("[StudioExplore] Echo error:", error);
      alert(error?.message || "Failed to create echo");
    } finally {
      setEchoingId(null);
    }
  }

  async function handleRefreshContent() {
    if (!isDev) return;

    setRefreshing(true);
    try {
      console.log("[StudioExplore] Calling cron_runner to refresh content...");
      const { data: cronData, error: cronError } = await supabase.functions.invoke("cron_runner", {
        body: {},
      });

      if (cronError) {
        console.error("[StudioExplore] cron_runner error:", cronError);
      } else {
        console.log("[StudioExplore] cron_runner success:", cronData);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await loadExploreItems();
    } catch (e: any) {
      console.error("[StudioExplore] Refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }

  // Helper to extract website name from RSS provider with proper capitalization
  function extractWebsiteName(provider: string, url?: string | null): string {
    if (url) {
      try {
        const hostname = new URL(url).hostname.replace("www.", "");
        const domain = hostname.split(".")[0];
        
        // Known website name mappings
        const knownSites: Record<string, string> = {
          "techcrunch": "TechCrunch",
          "theverge": "The Verge",
          "verge": "The Verge",
          "wired": "Wired",
          "arstechnica": "Ars Technica",
          "ars": "Ars Technica",
          "reuters": "Reuters",
          "bbc": "BBC",
          "cnn": "CNN",
          "nytimes": "The New York Times",
          "nytimes.com": "The New York Times",
          "theguardian": "The Guardian",
          "guardian": "The Guardian",
          "washingtonpost": "The Washington Post",
          "wsj": "The Wall Street Journal",
          "bloomberg": "Bloomberg",
          "forbes": "Forbes",
          "economist": "The Economist",
        };
        
        const lowerDomain = domain.toLowerCase();
        if (knownSites[lowerDomain]) {
          return knownSites[lowerDomain];
        }
        
        // Capitalize first letter of each word
        return domain
          .split(/[\s\-_]/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      } catch {
        // Fall through to provider name
      }
    }
    // Fallback: format provider name nicely
    const p = provider.toLowerCase();
    if (p.includes("techcrunch")) return "TechCrunch";
    if (p.includes("verge")) return "The Verge";
    if (p.includes("wired")) return "Wired";
    if (p.includes("ars")) return "Ars Technica";
    return provider
      .split(/[\s\-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Helper to get genre/type info for TMDB items
  function getMediaInfo(item: UnifiedContentItem): { genre?: string; type?: "Movie" | "TV" } {
    const raw = item.raw as any;
    if (!raw) return {};
    
    // Check if it's TV or Movie from raw data
    const mediaType = raw.media_type || raw.type || item.kind?.toLowerCase();
    const type = mediaType === "tv" || mediaType === "tv_series" ? "TV" : "Movie";
    
    // Extract genre from raw
    let genre: string | undefined;
    if (raw.genres && Array.isArray(raw.genres)) {
      const firstGenre = raw.genres[0];
      genre = typeof firstGenre === "string" ? firstGenre : firstGenre?.name;
    }
    
    return { genre, type };
  }

  // Helper to infer category from RSS content
  function inferCategory(title: string, summary: string, provider: string): string | null {
    const text = `${title} ${summary} ${provider}`.toLowerCase();
    
    // Tech categories
    if (/tech|technology|ai|artificial intelligence|machine learning|software|hardware|processor|computing|digital|code|programming|developer|startup|silicon/i.test(text)) {
      return "Tech";
    }
    // Science
    if (/science|research|study|discover|scientist|lab|experiment|physics|chemistry|biology|space|astronomy/i.test(text)) {
      return "Science";
    }
    // Business
    if (/business|finance|economy|market|stock|trading|company|corporate|startup|entrepreneur/i.test(text)) {
      return "Business";
    }
    // Design
    if (/design|art|creative|aesthetic|visual|graphic|ui|ux|interface|typography/i.test(text)) {
      return "Design";
    }
    // Culture
    if (/culture|society|social|people|community|lifestyle|trend|fashion/i.test(text)) {
      return "Culture";
    }
    // Politics
    if (/politics|political|government|policy|election|democrat|republican|congress|senate/i.test(text)) {
      return "Politics";
    }
    // Health
    if (/health|medical|medicine|wellness|fitness|diet|nutrition|doctor|hospital/i.test(text)) {
      return "Health";
    }
    // Sports
    if (/sport|football|basketball|baseball|soccer|tennis|olympic|athlete|game|match/i.test(text)) {
      return "Sports";
    }
    
    return null;
  }

  const cards = useMemo(() => {
    return items.map((it) => {
      const title = toText(it.title) || "Untitled";
      const byline = toText(it.byline) || "";
      // Handle summary - ensure it's a string, not an object
      let summary = "";
      if (it.summary) {
        if (typeof it.summary === "string") {
          summary = it.summary.trim();
        } else if (typeof it.summary === "object") {
          // If it's an object, try to extract text from common fields
          summary = toText((it.summary as any).text || (it.summary as any).content || (it.summary as any).description || "");
        } else {
          summary = String(it.summary).trim();
        }
      }
      const url = toText(it.url) || null;
      const image_url = toText(it.image_url) || null;
      const provider = formatProviderName(it.provider);
      const tags = normalizeTags(it.tags);
      const sig = inferSignal(toText(it.kind), it.provider) as Exclude<Signal, "all">;
      const kind = toText(it.kind || "").toLowerCase();
      const isRSS = kind === "rss" || kind === "atom" || kind === "article" || kind === "news";
      const isTMDB = it.provider?.toLowerCase().includes("tmdb") || kind === "watch";
      const isBook = kind === "read" || it.provider?.toLowerCase().includes("book");
      
      // Infer category for RSS items
      const category = isRSS ? inferCategory(title, summary, provider) : null;
      
      // Get website name for RSS
      const websiteName = isRSS ? extractWebsiteName(provider, url) : null;
      
      // Get media info for TMDB
      const mediaInfo = isTMDB ? getMediaInfo(it) : {};

      return {
        id: it.id,
        title,
        byline,
        summary,
        url,
        image_url,
        provider,
        tags,
        created_at: it.created_at,
        sig,
        kindLabel: toText(it.kind || "").toUpperCase() || "ITEM",
        isRSS,
        isTMDB,
        isBook,
        category,
        websiteName,
        mediaInfo,
        raw: it.raw,
      };
    });
  }, [items]);

  // Filter cards by signal (when not "all", filter by inferred signal)
  const filtered = useMemo(() => {
    if (activeSignal === "all") return cards;
    return cards.filter((c) => c.sig === activeSignal);
  }, [cards, activeSignal]);

  function getFilterIcon(signal: Signal): string {
    const filter = SIGNALS.find((s) => s.key === signal);
    if (!filter) return "✨";
    switch (signal) {
      case "all":
        return "✨";
      case "news":
        return "📰";
      case "social":
        return "💬";
      case "podcast":
        return "🎧";
      case "video":
        return "🎬";
      case "music":
        return "🎵";
      case "watch":
        return "📺";
      case "read":
        return "📚";
      case "creator":
        return "👤";
      default:
        return "✨";
    }
  }

  function getFilterLabel(signal: Signal): string {
    const filter = SIGNALS.find((s) => s.key === signal);
    return filter?.label || "All";
  }

  return (
    <div className="studio-page" data-theme="light" style={hideNav ? { paddingTop: 0 } : {}}>
      {!hideNav && (
      <nav className="studio-nav">
        <div className="studio-nav__inner">
            <button className="studio-nav__brand" onClick={() => navigate("/studio")} type="button">
            <span className="studio-nav__brand-icon">K</span>
              KIVAW
          </button>

          <div className="studio-nav__links">
              <button className="studio-nav__link" onClick={() => navigate("/studio")} type="button">
              Home
            </button>
              <button
                className="studio-nav__link studio-nav__link--active"
                onClick={() => navigate("/studio/explore")}
                type="button"
              >
                Explore
            </button>
              <button className="studio-nav__link" onClick={() => navigate("/studio/feed")} type="button">
              Feed
            </button>
              <button className="studio-nav__link" onClick={() => navigate("/timeline")} type="button">
                Timeline
            </button>
          </div>

          <div className="studio-nav__actions">
              <button className="studio-nav__link-text" type="button">
                How it works
                </button>
              {session && (
            <button 
                  onClick={() => navigate("/profile")}
                  type="button"
                  aria-label="Profile"
                  title="Profile"
              style={{ 
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "1px solid var(--studio-border)",
                    background: "var(--studio-white)",
                color: "var(--studio-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                fontSize: "14px",
                fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
              }}
            >
                  {session.user?.email?.charAt(0).toUpperCase() || "?"}
            </button>
              )}
              <button className="studio-btn studio-btn--primary" onClick={() => navigate("/studio/feed")} type="button">
                Go to Feed
            </button>
              <button className="studio-theme-toggle" onClick={toggle} aria-label="Toggle theme" type="button">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>
      )}

      <section className="studio-section">
        <div className="explore-header">
          <div>
            <h2 className="explore-title">Explore</h2>
            <p className="explore-subtitle">Movies, books, news, and more · curated recommendations</p>
          </div>
          <div className="explore-actions">
            <span className="explore-count">{loading ? "Loading…" : `${filtered.length} items`}</span>
            {isDev && (
                <button
                className="btn-filter"
                onClick={handleRefreshContent}
                disabled={refreshing}
                type="button"
                style={{ marginRight: "8px" }}
                title="DEV ONLY: Refresh content via cron_runner"
              >
                {refreshing ? "Refreshing…" : "🔄 Refresh Content"}
                </button>
            )}
            <button className="btn-filter" onClick={() => setFilterDrawerOpen(true)} type="button">
              <span>🔍</span> Filters
              {activeSignal !== "all" && <span className="filter-badge">1</span>}
            </button>
            </div>
          </div>

        {activeSignal !== "all" && (
          <div className="active-filter-display">
            <span className="active-filter-chip">
              {getFilterIcon(activeSignal)} {getFilterLabel(activeSignal)}
              <button className="chip-remove" onClick={() => setActiveSignal("all")} type="button">
                ×
              </button>
            </span>
          </div>
        )}

        <FilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          activeFilter={activeSignal}
          onFilterChange={setActiveSignal}
        />

        {(error || (!loading && items.length === 0)) && (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              background: "var(--studio-gray-50)",
              border: "1px solid var(--studio-border)",
              borderRadius: "var(--studio-radius-lg)",
              color: "var(--studio-text)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--studio-coral)", fontSize: "16px" }}>
              {error ? "⚠️ Explore Error" : "📭 No Content Found"}
              </div>
            <div style={{ marginBottom: 12, fontSize: "14px", lineHeight: "1.5" }}>
              {error?.message ||
                `No items found for ${activeSignal === "all" ? "all signals" : activeSignal}. Try a different filter or refresh.`}
          </div>

            {error?.message && error.message.includes("not deployed") && (
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--studio-text-muted)",
                  padding: 12,
                  background: "var(--studio-white)",
                  borderRadius: "var(--studio-radius)",
                  fontFamily: "monospace",
                  marginTop: 12,
                  border: "1px solid var(--studio-border)",
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600 }}>To fix this, deploy the Edge Function:</div>
                <div style={{ color: "var(--studio-text)" }}>supabase functions deploy explore_feed_v2</div>
            </div>
          )}

            <button 
              className="studio-btn studio-btn--primary"
              onClick={() => {
                setError(null);
                loadExploreItems();
              }}
              type="button"
              style={{ marginTop: 16 }}
              disabled={loading}
            >
              {loading ? "Loading…" : "Retry"}
              </button>
            </div>
          )}
      </section>

      <section className="studio-section">
        <div className="studio-grid studio-grid--2">
          {loading &&
            Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="studio-skeleton"
                style={{ minHeight: "300px", background: "var(--studio-gray-100)", borderRadius: "var(--studio-radius-lg)" }}
              />
            ))}

          {!loading &&
            filtered.map((item) => (
              <article
                  key={item.id} 
                className={`studio-card ${item.isRSS ? "studio-card--rss" : ""}`}
                onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
                role="button"
                tabIndex={0}
              >
                {/* RSS items: text-only, compact card - NO image area */}
                {item.isRSS ? (
                  <div className="studio-card__body" style={{ padding: "16px", minHeight: "auto", position: "relative" }}>
                    <div className="studio-card__kicker" style={{ fontSize: "11px", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px", color: "var(--studio-text-muted)" }}>
                      <NewsIcon size={14} />
                  </div>
                    {/* Website name as title */}
                    <h3 className="studio-card__title" style={{ fontSize: "16px", marginBottom: "8px", lineHeight: 1.4, fontWeight: 600 }}>
                      {item.websiteName || item.provider}
                    </h3>
                    {/* Article title as description */}
                    {item.title && (
                      <p className="studio-card__desc" style={{ marginTop: "0", marginBottom: "12px", fontSize: "14px", lineHeight: 1.5, color: "var(--studio-text-secondary)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.title}
                      </p>
                    )}
                    {/* Show summary if available and different from title */}
                    {item.summary && item.summary.length > 0 && !item.summary.includes("[object") && item.summary !== item.title ? (
                      <p className="studio-card__desc" style={{ marginTop: "0", marginBottom: "12px", fontSize: "13px", lineHeight: 1.5, color: "var(--studio-text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.summary}
                      </p>
                    ) : null}
                    {/* Category tag for RSS */}
                    {item.category && (
                      <div className="studio-card__tags" style={{ marginBottom: "12px" }}>
                        <span className="studio-tag">{item.category}</span>
                    </div>
                    )}

                    {/* Echo text input - only show when speech bubble is clicked */}
                    {openEchoInputs[item.id] && (
                      <div style={{ marginBottom: "12px" }}>
                        <input
                          type="text"
                          placeholder="Add to journal..."
                          value={echoInputs[item.id] || ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            setEchoInputs((prev) => ({ ...prev, [item.id]: e.target.value }));
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter" && echoInputs[item.id]?.trim()) {
                              handleCreateEcho(item.id, echoInputs[item.id]);
                              setOpenEchoInputs((prev) => ({ ...prev, [item.id]: false }));
                            }
                            if (e.key === "Escape") {
                              setOpenEchoInputs((prev) => ({ ...prev, [item.id]: false }));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "13px",
                            border: "1px solid var(--studio-border)",
                            borderRadius: "6px",
                            background: "var(--studio-white)",
                            color: "var(--studio-text)",
                            fontFamily: "inherit",
                          }}
                        />
            </div>
          )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                      <div className="studio-card__byline" style={{ fontSize: "12px", color: "var(--studio-text-muted)" }}>
                        <span>{formatShortDate(item.created_at)}</span>
              </div>
                      
                      {/* Action buttons: Speech bubble (echo) and Heart (save) - outline icons */}
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        {/* Speech bubble echo button - outline icon */}
                        <button
                          className="studio-card__action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenEchoInputs((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          type="button"
                          style={{
                            width: "auto",
                            height: "auto",
                            border: "none",
                            background: "transparent",
                            color: openEchoInputs[item.id] ? "var(--studio-coral)" : "var(--studio-text-muted)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "color 0.15s ease",
                            padding: "4px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--studio-text-secondary)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = openEchoInputs[item.id] ? "var(--studio-coral)" : "var(--studio-text-muted)";
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </button>
                        
                        {/* Heart save button - outline icon */}
                        <button
                          className="studio-card__action-btn"
                          onClick={(e) => handleToggleSave(item.id, e)}
                          type="button"
                          disabled={savingId === item.id}
                          style={{
                            width: "auto",
                            height: "auto",
                            border: "none",
                            background: "transparent",
                            color: savedIds.includes(item.id) ? "var(--studio-coral)" : "var(--studio-text-muted)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "color 0.15s ease",
                            padding: "4px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = savedIds.includes(item.id) ? "var(--studio-coral-dark)" : "var(--studio-text-secondary)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = savedIds.includes(item.id) ? "var(--studio-coral)" : "var(--studio-text-muted)";
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill={savedIds.includes(item.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                        </button>
                  </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Non-RSS items: show image or placeholder */}
                    {item.image_url ? (
                      <img className="studio-card__thumb" src={item.image_url} alt={item.title} loading="lazy" />
                    ) : (
                      <div className="studio-card__thumb studio-card__thumb--fallback">{item.title?.charAt(0) || "?"}</div>
                    )}

                    <div className="studio-card__body" style={{ position: "relative", padding: "16px", display: "flex", flexDirection: "column", minHeight: "180px" }}>
                      {/* Kicker with icon only (no source name for TMDB/books) */}
                      <div className="studio-card__kicker" style={{ fontSize: "11px", marginBottom: "10px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px", color: "var(--studio-text-muted)" }}>
                        {item.isTMDB ? <MovieIcon size={14} /> : item.isBook ? <BookIcon size={14} /> : item.kindLabel === "LISTEN" ? <MusicIcon size={14} /> : <SparkleIcon size={14} />}
                      </div>
                      
                      <h3 className="studio-card__title" style={{ fontSize: "18px", marginBottom: "8px", lineHeight: 1.4, fontWeight: 600 }}>
                        {item.title}
                      </h3>

                      {/* Genre tag for TMDB/books - show prominently like RSS category */}
                      {(item.mediaInfo?.genre || (item.isBook && item.tags.length > 0)) && (
                        <div className="studio-card__tags" style={{ marginBottom: "12px" }}>
                          {item.mediaInfo?.genre ? (
                            <span className="studio-tag">{item.mediaInfo.genre}</span>
                          ) : item.isBook && item.tags.length > 0 ? (
                            <span className="studio-tag">{item.tags[0]}</span>
                          ) : null}
            </div>
          )}

                      {/* Show summary/description for watch/read/listen items (2 lines clamped) */}
                      {item.summary && item.summary.length > 0 && !item.summary.includes("[object") ? (
                        <p className="studio-card__desc" style={{ marginTop: "0", marginBottom: "12px", fontSize: "14px", lineHeight: 1.5, color: "var(--studio-text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {item.summary}
                        </p>
                      ) : null}

                      {item.byline ? (
                        <p className="studio-card__desc" style={{ marginTop: item.summary ? "0" : "0", marginBottom: "12px", fontSize: "13px", color: "var(--studio-text-secondary)" }}>
                          {item.byline}
                        </p>
                      ) : null}

                      {/* Echo text input - only show when speech bubble is clicked */}
                      {openEchoInputs[item.id] && (
                        <div style={{ marginBottom: "12px" }}>
                          <input
                            type="text"
                            placeholder="Add to journal..."
                            value={echoInputs[item.id] || ""}
                            onChange={(e) => {
                              e.stopPropagation();
                              setEchoInputs((prev) => ({ ...prev, [item.id]: e.target.value }));
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && echoInputs[item.id]?.trim()) {
                                handleCreateEcho(item.id, echoInputs[item.id]);
                                setOpenEchoInputs((prev) => ({ ...prev, [item.id]: false }));
                              }
                              if (e.key === "Escape") {
                                setOpenEchoInputs((prev) => ({ ...prev, [item.id]: false }));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            style={{
                  width: "100%", 
                              padding: "8px 12px",
                              fontSize: "13px",
                              border: "1px solid var(--studio-border)",
                              borderRadius: "6px",
                              background: "var(--studio-white)",
                              color: "var(--studio-text)",
                              fontFamily: "inherit",
                            }}
                          />
                </div>
          )}

                      {/* Bottom section with byline and action buttons */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "8px" }}>
                        <div className="studio-card__byline" style={{ fontSize: "12px", color: "var(--studio-text-muted)" }}>
                          <span>{formatShortDate(item.created_at)}</span>
              </div>

                        {/* Action buttons: Speech bubble (echo) and Heart (save) - outline icons */}
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          {/* Speech bubble echo button - outline icon */}
                          <button
                            className="studio-card__action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenEchoInputs((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                            }}
                            type="button"
                            style={{
                              width: "auto",
                              height: "auto",
                              border: "none",
                              background: "transparent",
                              color: openEchoInputs[item.id] ? "var(--studio-coral)" : "var(--studio-text-muted)",
                              cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                              justifyContent: "center",
                              transition: "color 0.15s ease",
                              padding: "4px",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "var(--studio-text-secondary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = openEchoInputs[item.id] ? "var(--studio-coral)" : "var(--studio-text-muted)";
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </button>
                          
                          {/* Heart save button - outline icon */}
                          <button
                            className="studio-card__action-btn"
                            onClick={(e) => handleToggleSave(item.id, e)}
                            type="button"
                            disabled={savingId === item.id}
                            style={{
                              width: "auto",
                              height: "auto",
                              border: "none",
                              background: "transparent",
                              color: savedIds.includes(item.id) ? "var(--studio-coral)" : "var(--studio-text-muted)",
                              cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                justifyContent: "center",
                              transition: "color 0.15s ease",
                              padding: "4px",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = savedIds.includes(item.id) ? "var(--studio-coral-dark)" : "var(--studio-text-secondary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = savedIds.includes(item.id) ? "var(--studio-coral)" : "var(--studio-text-muted)";
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill={savedIds.includes(item.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                          </button>
                </div>
              </div>
                </div>
                  </>
                )}
              </article>
              ))}
              </div>

        {!loading && filtered.length === 0 && !error && (
          <div style={{ marginTop: 18, opacity: 0.75 }}>
            Nothing here yet for <b>{activeSignal}</b>. Try another signal.
            </div>
        )}
      </section>
    </div>
  );
}







