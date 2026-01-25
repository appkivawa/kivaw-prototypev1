// src/pages/Timeline.tsx
// Timeline page with 3-column layout: Sidebar | Feed/Explore | Widgets

import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { fetchSavedIds } from "../data/savesApi";
import { inferSignal } from "../ui/studioNormalize";
import { normalizeItemType, itemTypeToChannel } from "../lib/itemTypes";
import { useNowPlaying } from "../hooks/useNowPlaying";
import StudioExplore from "./StudioExplore";
import StudioFeed from "./StudioFeed";
import TimelineSidebar, { type ChannelType, type CollectionType } from "../components/timeline/TimelineSidebar";
import TimelineWidgets from "../components/timeline/TimelineWidgets";
import "../styles/studio.css";

type ViewMode = "explore" | "feed";

interface SocialFeedItem {
  id: string;
  source: string;
  title: any;
  summary?: any;
  tags?: any;
  topics?: any;
  score?: number | null;
}

interface FeedItem {
  id: string;
  source: string;
  title: string;
  tags: string[];
  isSaved: boolean;
  score?: number | null;
}

function getStoredViewMode(location: { pathname: string }): ViewMode {
  if (location.pathname.includes("feed")) return "feed";
  if (location.pathname.includes("explore")) return "explore";
  try {
    const stored = localStorage.getItem("kivaw_timeline_view_v2");
    if (stored === "explore" || stored === "feed") return stored;
  } catch {
    // ignore
  }
  return "feed"; // default to My Feed
}

function setStoredViewMode(mode: ViewMode) {
  try {
    localStorage.setItem("kivaw_timeline_view_v2", mode);
  } catch {
    // ignore
  }
}

function getChannelFromItem(item: FeedItem): ChannelType {
  // Use normalized item type system
  const normalizedType = normalizeItemType({
    kind: null, // FeedItem doesn't have kind, infer from other fields
    source: item.source,
    title: item.title,
    tags: item.tags,
  });
  
  return itemTypeToChannel(normalizedType);
}

export default function Timeline() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode(location));
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [activeCollection, setActiveCollection] = useState<CollectionType | null>(null);
  
  const [allFeedItems, setAllFeedItems] = useState<FeedItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const nowPlaying = useNowPlaying();

  // Load feed data and saved items
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        // Load saved items
        const saved = await fetchSavedIds();
        setSavedIds(new Set(saved));

        // Load feed data
        const { data: feedData, error } = await supabase.functions.invoke<{
          feed: SocialFeedItem[];
          fresh: SocialFeedItem[];
          today: SocialFeedItem[];
        }>("social_feed", {
          body: { limit: 200 },
        });

        if (error || !feedData) {
          setAllFeedItems([]);
          return;
        }

        const allItems = feedData.feed || [];
        const items: FeedItem[] = allItems.map((item) => ({
          id: String(item.id),
          source: item.source || "",
          title: String(item.title || ""),
          tags: [
            ...(Array.isArray(item.tags) ? item.tags : []),
            ...(Array.isArray(item.topics) ? item.topics : []),
          ].map(String),
          isSaved: saved.includes(String(item.id)),
          score: item.score ?? null,
        }));

        if (!cancelled) setAllFeedItems(items);
      } catch (e) {
        console.error("Error loading timeline data:", e);
        if (!cancelled) setAllFeedItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate channel counts
  const channelCounts = useMemo(() => {
    const counts: Record<ChannelType, number> = {
      all: allFeedItems.length,
      news: 0,
      social: 0,
      podcast: 0,
      music: 0,
      tv_movies: 0,
    };

    allFeedItems.forEach((item) => {
      const channel = getChannelFromItem(item);
      if (channel !== "all") {
        counts[channel]++;
      }
    });

    return [
      { key: "all" as ChannelType, label: "All Signals", count: counts.all },
      { key: "news" as ChannelType, label: "News", count: counts.news },
      { key: "social" as ChannelType, label: "Social", count: counts.social },
      { key: "podcast" as ChannelType, label: "Podcasts", count: counts.podcast },
      { key: "music" as ChannelType, label: "Music", count: counts.music },
      { key: "tv_movies" as ChannelType, label: "TV & Movies", count: counts.tv_movies },
    ];
  }, [allFeedItems]);

  // Calculate collection counts
  const collectionCounts = useMemo(() => {
    const readLater = allFeedItems.filter((item) => item.isSaved).length;
    // For favorites, we'd need a separate favorites table/flag - using saved as proxy for now
    const favorites = allFeedItems.filter((item) => item.isSaved).length;

    return [
      { key: "read_later" as CollectionType, label: "Read later", count: readLater },
      { key: "favorites" as CollectionType, label: "Favorites", count: favorites },
    ];
  }, [allFeedItems]);

  // Calculate signal score (average of item scores if available)
  const signalScore = useMemo(() => {
    const scores = allFeedItems
      .map((item) => item.score)
      .filter((score): score is number => score !== null && score !== undefined);
    
    if (scores.length === 0) return null;
    
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }, [allFeedItems]);

  // Get up next item (first unsaved item)
  const upNext = useMemo(() => {
    const next = allFeedItems.find((item) => !item.isSaved);
    if (!next) return null;

    const channel = getChannelFromItem(next);
    const typeMap: Record<ChannelType, string> = {
      all: "Item",
      news: "Article",
      social: "Post",
      podcast: "Episode",
      music: "Track",
      tv_movies: "Show",
    };

    return {
      title: next.title,
      type: typeMap[channel] || "Item",
      image_url: undefined, // Would need to fetch from feed data
    };
  }, [allFeedItems]);

  useEffect(() => {
    if (viewMode === "explore" && !location.pathname.includes("explore")) {
      navigate("/timeline/explore", { replace: true });
    } else if (viewMode === "feed" && !location.pathname.includes("feed")) {
      navigate("/timeline/feed", { replace: true });
    }
  }, [viewMode, location.pathname, navigate]);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setStoredViewMode(mode);
    if (mode === "explore") {
      navigate("/timeline/explore", { replace: true });
    } else {
      navigate("/timeline/feed", { replace: true });
    }
  }

  function handleChannelClick(channel: ChannelType) {
    if (channel === "all") {
      setActiveChannel(null);
    } else {
      setActiveChannel(channel);
      setActiveCollection(null); // Clear collection when channel is selected
    }
  }

  function handleCollectionClick(collection: CollectionType) {
    setActiveCollection(collection);
    setActiveChannel(null); // Clear channel when collection is selected
  }

  return (
    <div className="studio-page" data-theme="light">
      {/* Sticky header with tabs */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--studio-white)",
          borderBottom: "1px solid var(--studio-border)",
          paddingTop: "96px",
          paddingBottom: "24px",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto", paddingLeft: "24px", paddingRight: "24px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              marginBottom: "24px",
              color: "var(--studio-text)",
            }}
          >
            Timeline
          </h1>

          {/* Tab navigation */}
          <div className="studio-nav__links" style={{ marginBottom: "0" }}>
            <button
              type="button"
              onClick={() => handleViewModeChange("feed")}
              className={`studio-nav__link ${viewMode === "feed" ? "studio-nav__link--active" : ""}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            >
              My Feed
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("explore")}
              className={`studio-nav__link ${viewMode === "explore" ? "studio-nav__link--active" : ""}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* 3-column layout */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          paddingLeft: "24px",
          paddingRight: "24px",
          paddingTop: "32px",
          paddingBottom: "48px",
          display: "flex",
          gap: "32px",
        }}
      >
        {/* LEFT SIDEBAR */}
        <TimelineSidebar
          activeChannel={activeChannel}
          activeCollection={activeCollection}
          channels={channelCounts}
          collections={collectionCounts}
          onChannelClick={handleChannelClick}
          onCollectionClick={handleCollectionClick}
        />

        {/* CENTER - Feed/Explore Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {viewMode === "explore" ? (
            <StudioExplore hideNav={true} />
          ) : (
            <StudioFeed hideNav={true} />
          )}
        </main>

        {/* RIGHT SIDEBAR - Widgets */}
        <TimelineWidgets
          nowPlaying={nowPlaying ? { title: nowPlaying.title, artist: nowPlaying.artist, image_url: nowPlaying.image_url } : null}
          upNext={upNext}
          signalScore={signalScore}
        />
      </div>
    </div>
  );
}

