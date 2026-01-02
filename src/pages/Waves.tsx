import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { fetchSavedIds, saveItem, unsaveItem } from "../data/savesApi";
import { listWavesFeed } from "../data/wavesApi";
import type { WavesFeedItem } from "../data/wavesApi";

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function kindEmoji(kind?: string) {
  const k = (kind || "").toLowerCase();
  if (k.includes("playlist") || k.includes("album") || k.includes("song")) return "🎧";
  if (k.includes("reflection") || k.includes("prompt")) return "📝";
  if (k.includes("visual") || k.includes("art")) return "🎨";
  if (k.includes("movement") || k.includes("exercise")) return "🧘";
  if (k.includes("creative")) return "🌸";
  if (k.includes("expansive")) return "🌱";
  return "🌊";
}

export default function Waves() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<WavesFeedItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setError("");
        const [rows, saved] = await Promise.all([listWavesFeed(60), fetchSavedIds()]);
        setFeed(rows || []);
        setSavedIds(saved || []);
      } catch (e: any) {
        setError(e?.message || "Could not load Waves.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggleSave(contentId: string, isSaved: boolean) {
    try {
      if (isSaved) await unsaveItem(contentId);
      else await saveItem(contentId);

      const updated = await fetchSavedIds();
      setSavedIds(updated || []);
    } catch {
      // intentionally silent — don't make Waves feel fragile
    }
  }

  const hasItems = useMemo(() => feed.length > 0, [feed]);

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <h1>Waves</h1>
        <p>What’s working for others right now.</p>
      </div>

      <div className="center-wrap">
        <Card className="center card-pad">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : error ? (
            <div>
              <p className="muted">{error}</p>
              <div className="spacer-16" />
              <button className="btn" onClick={() => navigate("/explore")}>
                Browse everything →
              </button>
            </div>
          ) : !hasItems ? (
            <div>
              <p className="muted">Nothing is trending yet.</p>
              <div className="spacer-16" />
              <button className="btn" onClick={() => navigate("/explore")}>
                Browse everything →
              </button>
            </div>
          ) : (
            <div className="kivaw-rec-grid">
              {feed.map((row) => {
                const item = row.content;
                const isSaved = savedIds.includes(item.id);

                return (
                  <div
                    key={`${item.id}-${row.usage_tag}-${row.last_used_at}`}
                    className="kivaw-rec-card"
                    onClick={() => navigate(`/item/${item.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") navigate(`/item/${item.id}`);
                    }}
                  >
                    <div className="kivaw-rec-card__body">
                      <div className="kivaw-rec-card__top">
                        <div className="kivaw-rec-card__meta">
                          <span aria-hidden="true" style={{ marginRight: 8 }}>
                            {kindEmoji(item.kind)}
                          </span>
                          <span>{item.kind || "Item"}</span>
                          <span style={{ margin: "0 8px", opacity: 0.5 }}>•</span>
                          <span>{row.uses} uses</span>
                          <span style={{ margin: "0 8px", opacity: 0.5 }}>•</span>
                          <span>{timeAgo(row.last_used_at)}</span>
                        </div>

                        <button
                          className="kivaw-heart"
                          aria-label={isSaved ? "Unsave" : "Save"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(item.id, isSaved);
                          }}
                        >
                          {isSaved ? "♥" : "♡"}
                        </button>
                      </div>

                      <div className="kivaw-rec-card__title">{item.title}</div>

                      {item.byline ? (
                        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                          {item.byline}
                        </div>
                      ) : null}

                      {row.usage_tag ? (
                        <div style={{ marginTop: 10 }}>
                          <span className="tag">{row.usage_tag}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}








