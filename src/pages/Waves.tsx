import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";

import { listWavesFeed } from "../data/wavesApi";
import type { WavesFeedItem } from "../data/wavesApi";

import { fetchSavedIds, saveItem, unsaveItem, getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/requireAuth";

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;

  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function kindEmoji(kind?: string | null) {
  const k = (kind || "").toLowerCase();
  if (k.includes("movement") || k.includes("walk") || k.includes("exercise")) return "🚶";
  if (k.includes("music") || k.includes("sound") || k.includes("playlist")) return "🎵";
  if (k.includes("logic")) return "🧠";
  if (k.includes("visual") || k.includes("aesthetic") || k.includes("art")) return "🎨";
  if (k.includes("prompt") || k.includes("reflection")) return "📝";
  if (k.includes("faith")) return "🙏";
  return "🌊";
}

// ✅ null-safe for ContentItem fields (meta is often string | null)
function isInternalDiscoverableItem(item: {
  title?: string | null;
  meta?: string | null;
  kind?: string | null;
}) {
  const title = (item.title || "").toLowerCase().trim();
  const meta = (item.meta || "").toLowerCase().trim();
  const kind = (item.kind || "").toLowerCase().trim();

  if (title === "unlinked echo") return true;
  if (meta.includes("used when an echo is saved")) return true;
  if (kind.includes("system")) return true;

  return false;
}

export default function Waves() {
  const navigate = useNavigate();

  const [feed, setFeed] = useState<WavesFeedItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setLoading(true);

        const rows = await listWavesFeed(60);
        if (cancelled) return;

        const filtered = (rows || []).filter((r) => !isInternalDiscoverableItem(r.content));
        setFeed(filtered);

        const uid = await getUserId();
        if (cancelled) return;

        const authed = !!uid;
        setIsAuthed(authed);

        if (authed) {
          const saved = await fetchSavedIds();
          if (!cancelled) setSavedIds(saved || []);
        } else {
          setSavedIds([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load Waves.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleSave(contentId: string, isSaved: boolean) {
    const uid = await requireAuth(navigate, "/waves");
    if (!uid) return;

    if (busyId) return;
    setBusyId(contentId);

    // optimistic UI
    setSavedIds((prev) => {
      const set = new Set(prev);
      if (isSaved) set.delete(contentId);
      else set.add(contentId);
      return Array.from(set);
    });

    try {
      if (isSaved) await unsaveItem(contentId);
      else await saveItem(contentId);

      const updated = await fetchSavedIds();
      setSavedIds(updated || []);
    } catch {
      // rollback to server truth
      try {
        const updated = await fetchSavedIds();
        setSavedIds(updated || []);
      } catch {}
    } finally {
      setBusyId(null);
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
              <button className="btn" onClick={() => navigate("/explore")} type="button">
                Browse everything →
              </button>
            </div>
          ) : !hasItems ? (
            <div>
              <p className="muted">Nothing is trending yet.</p>
              <div className="spacer-16" />
              <button className="btn" onClick={() => navigate("/explore")} type="button">
                Browse everything →
              </button>
            </div>
          ) : (
            <div className="kivaw-rec-grid">
              {!isAuthed ? (
                <div style={{ marginBottom: 12 }}>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    Want to save items? Sign in to heart them.
                  </p>
                  <button className="btn btn-ghost" onClick={() => navigate("/auth?returnTo=/waves")} type="button">
                    Sign in →
                  </button>
                </div>
              ) : null}

              {feed.map((row) => {
                const item = row.content;
                const isSaved = savedIds.includes(item.id);
                const isBusy = busyId === item.id;

                const emoji = kindEmoji(item.kind);
                const img = item.image_url || null;

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
                    <div className="kivaw-rowCard">
                      {/* squircle thumbnail */}
                      <div className="kivaw-thumb" aria-hidden="true">
                        <div className="kivaw-thumb__emoji">{emoji}</div>
                        {img ? (
                          <img
                            className="kivaw-thumb__img"
                            src={img}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="kivaw-rowCard__content">
                        <div className="kivaw-rowCard__top">
                          <div className="kivaw-rowCard__meta">
                            <span className="kivaw-meta-pill">{item.kind || "Item"}</span>
                            <span className="kivaw-meta-dot">•</span>

                            <span className="kivaw-meta-strong">{row.uses}</span>
                            <span className="kivaw-meta-soft">uses</span>

                            <span className="kivaw-meta-dot">•</span>
                            <span className="kivaw-meta-soft">last used {timeAgo(row.last_used_at)} ago</span>
                          </div>

                          <button
                            className="kivaw-heart"
                            type="button"
                            aria-label={isSaved ? "Unsave" : "Save"}
                            disabled={isBusy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation(); // ✅ prevents card click navigating away
                              toggleSave(item.id, isSaved);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === " " || e.key === "Enter") e.preventDefault();
                            }}
                          >
                            {isBusy ? "…" : isSaved ? "♥" : "♡"}
                          </button>
                        </div>

                        <div className="kivaw-rowCard__title">{item.title}</div>

                        {row.usage_tag ? (
                          <div style={{ marginTop: 10 }}>
                            <span className="tag">{row.usage_tag}</span>
                          </div>
                        ) : null}
                      </div>
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



















