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
  { key: "expansive", emoji: "🌱", label: "Expansive" },
  { key: "destructive", emoji: "🔥", label: "Destructive" },
  { key: "minimizer", emoji: "🌙", label: "Minimizer" },
];

function getItemMoodKey(item: ContentItem): Exclude<MoodKey, "all"> | null {
  const anyItem = item as any;
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

function kindEmoji(kind?: string) {
  const k = (kind || "").toLowerCase();
  if (k.includes("movement") || k.includes("walk") || k.includes("exercise")) return "🚶";
  if (k.includes("music") || k.includes("sound") || k.includes("playlist")) return "🎵";
  if (k.includes("logic")) return "🧠";
  if (k.includes("visual") || k.includes("aesthetic") || k.includes("art")) return "🎨";
  if (k.includes("prompt") || k.includes("reflection")) return "📝";
  if (k.includes("faith")) return "🙏";
  return "✨";
}

function getImageUrl(item: ContentItem): string | null {
  const anyItem = item as any;
  return (
    anyItem?.image_url ||
    anyItem?.imageUrl ||
    anyItem?.image ||
    anyItem?.cover_url ||
    anyItem?.coverUrl ||
    null
  );
}

function isInternalDiscoverableItem(item: ContentItem) {
  const title = (item.title || "").toLowerCase().trim();
  const meta = ((item as any).meta || "").toLowerCase().trim();
  const kind = (item.kind || "").toLowerCase().trim();

  if (title === "unlinked echo") return true;
  if (meta.includes("used when an echo is saved")) return true;
  if (kind.includes("system")) return true;

  return false;
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

        const content = await listContentItems({ limit: 100 });
        if (cancelled) return;

        setItems((content || []).filter((it) => !isInternalDiscoverableItem(it)));

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

  const filteredItems = useMemo(() => {
    if (selectedMood === "all") return items;
    return items.filter((it) => getItemMoodKey(it) === selectedMood);
  }, [items, selectedMood]);

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <div className="kivaw-pagehead" style={{ marginBottom: 10 }}>
            <h1 style={{ marginBottom: 6 }}>Explore</h1>
            <p style={{ marginTop: 0 }}>Pick what fits your current state.</p>
          </div>

          {/* sticky filter bar */}
          <div className="kivaw-stickybar">
            <div className="kivaw-filters kivaw-filters--compact">
              {MOOD_FILTERS.map((m) => {
                const active = selectedMood === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    className={active ? "kivaw-pill kivaw-pill--active" : "kivaw-pill"}
                    onClick={() => setSelectedMood(m.key)}
                  >
                    <span aria-hidden="true" className="kivaw-pill__emoji">
                      {m.emoji}
                    </span>
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="kivaw-stickybar__sub">
              <div className="kivaw-muted">
                {loading ? "Loading…" : `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`}
              </div>

              {!isAuthed ? (
                <button className="btn-ghost" type="button" onClick={() => navigate("/auth?returnTo=/explore")}>
                  Sign in to save →
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="kivaw-muted">Loading…</p>
          ) : (
            <>
              <div className="kivaw-rec-grid" style={{ marginTop: 12 }}>
                {filteredItems.map((item) => {
                  const isSaved = savedIds.includes(item.id);
                  const isBusy = busyId === item.id;
                  const emoji = kindEmoji(item.kind);
                  const img = getImageUrl(item);

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
                      <div className="kivaw-rowCard">
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
                              <span>{item.kind || "Item"}</span>
                              {isSaved ? <span className="kivaw-savedBadge">Saved</span> : null}
                            </div>

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
                          </div>

                          <div className="kivaw-rowCard__title">{item.title}</div>

                          {item.byline ? (
                            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                              {item.byline}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredItems.length === 0 ? (
                <div style={{ paddingTop: 14 }}>
                  <p className="kivaw-muted" style={{ marginBottom: 10 }}>
                    Nothing matches that filter yet.
                  </p>
                  <button className="btn" type="button" onClick={() => setSelectedMood("all")}>
                    View all
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}





























