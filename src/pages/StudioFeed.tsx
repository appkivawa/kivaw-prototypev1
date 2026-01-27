// src/pages/StudioFeed.tsx
// Studio Feed — cohesive + real data + consistent cards

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { saveItem, unsaveItem, fetchSavedIds } from "../data/savesApi";
import ErrorBoundary from "../ui/ErrorBoundary";
import "../styles/studio.css";

import { formatProviderName, formatShortDate, normalizeTags, toText } from "../ui/studioNormalize";
import { SparkleIcon, TVIcon, BookIcon, MusicIcon, NewsIcon, MovieIcon } from "../components/icons/ContentIcons";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";
import { invokeFunction, type FetchError } from "../lib/supabaseFetch";

interface SocialFeedItem {
  id: string;
  source: string;
  external_id?: string | null;
  url: any;
  title: any;
  summary?: any;
  author?: any;
  image_url?: any;
  published_at?: string | null;
  tags?: any;
  topics?: any;
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

type FocusKey = "all" | "watch" | "read" | "listen";

const FOCUS_MODES: { key: FocusKey; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <SparkleIcon size={16} /> },
  { key: "watch", label: "Watch", icon: <TVIcon size={16} /> },
  { key: "read", label: "Read", icon: <BookIcon size={16} /> },
  { key: "listen", label: "Listen", icon: <MusicIcon size={16} /> },
];

interface FeedItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  provider: string;
  tags: string[];
  published_at: string | null;
  isSaved: boolean;
  kindLabel: string; // "NEWS" etc
}

interface FeedSection {
  id: string;
  title: string;
  subtitle: string;
  items: FeedItem[];
}

function matchesFocus(item: FeedItem, focus: FocusKey) {
  if (focus === "all") return true;
  const hay = `${item.title} ${item.description ?? ""} ${item.tags.join(" ")} ${item.provider}`.toLowerCase();

  if (focus === "watch") return /watch|video|movie|tv|youtube|trailer|tmdb/.test(hay);
  if (focus === "read") return /read|book|article|newsletter|essay|open\s?library|google\s?books/.test(hay);
  if (focus === "listen") return /listen|podcast|music|spotify|audio/.test(hay);

  return true;
}

function getItemTimestamp(item: SocialFeedItem): string | null {
  const metaIngested = (item.metadata?.ingested_at as string | undefined) ?? null;
  return item.published_at ?? metaIngested ?? null;
}

interface StudioFeedProps {
  hideNav?: boolean;
}

export default function StudioFeed({ hideNav = false }: StudioFeedProps = {}) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [sections, setSections] = useState<FeedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<FocusKey>("all");

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [lastIngestion, setLastIngestion] = useState<Date | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/login", { state: { from: "/studio/feed" } });
        return;
      }
      setIsSignedIn(true);
      setUserEmail(data.session.user?.email || null);
    });
  }, [navigate]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const ids = await fetchSavedIds();
        setSavedIds(new Set(ids));
      } catch (e) {
        console.error("Error loading saved IDs:", e);
      }
    })();
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase
          .rpc("get_last_successful_ingestion", { job_name_param: "cron_runner" })
          .maybeSingle();
        if (!rpcErr && data?.finished_at) setLastIngestion(new Date(data.finished_at));
      } catch (e) {
        console.error("Error loading last ingestion:", e);
      }
    })();
  }, [isSignedIn]);

  function transformToFeedItem(item: SocialFeedItem): FeedItem {
    const id = String(item.id);
    const title = toText(item.title) || "Untitled";
    const description = toText(item.summary) || null;
    const url = toText(item.url) || null;
    const image_url = toText(item.image_url) || null;

    const tags = normalizeTags([
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.topics) ? item.topics : []),
    ]);

    const provider = formatProviderName(item.source);

    return {
      id,
      title,
      description,
      image_url,
      url,
      provider,
      tags,
      published_at: item.published_at ?? null,
      isSaved: savedIds.has(id),
      kindLabel: "NEWS",
    };
  }

  function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  async function loadContent() {
    setLoading(true);
    setError(null);

    try {
      const result = await invokeFunction<SocialFeedResponse>("social_feed", {
        limit: 200,
      });

      if (result.error) {
        setError(result.error);
        setSections([]);
        return;
      }

      if (!result.data) {
        setError({
          requestId: result.requestId,
          message: "No data returned from server.",
        });
        setSections([]);
        return;
      }

      // Check for function-level errors
      if (result.data.error) {
        setError({
          requestId: result.requestId,
          message: result.data.error || "Invalid response from social_feed",
          details: result.data.message,
        });
        setSections([]);
        return;
      }

      const feedData = result.data;

      const allItems = feedData.feed || [];
      const freshItems = feedData.fresh || [];
      const todayItems = feedData.today || [];

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

      const seenIds = new Set<string>();
      const built: FeedSection[] = [];

      const pushSection = (id: string, title: string, subtitle: string, items: SocialFeedItem[]) => {
        const mapped = items
          .map(transformToFeedItem)
          .filter((it) => matchesFocus(it, focus))
          .filter((it) => {
            if (seenIds.has(it.id)) return false;
            seenIds.add(it.id);
            return true;
          })
          .slice(0, 20);

        if (mapped.length) built.push({ id, title, subtitle, items: mapped });
      };

      if (freshItems.length) pushSection("fresh", "Fresh", "Last 6 hours", freshItems);
      if (todayItems.length) pushSection("today", "Today", "Last 24 hours", todayItems);

      const scoreMap = new Map<string, number>();
      for (const it of allItems) if (it.score != null) scoreMap.set(String(it.id), Number(it.score));

      const trending = allItems
        .filter((it) => {
          const id = String(it.id);
          if (seenIds.has(id)) return false;
          const ts = getItemTimestamp(it);
          if (!ts) return false;
          return ts >= fortyEightHoursAgo && ts < twentyFourHoursAgo;
        })
        .sort((a, b) => (scoreMap.get(String(b.id)) ?? 0) - (scoreMap.get(String(a.id)) ?? 0))
        .slice(0, 40);

      pushSection("trending", "Trending", "Last 48 hours", trending);

      setSections(built);
      setLastRefresh(new Date());
    } catch (e: any) {
      console.error("Error loading feed:", e);
      setError(e.message || "Failed to load feed");
      setSections([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSignedIn) return;
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, focus]);

  async function handleToggleSave(item: FeedItem, e: React.MouseEvent) {
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
          prev.map((s) => ({
            ...s,
            items: s.items.map((it) => (it.id === item.id ? { ...it, isSaved: false } : it)),
          }))
        );
      } else {
        await saveItem(item.id);
        setSavedIds((prev) => new Set([...prev, item.id]));
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            items: s.items.map((it) => (it.id === item.id ? { ...it, isSaved: true } : it)),
          }))
        );
      }
    } catch (err) {
      console.error(err);
      alert("Couldn't update saved right now.");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/studio");
  }

  const totalCount = useMemo(() => sections.reduce((sum, s) => sum + s.items.length, 0), [sections]);

  if (!isSignedIn) {
    return (
      <ErrorBoundary>
        <div className="studio-page" data-theme="light">
          <div className="studio-empty" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div>
              <div className="studio-empty__icon">⏳</div>
              <div className="studio-empty__title">Loading…</div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
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
                <button className="studio-nav__link" onClick={() => navigate("/studio/explore")} type="button">
                  Explore
                </button>
                <button className="studio-nav__link studio-nav__link--active" onClick={() => navigate("/studio/feed")} type="button">
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
                {isSignedIn && (
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
                    {userEmail?.charAt(0).toUpperCase() || "?"}
                  </button>
                )}
                <button className="studio-btn studio-btn--primary" onClick={handleSignOut} type="button">
                  Sign out
                </button>
                <button className="studio-theme-toggle" onClick={toggle} aria-label="Toggle theme" type="button">
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>
              </div>
            </div>
          </nav>
        )}

        <div className="feed-page">
          <header className="feed-header">
            <div className="feed-header-top">
              <div>
                <h2 className="feed-title">Your Feed</h2>
                <p className="feed-subtitle">Curated content based on your preferences</p>
                <span className="feed-meta">
                  {lastIngestion ? `Last updated ${formatTimeAgo(lastIngestion)}` : `Last loaded ${formatTimeAgo(lastRefresh)}`}
                  {totalCount > 0 && ` • ${totalCount} items`}
                </span>
              </div>
              <div className="feed-actions">
                <button className="studio-btn studio-btn--secondary" onClick={loadContent} type="button">
                  ↻ Refresh
                </button>
                <button className="studio-btn studio-btn--primary" onClick={() => navigate("/preferences")} type="button">
                  Edit preferences
                </button>
              </div>
            </div>
            
            {/* HORIZONTAL filter chips - replaces sidebar filters */}
            <div className="feed-filters">
              {FOCUS_MODES.map((m) => (
                <button
                  key={m.key}
                  className={`filter-chip ${focus === m.key ? "active" : ""}`}
                  onClick={() => setFocus(m.key)}
                  type="button"
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </header>

          <main className="feed-list-container">

            {loading && <LoadingState message="Loading your feed..." />}

            {error && (
              <ErrorState
                error={error}
                title="Failed to load feed"
                onRetry={loadContent}
                onGoHome={() => navigate("/studio")}
              />
            )}

            {!loading && !error && sections.length === 0 && (
              <EmptyState
                title="No feed items found"
                message="Your feed is empty. Try refreshing or adjusting your preferences."
                action={{
                  label: "Refresh",
                  onClick: loadContent,
                }}
              />
            )}

            {!loading && !error && sections.length > 0 && (
              <div className="feed-list">
                {sections.map((section) => (
                  <div key={section.id} style={{ marginBottom: 48 }}>
                    <div className="studio-section__header" style={{ marginBottom: 16 }}>
                      <h3 className="studio-section__title">{section.title}</h3>
                      <span className="studio-section__meta">
                        {section.subtitle} • {section.items.length} items
                      </span>
                    </div>

                    <div className="studio-grid studio-grid--2">
                      {section.items.map((item) => (
                        <article
                          key={item.id}
                          className="studio-card"
                          onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
                          role="button"
                          tabIndex={0}
                        >
                          {item.image_url ? (
                            <img className="studio-card__thumb" src={item.image_url} alt={item.title} loading="lazy" />
                          ) : (
                            <div className="studio-card__thumb studio-card__thumb--fallback">{item.title?.charAt(0) || "?"}</div>
                          )}

                          <div className="studio-card__body" style={{ position: "relative", padding: "16px", display: "flex", flexDirection: "column", minHeight: "180px" }}>
                            {/* Kicker with icon */}
                            <div className="studio-card__kicker" style={{ fontSize: "11px", marginBottom: "10px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px", color: "var(--studio-text-muted)" }}>
                              {item.kindLabel === "NEWS" ? <NewsIcon size={14} /> : item.kindLabel === "WATCH" ? <MovieIcon size={14} /> : item.kindLabel === "READ" ? <BookIcon size={14} /> : item.kindLabel === "LISTEN" ? <MusicIcon size={14} /> : <SparkleIcon size={14} />}
                              <span>{formatProviderName(item.provider)}</span>
                            </div>
                            
                            <h3 className="studio-card__title" style={{ fontSize: "18px", marginBottom: "8px", lineHeight: 1.4, fontWeight: 600 }}>
                              {item.title}
                            </h3>

                            {item.description ? (
                              <p className="studio-card__desc" style={{ marginTop: "0", marginBottom: "12px", fontSize: "14px", lineHeight: 1.5, color: "var(--studio-text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, lineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {item.description}
                              </p>
                            ) : null}

                            {item.tags.length > 0 ? (
                              <div className="studio-card__tags" style={{ marginBottom: "12px" }}>
                                {item.tags.slice(0, 2).map((t) => (
                                  <span key={t} className="studio-tag">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {/* Bottom section with byline and action button */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "8px" }}>
                              <div className="studio-card__byline" style={{ fontSize: "12px", color: "var(--studio-text-muted)" }}>
                                <span>{formatShortDate(item.published_at)}</span>
                              </div>

                              {/* Action button in bottom right */}
                              <button
                                className="studio-card__action-btn"
                                onClick={(e) => handleToggleSave(item, e)}
                                type="button"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  border: "none",
                                  background: item.isSaved ? "var(--studio-coral)" : "var(--studio-gray-100)",
                                  color: item.isSaved ? "white" : "var(--studio-text-secondary)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "16px",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (!item.isSaved) {
                                    e.currentTarget.style.background = "var(--studio-gray-200)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!item.isSaved) {
                                    e.currentTarget.style.background = "var(--studio-gray-100)";
                                  }
                                }}
                              >
                                {item.isSaved ? "✓" : item.kindLabel === "WATCH" ? "🔖" : "+"}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && sections.length === 0 && (
              <EmptyState
                title="Your feed is empty"
                message="We're still gathering content. Try Explore or update preferences."
                action={{
                  label: "Go to Explore",
                  onClick: () => navigate("/studio/explore"),
                }}
              />
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

