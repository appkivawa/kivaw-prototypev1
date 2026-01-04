import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import ItemCard from "../ui/ItemCard";

import { listContentItems, type ContentItem } from "../data/contentApi";
import { fetchSavedIds, saveItem, unsaveItem, getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/requireAuth";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function stateLabel(tag: string) {
  const t = norm(tag);
  if (t === "all") return "All";
  if (t === "reset") return "Reset";
  if (t === "beauty") return "Beauty";
  if (t === "logic") return "Logic";
  if (t === "faith") return "Faith";
  if (t === "reflect") return "Reflect";
  if (t === "comfort") return "Comfort";
  return tag;
}

const MOODS = ["all", "reset", "beauty", "logic", "faith", "reflect", "comfort"];

export default function Explore() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const rows = await listContentItems({ limit: 120 });
        if (cancelled) return;

        // ✅ One rule for internal items
        const visible = (rows || []).filter((it) => isPublicDiscoverableContentItem(it));
        setItems(visible);

        const uid = await getUserId();
        if (cancelled) return;

        const authed = !!uid;
        setIsAuthed(authed);

        if (authed) {
          const ids = await fetchSavedIds();
          if (!cancelled) setSavedIds(ids || []);
        } else {
          setSavedIds([]);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Could not load Explore.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = norm(q);
    return items.filter((it) => {
      if (query) {
        const hay = `${it.title || ""} ${it.byline || ""} ${it.meta || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      if (selectedMood === "all") return true;

      const tags = (it.state_tags || []).map(norm);
      return tags.includes(norm(selectedMood));
    });
  }, [items, q, selectedMood]);

  async function toggleSave(contentId: string, isSaved: boolean) {
    const uid = await requireAuth(navigate, "/explore");
    if (!uid) return;

    if (busyId) return;
    setBusyId(contentId);

    // optimistic
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
      try {
        const updated = await fetchSavedIds();
        setSavedIds(updated || []);
      } catch {}
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <h1>Explore</h1>
        <p>Find something that matches your state.</p>
      </div>

      <div className="center-wrap">
        <Card className="center card-pad">
          <div className="kivaw-toolbar">
            <input
              className="input"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="kivaw-pills">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`pill ${selectedMood === m ? "pill--on" : ""}`}
                  onClick={() => setSelectedMood(m)}
                >
                  {stateLabel(m)}
                </button>
              ))}
            </div>
          </div>

          {!isAuthed ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ marginBottom: 8 }}>
                Want to save items? Sign in to heart them.
              </p>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/login", { state: { from: "/explore" } })}>
                Sign in →
              </button>
            </div>
          ) : null}

          <div className="spacer-16" />

          {loading ? (
            <p className="muted">Loading…</p>
          ) : err ? (
            <p className="muted">{err}</p>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: 10 }}>
              <p className="kivaw-muted" style={{ marginBottom: 10 }}>
                Nothing matches that filter yet.
              </p>
              <button className="btn" type="button" onClick={() => setSelectedMood("all")}>
                View all
              </button>
            </div>
          ) : (
            <div className="kivaw-rec-grid">
              {filteredItems.map((item) => {
                const isSaved = savedIds.includes(item.id);
                const isBusy = busyId === item.id;

                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onOpen={() => navigate(`/item/${item.id}`)}
                    topMeta={
                      <>
                        <span className="kivaw-meta-pill">{item.kind || "Item"}</span>
                        {item.byline ? (
                          <>
                            <span className="kivaw-meta-dot">•</span>
                            <span className="kivaw-meta-soft">{item.byline}</span>
                          </>
                        ) : null}
                      </>
                    }
                    action={
                      <button
                        className="kivaw-heart"
                        type="button"
                        aria-label={isSaved ? "Unsave" : "Save"}
                        disabled={isBusy}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSave(item.id, isSaved);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === " " || e.key === "Enter") e.preventDefault();
                        }}
                      >
                        {isBusy ? "…" : isSaved ? "♥" : "♡"}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}






























