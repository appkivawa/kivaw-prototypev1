// src/pages/StudioExplore.tsx
// Studio Explore — editorial grid + signal filters (WORKING)
// Uses explore_feed_v2 Edge Function (same as ExplorePage.tsx)

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { useSession } from "../auth/useSession";
import { supabase } from "../lib/supabaseClient";
import "../styles/studio.css";
import { formatProviderName, formatShortDate, normalizeTags, toText, inferSignal } from "../ui/studioNormalize";

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
  url: any;
  provider: string;
  tags: any[];
  created_at: string;
  score?: number | null;
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
      // Movies from TMDB have kind='watch' and provider='tmdb'
      // Also include general video content
      return ["watch", "video", "youtube"];
    case "read":
      // Books from Open Library/Google Books have kind='read' and provider='open_library' or 'google_books'
      // Also include articles and RSS
      return ["read", "article", "rss"];
    case "creator":
      return ["creator"];
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
    setLoading(true);
      setErrorMsg(null);

      try {
        const kinds = activeSignal === "all" ? undefined : signalToKinds(activeSignal);

        const { data, error } = await supabase.functions.invoke<ExploreFeedV2Response>("explore_feed_v2", {
          body: {
            limit: 48, // Increased to show more content
            ...(kinds ? { kinds } : {}),
          },
        });

        if (error) {
          // Log the full error object for debugging
          console.error("explore_feed_v2 error:", {
            error,
            message: error.message,
            status: (error as any)?.status,
            statusCode: (error as any)?.statusCode,
            context: (error as any)?.context,
            name: (error as any)?.name,
          });
          
          // Check if it's a deployment/connection error
          const errorMsg = error.message || "";
          const errorStatus = (error as any)?.status || (error as any)?.statusCode;
          
          // 401 from Supabase gateway usually means function not found/not deployed
          // But also check for specific error messages
          const isDeploymentError = 
            errorStatus === 404 ||
            (errorStatus === 401 && (
              errorMsg.includes("Missing authorization") ||
              errorMsg.includes("Function not found") ||
              errorMsg.includes("not found")
            )) ||
            (errorMsg && (
              errorMsg.includes("Failed to send") || 
              errorMsg.includes("Edge Function") || 
              errorMsg.includes("not found") ||
              errorMsg.includes("Function not found")
            ));
            
          if (isDeploymentError) {
            throw new Error("Edge Function not deployed. Deploy using: supabase functions deploy explore_feed_v2");
          }
          
          // For other errors, show the actual error message
          throw new Error(errorMsg || `Failed to load Explore (status: ${errorStatus || "unknown"})`);
        }
        if (!data || !Array.isArray(data.items)) throw new Error("Invalid response from explore_feed_v2");

        if (!cancelled) setItems(data.items);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setItems([]);
          setErrorMsg(e?.message || "Failed to load Explore");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeSignal]);

  const cards = useMemo(() => {
    return items.map((it) => {
      const title = toText(it.title) || "Untitled";
      const byline = toText(it.byline) || "";
      const url = toText(it.url) || null;
      const image_url = toText(it.image_url) || null;
      const provider = formatProviderName(it.provider);
      const tags = normalizeTags(it.tags);
      const sig = inferSignal(toText(it.kind), it.provider) as Exclude<Signal, "all">;

        return {
        id: it.id,
        title,
        byline,
        url,
        image_url,
        provider,
        tags,
        created_at: it.created_at,
        sig,
        kindLabel: toText(it.kind || "").toUpperCase() || "ITEM",
        };
      });
  }, [items]);

  const filtered = useMemo(() => {
    if (activeSignal === "all") return cards;
    return cards.filter((c) => c.sig === activeSignal);
  }, [cards, activeSignal]);

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
              <button className="studio-nav__link studio-nav__link--active" onClick={() => navigate("/studio/explore")} type="button">
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
        <div className="studio-section__header">
          <div>
            <h1 className="studio-section__title">Explore</h1>
            <div className="studio-section__meta">Movies, books, news, and more · curated recommendations</div>
          </div>
          <div className="studio-section__meta">{loading ? "Loading…" : `${filtered.length} items`}</div>
        </div>

        <div className="studio-pillbar">
          {SIGNALS.map((s) => (
            <button 
              key={s.key}
              className={`studio-pill ${activeSignal === s.key ? "studio-pill--active" : ""}`}
              onClick={() => setActiveSignal(s.key)}
              type="button"
            >
              {s.label}
            </button>
          ))}
      </div>

        {errorMsg && (
          <div style={{ 
            marginTop: 24, 
            padding: 20,
            background: "var(--studio-gray-50)",
            border: "1px solid var(--studio-border)",
            borderRadius: "var(--studio-radius-lg)",
            color: "var(--studio-text)"
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--studio-coral)", fontSize: "16px" }}>⚠️ Explore Error</div>
            <div style={{ marginBottom: 12, fontSize: "14px", lineHeight: "1.5" }}>{errorMsg}</div>
            {errorMsg.includes("not deployed") && (
              <div style={{ 
                fontSize: "13px", 
                color: "var(--studio-text-muted)",
                padding: 12,
                background: "var(--studio-white)",
                borderRadius: "var(--studio-radius)",
                fontFamily: "monospace",
                marginTop: 12,
                border: "1px solid var(--studio-border)"
              }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>To fix this, deploy the Edge Function:</div>
                <div style={{ color: "var(--studio-text)" }}>supabase functions deploy explore_feed_v2</div>
              </div>
            )}
            <button 
              className="studio-btn studio-btn--primary" 
              onClick={() => {
                setErrorMsg(null);
                window.location.reload();
              }} 
              type="button"
              style={{ marginTop: 16 }}
            >
              Retry
            </button>
            </div>
          )}
      </section>

      <section className="studio-section">
        <div className="studio-grid studio-grid--2">
          {loading &&
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="studio-skeleton" style={{ minHeight: "300px", background: "var(--studio-gray-100)", borderRadius: "var(--studio-radius-lg)" }} />
            ))}

          {!loading &&
            filtered.map((item) => (
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

                <div className="studio-card__body">
                  <div className="studio-card__kicker">{`${item.kindLabel} · ${item.provider}`}</div>
                  <h3 className="studio-card__title">{item.title}</h3>

                  {item.byline ? <p className="studio-card__desc">{item.byline}</p> : null}

                  {item.tags.length > 0 ? (
                    <div className="studio-card__tags">
                      {item.tags.slice(0, 3).map((t) => (
                        <span key={t} className="studio-tag">
                          {t}
                  </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="studio-card__byline">
                    <span>{item.provider}</span>
                    <span>{formatShortDate(item.created_at)}</span>
                  </div>
                </div>
              </article>
              ))}
            </div>

        {!loading && filtered.length === 0 && !errorMsg && (
          <div style={{ marginTop: 18, opacity: 0.75 }}>
            Nothing here yet for <b>{activeSignal}</b>. Try another signal.
          </div>
        )}
      </section>
    </div>
  );
}






