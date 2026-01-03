import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import { fetchSavedIds, unsaveItem, getUserId } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";

function kindEmoji(kind?: string) {
  const k = (kind || "").toLowerCase();
  if (k.includes("playlist") || k.includes("album") || k.includes("song")) return "🎧";
  if (k.includes("reflection") || k.includes("prompt")) return "📝";
  if (k.includes("visual") || k.includes("art")) return "🎨";
  if (k.includes("movement") || k.includes("exercise")) return "🧘";
  if (k.includes("creative")) return "🌸";
  if (k.includes("expansive")) return "🌱";
  return "✦";
}

export default function Saved() {
  const navigate = useNavigate();

  const [isAuthed, setIsAuthed] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadSaved() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const uid = await getUserId();
      const authed = !!uid;
      setIsAuthed(authed);

      if (!uid) {
        setIds([]);
        setItems([]);
        return;
      }

      const saved = await fetchSavedIds(); // already ordered newest-first
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

      // reorder to match saved ids order
      const index = new Map<string, number>();
      saved.forEach((x, i) => index.set(x, i));

      const sorted = (data || []).sort((a: any, b: any) => {
        return (index.get(a.id) ?? 9999) - (index.get(b.id) ?? 9999);
      });

      setItems(sorted as ContentItem[]);
    } catch (e) {
      console.error(e);
      setErrorMsg("Couldn’t load saved items right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadSaved();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeSaved(contentId: string) {
    const uid = await getUserId();
    if (!uid) {
      navigate(`/auth?returnTo=${encodeURIComponent("/saved")}`);
      return;
    }

    if (busyId) return;
    setBusyId(contentId);

    // optimistic UI
    setIds((prev) => prev.filter((x) => x !== contentId));
    setItems((prev) => prev.filter((x) => x.id !== contentId));

    try {
      await unsaveItem(contentId);
    } catch (e) {
      console.error(e);
      // reload to repair UI if something went wrong
      await loadSaved();
      alert("Couldn’t update saved right now.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <h1 className="h1">Saved</h1>
          <p className="kivaw-sub">Your saved items live here.</p>

          <div style={{ marginTop: 16, width: "100%" }}>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : errorMsg ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="muted">{errorMsg}</p>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/explore")}>
                  Explore →
                </button>
              </div>
            ) : !isAuthed ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="muted">Sign in to view (and save) your items.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(`/auth?returnTo=${encodeURIComponent("/saved")}`)}
                >
                  Sign in
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/explore")}>
                  Browse as guest →
                </button>
              </div>
            ) : ids.length === 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="muted">Nothing saved yet. Go heart a few items.</p>
                <button className="btn" type="button" onClick={() => navigate("/explore")}>
                  Explore →
                </button>
              </div>
            ) : (
              <div className="kivaw-rec-grid" style={{ marginTop: 10 }}>
                {items.map((r) => {
                  const isBusy = busyId === r.id;

                  return (
                    <div
                      key={r.id}
                      className="kivaw-rec-card kivaw-rec-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/item/${r.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/item/${r.id}`);
                        }
                      }}
                    >
                      {/* Use your existing icon tile styling */}
                      <div className="kivaw-rec-icon" aria-hidden="true">
                        {kindEmoji(r.kind)}
                      </div>

                      <div className="kivaw-rec-content">
                        <div className="kivaw-rec-card__meta">
                          {(r.kind || "Item") + (r.meta ? ` • ${r.meta}` : "")}
                        </div>
                        <div className="kivaw-rec-card__title">{r.title}</div>
                        {r.byline ? <div className="kivaw-rec-card__by">{r.byline}</div> : null}

                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="kivaw-openlink"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open →
                          </a>
                        ) : null}
                      </div>

                      <button
                        className="kivaw-heart kivaw-remove"
                        type="button"
                        aria-label="Unsave"
                        disabled={isBusy}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSaved(r.id);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === " " || e.key === "Enter") e.preventDefault();
                        }}
                        title="Remove from saved"
                      >
                        {isBusy ? "…" : "♥"}
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










