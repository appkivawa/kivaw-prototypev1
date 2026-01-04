import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import ItemCard from "../ui/ItemCard";

import { supabase } from "../lib/supabaseClient";
import { fetchSavedIds, unsaveItem, getUserId } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";
import { requireAuth } from "../auth/requireAuth";

export default function Saved() {
  const navigate = useNavigate();

  const [isAuthed, setIsAuthed] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadSaved() {
    setErr("");
    setLoading(true);

    try {
      const uid = await getUserId();
      const authed = !!uid;
      setIsAuthed(authed);

      if (!authed) {
        setItems([]);
        return;
      }

      const saved = await fetchSavedIds(); // newest-first

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

      // preserve saved order
      const map = new Map<string, ContentItem>();
      for (const it of (data || []) as ContentItem[]) map.set(it.id, it);

      const ordered = saved.map((id) => map.get(id)).filter(Boolean) as ContentItem[];
      setItems(ordered);
    } catch (e: any) {
      setErr(e?.message || "Could not load saved.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeSaved(contentId: string) {
    const uid = await requireAuth(navigate, "/saved");
    if (!uid) return;

    if (busyId) return;
    setBusyId(contentId);

    // optimistic UI
    setItems((prev) => prev.filter((x) => x.id !== contentId));

    try {
      await unsaveItem(contentId);
    } catch (e) {
      console.error(e);
      await loadSaved();
      alert("Couldn’t update saved right now.");
    } finally {
      setBusyId(null);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((it) => isPublicDiscoverableContentItem(it));
  }, [items]);

  const internalCount = useMemo(() => {
    return items.length - visibleItems.length;
  }, [items.length, visibleItems.length]);

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <h1>Saved</h1>
        <p>Your personal stash of “this actually helped.”</p>
      </div>

      <div className="center-wrap">
        <Card className="center card-pad">
          {!isAuthed ? (
            <div>
              <p className="muted" style={{ marginBottom: 10 }}>
                Sign in to view your saved items.
              </p>
              <button
                className="btn"
                type="button"
                onClick={() => navigate("/login", { state: { from: "/saved" } })}
              >
                Continue →
              </button>
            </div>
          ) : loading ? (
            <p className="muted">Loading…</p>
          ) : err ? (
            <p className="muted">{err}</p>
          ) : visibleItems.length === 0 ? (
            <div>
              <p className="muted" style={{ marginBottom: 10 }}>
                Nothing saved yet.
              </p>
              <button className="btn" type="button" onClick={() => navigate("/explore")}>
                Explore →
              </button>
            </div>
          ) : (
            <>
              {internalCount > 0 ? (
                <div className="echo-empty" style={{ marginBottom: 12 }}>
                  Hidden internal items: {internalCount}
                </div>
              ) : null}

              <div className="kivaw-rec-grid">
                {visibleItems.map((it) => {
                  const isBusy = busyId === it.id;

                  return (
                    <ItemCard
                      key={it.id}
                      item={it}
                      onOpen={() => navigate(`/item/${it.id}`)}
                      topMeta={
                        <>
                          <span className="kivaw-meta-pill">{it.kind || "Item"}</span>
                          {it.byline ? (
                            <>
                              <span className="kivaw-meta-dot">•</span>
                              <span className="kivaw-meta-soft">{it.byline}</span>
                            </>
                          ) : null}
                        </>
                      }
                      action={
                        <button
                          className="kivaw-heart"
                          type="button"
                          aria-label="Remove"
                          disabled={isBusy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeSaved(it.id);
                          }}
                        >
                          {isBusy ? "…" : "♥"}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}













