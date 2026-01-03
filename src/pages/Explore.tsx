import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { listContentItems } from "../data/contentApi";
import { fetchSavedIds, saveItem, unsaveItem, getUserId } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";
import { requireAuth } from "../auth/requireAuth";

type MoodKey = "all" | "blank" | "destructive" | "expansive" | "minimizer";

const MOOD_FILTERS: Array<{ key: MoodKey; emoji: string; label: string }> = [
  { key: "all", emoji: "✨", label: "All" },
  { key: "blank", emoji: "☁️", label: "Blank" },
  { key: "destructive", emoji: "🔥", label: "Destructive" },
  { key: "expansive", emoji: "🌱", label: "Expansive" },
  { key: "minimizer", emoji: "🌙", label: "Minimize" },
];

function getItemMoodKey(item: ContentItem): Exclude<MoodKey, "all"> | null {
  const anyItem = item as unknown as {
    mood?: string;
    state?: string;
    state_tag?: string;
    state_tags?: string[];
    tags?: string[];
  };

  const candidates: string[] = [];
  if (typeof anyItem.mood === "string") candidates.push(anyItem.mood);
  if (typeof anyItem.state === "string") candidates.push(anyItem.state);
  if (typeof anyItem.state_tag === "string") candidates.push(anyItem.state_tag);
  if (Array.isArray(anyItem.state_tags)) candidates.push(...anyItem.state_tags);
  if (Array.isArray(anyItem.tags)) candidates.push(...anyItem.tags);

  const norm = (s: string) => s.toLowerCase().replace(/^#/, "").trim();
  const n = candidates.map(norm);

  if (n.includes("blank")) return "blank";
  if (n.includes("destructive")) return "destructive";
  if (n.includes("expansive")) return "expansive";
  if (n.includes("minimize") || n.includes("minimizer")) return "minimizer";
  return null;
}

function getEmoji(kind?: string) {
  const k = (kind || "").toLowerCase();
  if (k.includes("playlist")) return "🎧";
  if (k.includes("reflection")) return "📝";
  if (k.includes("movement") || k.includes("exercise")) return "🧘";
  if (k.includes("visual")) return "🎨";
  if (k.includes("creative")) return "🌸";
  if (k.includes("expansive")) return "🌱";
  if (k.includes("prompt")) return "✨";
  return "🌿";
}

export default function Explore() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<MoodKey>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const content = await listContentItems({ limit: 60 });
        if (cancelled) return;
        setItems(content);

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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleSave(contentId: string, isSaved: boolean) {
    const uid = await requireAuth(navigate, "/explore");
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
      // rollback via re-fetch
      try {
        const updated = await fetchSavedIds();
        setSavedIds(updated || []);
      } catch {}
    } finally {
      setBusyId(null);
    }
  }

  const filteredItems = useMemo(() => {
    if (selectedMood === "all") return items;
    return items.filter((it) => getItemMoodKey(it) === selectedMood);
  }, [items, selectedMood]);

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <div style={{ marginBottom: 10 }}>
            <h1 style={{ marginBottom: 6 }}>Explore</h1>
            <p className="kivaw-muted" style={{ marginTop: 0 }}>
              Browse everything — pick what fits your energy.
            </p>
          </div>

          <div className="kivaw-filters" style={{ marginBottom: 10 }}>
            {MOOD_FILTERS.map((m) => {
              const active = selectedMood === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  className={active ? "kivaw-pill kivaw-pill--active" : "kivaw-pill"}
                  onClick={() => setSelectedMood(m.key)}
                >
                  <span aria-hidden="true" style={{ marginRight: 6 }}>
                    {m.emoji}
                  </span>
                  {m.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="kivaw-muted">Loading…</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <p className="kivaw-muted" style={{ marginTop: 0 }}>
                  {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
                </p>

                {!isAuthed ? (
                  <button className="btn-ghost" type="button" onClick={() => navigate("/auth?returnTo=/explore")}>
                    Sign in to save →
                  </button>
                ) : null}
              </div>

              <div className="kivaw-rec-grid">
                {filteredItems.map((item) => {
                  const isSaved = savedIds.includes(item.id);
                  const isBusy = busyId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="kivaw-rec-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/item/${item.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") navigate(`/item/${item.id}`);
                      }}
                    >
                      <div className="kivaw-rec-card__body">
                        <div className="kivaw-rec-card__top">
                          <div className="kivaw-rec-card__meta">
                            <span aria-hidden="true" style={{ marginRight: 8 }}>
                              {getEmoji(item.kind)}
                            </span>
                            <span>{item.kind || "Item"}</span>
                            {isSaved ? <span className="kivaw-savedBadge">Saved</span> : null}
                          </div>

                          {/* Small heart like Waves */}
                          <button
                            className="kivaw-heart"
                            type="button"
                            aria-label={isSaved ? "Unsave" : "Save"}
                            disabled={isBusy}
                            title={!isAuthed ? "Sign in to save" : isSaved ? "Unsave" : "Save"}
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
                        </div>

                        <div className="kivaw-rec-card__title">{item.title}</div>

                        {item.byline ? (
                          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                            {item.byline}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!loading && filteredItems.length === 0 && (
                <div style={{ paddingTop: 14 }}>
                  <p className="kivaw-muted" style={{ marginBottom: 10 }}>
                    Nothing matches that filter yet.
                  </p>
                  <button className="btn" type="button" onClick={() => setSelectedMood("all")}>
                    View all
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
























