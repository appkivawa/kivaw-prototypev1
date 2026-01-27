import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import FeedPostTumblr from "../feed/FeedPostTumblr";
import FeedPostSkeleton from "../feed/FeedPostSkeleton";
import StarterPacks, { type StarterPack } from "./StarterPacks";
import { getBadge } from "../../utils/badgeHelpers";

type FeedItem = {
  id: string;
  source: "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";
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

type TimelineEmptyStateProps = {
  viewMode: "echo" | "saved";
};

export default function TimelineEmptyState({ viewMode }: TimelineEmptyStateProps) {
  const navigate = useNavigate();
  const [curatedItems, setCuratedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCurated() {
      try {
        setLoading(true);
        
        // Get Fresh and Trending sections from social_feed
        let token: string | null = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          token = sessionData.session?.access_token || null;
        } catch {
          token = null;
        }

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const { data, error } = await supabase.functions.invoke<{
          feed: FeedItem[];
          fresh?: FeedItem[];
          today?: FeedItem[];
        }>("social_feed", {
          method: "POST",
          headers,
          body: { limit: 20 },
        });

        if (error) {
          console.error("[TimelineEmptyState] Error loading curated:", error);
          setCuratedItems([]);
          return;
        }

        // Combine Fresh and Today sections, prefer Fresh
        const items: FeedItem[] = [];
        const seenIds = new Set<string>();

        if (data?.fresh && data.fresh.length > 0) {
          for (const item of data.fresh.slice(0, 6)) {
            if (!seenIds.has(item.id)) {
              items.push(item);
              seenIds.add(item.id);
            }
          }
        }

        if (data?.today && data.today.length > 0) {
          for (const item of data.today.slice(0, 4)) {
            if (!seenIds.has(item.id)) {
              items.push(item);
              seenIds.add(item.id);
            }
          }
        }

        // Fallback to main feed if no fresh/today
        if (items.length === 0 && data?.feed) {
          setCuratedItems(data.feed.slice(0, 10));
        } else {
          setCuratedItems(items);
        }
      } catch (e: any) {
        console.error("[TimelineEmptyState] Error:", e);
        setCuratedItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadCurated();
  }, []);

  function handlePackClick(pack: StarterPack) {
    const params = new URLSearchParams();
    if (pack.filters.categories) {
      params.set("categories", pack.filters.categories.join(","));
    }
    if (pack.filters.tags) {
      params.set("tags", pack.filters.tags.join(","));
    }
    if (pack.filters.sources) {
      params.set("sources", pack.filters.sources.join(","));
    }
    navigate(`/feed?${params.toString()}`);
  }

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--studio-text)",
            marginBottom: "8px",
          }}
        >
          Start here
        </h2>
        <p
          style={{
            fontSize: "15px",
            color: "var(--studio-text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {viewMode === "echo"
            ? "Echo something from Explore to start building your Timeline, or explore curated content below."
            : "Save items from Explore to see them here, or explore curated content below."}
        </p>
      </div>

      {/* Starter Packs */}
      <div style={{ marginBottom: "48px" }}>
        <StarterPacks onPackClick={handlePackClick} />
      </div>

      {/* Curated Content Sections */}
      <div>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--studio-text)",
            marginBottom: "20px",
          }}
        >
          Fresh & Trending
        </h3>

        {loading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <FeedPostSkeleton key={i} />
            ))}
          </div>
        ) : curatedItems.length > 0 ? (
          <div>
            {curatedItems.map((item, index) => {
              // Calculate badge for this item using all curated items
              const badge = getBadge(
                item.published_at,
                (item.metadata as any)?.ingested_at,
                item.score,
                curatedItems.map((i) => ({
                  score: i.score,
                  published_at: i.published_at,
                  ingested_at: (i.metadata as any)?.ingested_at,
                }))
              );
              return (
                <FeedPostTumblr
                  key={item.id}
                  item={item}
                  index={index}
                  allItems={curatedItems.map((i) => ({
                    score: i.score,
                    published_at: i.published_at,
                    ingested_at: (i.metadata as any)?.ingested_at,
                  }))}
                  badge={badge}
                />
              );
            })}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--studio-text-muted)",
            }}
          >
            <p style={{ fontSize: "14px" }}>No curated content available right now.</p>
            <button
              onClick={() => navigate("/studio/explore")}
              style={{
                marginTop: "16px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid var(--studio-border)",
                backgroundColor: "var(--studio-white)",
                color: "var(--studio-text)",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--studio-gray-50)";
                e.currentTarget.style.borderColor = "var(--studio-coral)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--studio-white)";
                e.currentTarget.style.borderColor = "var(--studio-border)";
              }}
            >
              Go to Explore
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

