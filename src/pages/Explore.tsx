import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { listContentItems } from "../data/contentApi";
import { fetchSavedIds, unsaveItem } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";

type MoodKey = "all" | "blank" | "destructive" | "expansive" | "minimizer";

const MOOD_FILTERS: Array<{ key: MoodKey; emoji: string; label: string }> = [
  { key: "all", emoji: "✨", label: "All" },
  { key: "blank", emoji: "☁️", label: "Blank" },
  { key: "destructive", emoji: "🔥", label: "Destructive" },
  { key: "expansive", emoji: "🌱", label: "Expansive" },
  // ✅ label updated, key unchanged
  { key: "minimizer", emoji: "🌙", label: "Minimize" },
];

function getItemMoodKey(item: ContentItem): Exclude<MoodKey, "all"> | null {
  // Defensive: supports common fields without requiring them.
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
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<MoodKey>("all");

  useEffect(() => {
    (async () => {
      try {
        const [content, saved] = await Promise.all([
          listContentItems({ limit: 60 }),
          fetchSavedIds(),
        ]);
        setItems(content);
        setSavedIds(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function removeSaved(id: string) {
    await unsaveItem(id);
    const updated = await fetchSavedIds();
    setSavedIds(updated);
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
              <p className="kivaw-muted" style={{ marginTop: 0 }}>
                {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
              </p>

              <div className="kivaw-rec-grid">
                {filteredItems.map((item) => {
                  const isSaved = savedIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className="kivaw-rec-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/item/${item.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          navigate(`/item/${item.id}`);
                        }
                      }}
                    >
                      <div className="kivaw-rec-card__body">
                        <div className="kivaw-rec-row">
                          <div className="kivaw-rec-icon" aria-hidden="true">
                            {getEmoji(item.kind)}
                          </div>

                          <div className="kivaw-rec-content">
                            <div className="kivaw-rec-card__meta">
                              {item.kind || "Item"}
                              {isSaved ? (
                                <span className="kivaw-savedBadge">Saved</span>
                              ) : null}
                            </div>

                            <div className="kivaw-rec-card__title">{item.title}</div>
                          </div>

                          {isSaved ? (
                            <button
                              className="btn-ghost kivaw-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSaved(item.id);
                              }}
                            >
                              Remove
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
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
                  <button className="btn" onClick={() => setSelectedMood("all")}>
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






















