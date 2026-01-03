import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import { fetchSavedIds, unsaveItem, getUserId } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";

function kindEmoji(kind: string) {
  const k = (kind || "").toLowerCase();
  switch (k) {
    case "album":
    case "playlist":
      return "🎧";
    case "concert":
    case "event":
      return "🎟️";
    case "film":
    case "movie":
      return "🎬";
    case "book":
      return "📖";
    case "practice":
      return "🕯️";
    default:
      return "✦";
  }
}

function MediaCover({
  id,
  kind,
  image,
}: {
  id: string;
  kind: string;
  image?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const src = (image || "").trim();
  const showImg = src.length > 0 && !broken;

  return (
    <div className="kivaw-cover">
      {showImg ? (
        <img
          key={id}
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="kivaw-cover__img"
        />
      ) : (
        <div className="kivaw-cover__emoji">{kindEmoji(kind)}</div>
      )}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  // simple inline heart (no dependency)
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block" }}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.8 4.6c-1.6-1.6-4.1-1.6-5.7 0L12 7.7 8.9 4.6c-1.6-1.6-4.1-1.6-5.7 0s-1.6 4.1 0 5.7L12 21.1l8.8-10.8c1.6-1.6 1.6-4.1 0-5.7z" />
    </svg>
  );
}

export default function Saved() {
  const navigate = useNavigate();

  const [isAuthed, setIsAuthed] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const uid = await getUserId();
        if (cancelled) return;
        setIsAuthed(!!uid);

        if (!uid) {
          setIds([]);
          setItems([]);
          return;
        }

        const saved = await fetchSavedIds();
        if (cancelled) return;
        setIds(saved);

        if (saved.length === 0) {
          setItems([]);
          return;
        }

        const { data, error } = await supabase
          .from("content_items")
          .select(
            "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
          )
          .in("id", saved);

        if (error) throw error;

        const index = new Map<string, number>();
        saved.forEach((x, i) => index.set(x, i));

        const sorted = (data || []).sort((a: any, b: any) => {
          return (index.get(a.id) ?? 9999) - (index.get(b.id) ?? 9999);
        });

        if (!cancelled) setItems(sorted as ContentItem[]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErrorMsg("Couldn’t load saved items right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function removeSaved(contentId: string) {
    if (!isAuthed) return;
    if (busyId) return;

    setBusyId(contentId);
    try {
      await unsaveItem(contentId);
      setIds((prev) => prev.filter((x) => x !== contentId));
      setItems((prev) => prev.filter((x) => x.id !== contentId));
    } catch (e) {
      console.error(e);
      alert("Couldn’t update saved right now.");
    } finally {
      setBusyId(null);
    }
  }

  function openItem(id: string) {
    navigate(`/item/${id}`);
  }

  function onCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openItem(id);
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <h1 className="h1">Saved</h1>
          <p className="kivaw-sub">Your saved items live here.</p>

          <div style={{ marginTop: 16, width: "100%" }}>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : errorMsg ? (
              <p className="muted">{errorMsg}</p>
            ) : !isAuthed ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="muted">Sign in to view (and save) your items.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate("/auth")}
                >
                  Sign in
                </button>
              </div>
            ) : ids.length === 0 ? (
              <p className="muted">Nothing saved yet. Go heart a few items.</p>
            ) : items.length === 0 ? (
              <p className="muted">
                Saved items exist, but nothing matched in the database.
              </p>
            ) : (
              <div className="kivaw-rec-grid" style={{ marginTop: 10 }}>
                {items.map((r) => {
                  const isBusy = busyId === r.id;

                  return (
                    <div
                      className="kivaw-rec-card kivaw-rec-row"
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openItem(r.id)}
                      onKeyDown={(e) => onCardKeyDown(e, r.id)}
                      aria-label={`Open ${r.title}`}
                    >
                      <MediaCover
                        id={r.id}
                        kind={r.kind || "Other"}
                        image={r.image_url ?? null}
                      />

                      <div className="kivaw-rec-info">
                        <div className="kivaw-rec-meta">
                          {r.kind || "Other"} <span className="dot">•</span>{" "}
                          {r.meta || "—"}
                        </div>
                        <div className="kivaw-rec-name">{r.title}</div>
                        <div className="kivaw-rec-by">{r.byline || ""}</div>

                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="kivaw-openlink"
                          >
                            Open →
                          </a>
                        )}
                      </div>

                      {/* Heart button = unsave */}
                      <button
                        type="button"
                        className="btn btn-small btn-ghost kivaw-rec-action"
                        aria-label="Unsave"
                        disabled={isBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSaved(r.id);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          minWidth: 44,
                        }}
                      >
                        {isBusy ? "…" : <HeartIcon filled={true} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}









