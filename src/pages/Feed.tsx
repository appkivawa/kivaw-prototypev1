// pages/feed.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Source = "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";

type FeedItem = {
  id: string;
  source: Source;
  url: string;
  title: string;
  summary?: string | null;
  author?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  score?: number;
};

type FeedResponse = { feed: FeedItem[]; debug?: Record<string, unknown> };

function cleanText(s?: string | null, max = 140) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const SOURCE_BADGE: Record<Source, string> = {
  rss: "📰",
  youtube: "▶",
  reddit: "👽",
  podcast: "🎧",
  eventbrite: "📅",
  spotify: "🎵",
};

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);

  const loadingRef = useRef(false);

  async function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErr("");

    try {
      // This tells you immediately if you’re authenticated.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not logged in. social_feed requires auth (401). Log in first.");
      }

      const { data, error } = await supabase.functions.invoke<FeedResponse>("social_feed", {
        body: { limit: 50 },
      });

      if (error) {
        // This is the important part: status + message
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

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Your Feed</h2>
          <div style={{ marginTop: 6, opacity: 0.72 }}>One scroll. Everything you care about.</div>
        </div>

        <button
          onClick={load}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(255,255,255,0.75)",
            cursor: "pointer",
            fontWeight: 950,
          }}
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,0,0,0.35)" }}>
          <b>Error:</b> {err}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            Open your console — I log the full invoke error object there.
          </div>
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 14, opacity: 0.7 }}>Loading…</div> : null}

      {!!debug && (
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
          Debug: {JSON.stringify(debug)}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it) => (
          <div
            key={it.id}
            style={{
              display: "grid",
              gridTemplateColumns: "88px 1fr",
              gap: 14,
              alignItems: "center",
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(255,255,255,0.75)",
              boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
              minHeight: 110,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 12,
                background: "rgba(0,0,0,0.06)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
              }}
            >
              {it.image_url ? (
                <img
                  src={it.image_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ fontSize: 28 }}>{SOURCE_BADGE[it.source]}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.6, marginBottom: 4 }}>
                {SOURCE_BADGE[it.source]} {it.source.toUpperCase()}
                {it.published_at ? ` • ${timeAgo(it.published_at)}` : ""}
                {typeof it.score === "number" ? ` • score ${it.score.toFixed(2)}` : ""}
              </div>

              <div style={{ fontSize: 15, fontWeight: 950, lineHeight: 1.3 }}>
                {cleanText(it.title, 90)}
              </div>

              {it.summary ? (
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.82, lineHeight: 1.45 }}>
                  {cleanText(it.summary, 140)}
                </div>
              ) : null}

              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.7,
                  textDecoration: "none",
                }}
              >
                Open ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



