import { useEffect, useState } from "react";
import PageLayout from "../ui/PageLayout";
import { listWaves, listWavesSummary } from "../data/echoApi";
import type { WaveRow, WaveSummaryRow } from "../data/echoApi";
import "./waves.css";

function timeAgo(iso: string) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function Waves() {
  const [mode, setMode] = useState<"trending" | "latest">("trending");

  const [trending, setTrending] = useState<WaveSummaryRow[]>([]);
  const [latest, setLatest] = useState<WaveRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadTrending() {
    const data = await listWavesSummary(40);
    setTrending(data);
  }

  async function loadLatest() {
    const data = await listWaves(60);
    setLatest(data);
  }

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      await Promise.all([loadTrending(), loadLatest()]);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Couldn’t load Waves right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTrending = mode === "trending";

  return (
    <PageLayout
      title="Waves"
      subtitle="A public pulse of how people are using things."
      pageClassName="kivaw-hero-page"
      rightSlot={
        <div className="pill-toggle" role="tablist" aria-label="Waves view">
          <button
            type="button"
            className={isTrending ? "is-active" : ""}
            onClick={() => setMode("trending")}
            aria-selected={isTrending}
          >
            Trending
          </button>
          <button
            type="button"
            className={!isTrending ? "is-active" : ""}
            onClick={() => setMode("latest")}
            aria-selected={!isTrending}
          >
            Latest
          </button>
        </div>
      }
    >
      {/* Home-style hero card wrapper (consistent feel) */}
      <div className="kivaw-hero-card">
        {loading ? (
          <p style={{ opacity: 0.75, margin: 0 }}>Loading…</p>
        ) : err ? (
          <p style={{ opacity: 0.75, margin: 0 }}>{err}</p>
        ) : isTrending ? (
          trending.length === 0 ? (
            <p style={{ opacity: 0.75, margin: 0 }}>
              No trends yet. Share a tag to start the tide.
            </p>
          ) : (
            <div className="waves-list">
              {trending.map((t) => {
                const title = t.content_items?.title || "Untitled";
                const img = t.content_items?.image_url || null;
                const kind = t.content_items?.kind || "";

                return (
                  <div key={t.usage_tag} className="trend-row">
                    {img ? (
                      <img className="wave-img" src={img} alt={title} />
                    ) : (
                      <div className="wave-img wave-img--empty" />
                    )}

                    <div className="wave-body">
                      <div className="trend-top">
                        <div className="wave-chip">#{t.usage_tag}</div>
                        <div className="trend-stats">
                          <span className="trend-uses">{t.uses} uses</span>
                          <span className="trend-dot">·</span>
                          <span className="trend-time">{timeAgo(t.last_used_at)}</span>
                        </div>
                      </div>

                      <div className="wave-title">{title}</div>
                      {kind ? (
                        <div className="wave-meta" style={{ opacity: 0.72 }}>
                          {kind}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : latest.length === 0 ? (
          <p style={{ opacity: 0.75, margin: 0 }}>No waves yet.</p>
        ) : (
          <div className="waves-list">
            {latest.map((w) => {
              const title = w.content_items?.title || "Untitled";
              const img = w.content_items?.image_url || null;
              const kind = w.content_items?.kind || "";

              return (
                <div key={w.id} className="wave-row">
                  {img ? (
                    <img className="wave-img" src={img} alt={title} />
                  ) : (
                    <div className="wave-img wave-img--empty" />
                  )}

                  <div className="wave-body">
                    <div className="wave-top">
                      <div className="wave-title">{title}</div>
                      <div className="wave-time">{timeAgo(w.created_at)}</div>
                    </div>

                    {kind ? (
                      <div className="wave-meta" style={{ opacity: 0.72 }}>
                        {kind}
                      </div>
                    ) : null}

                    <div className="wave-tags">
                      <span className="wave-chip">#{w.usage_tag}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}






