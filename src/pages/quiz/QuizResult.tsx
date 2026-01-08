import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import type { ContentItem } from "../../data/contentApi";
import { getDbRecommendationsV2 } from "../../data/recommendationsDb";
import { fetchSavedIds, saveItem, unsaveItem } from "../../data/savesApi";
import { requireAuth } from "../../auth/authUtils";
import { fetchMovies, fetchBooks } from "../../data/providers/externalProviders";
import { externalToContentItem } from "../../data/providers/contentProviders";

function titleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeState(stateRaw: string) {
  const s = (stateRaw || "").toLowerCase().trim();
  if (s === "destructivist") return "destructive";
  if (s === "expansivist") return "expansive";
  return s || "blank";
}

function displayState(stateRaw: string) {
  const s = normalizeState(stateRaw);
  if (s === "minimizer") return "Minimize";
  if (s === "expansive") return "Expansive";
  if (s === "destructive") return "Destructive";
  return "Blank";
}

function displayFocus(focusRaw: string) {
  const f = (focusRaw || "").toLowerCase().trim();
  if (f === "music") return "Music";
  if (f === "watch") return "Watch";
  if (f === "read") return "Read";
  if (f === "move") return "Move";
  if (f === "create") return "Create"; // ✅ includes audio/music creation
  if (f === "reset") return "Reset";
  return titleCase(f);
}

function focusEmoji(focusRaw: string) {
  const f = (focusRaw || "").toLowerCase().trim();
  if (f === "music") return "🎵";
  if (f === "watch") return "📺";
  if (f === "read") return "📚";
  if (f === "move") return "🏃";
  if (f === "create") return "🎨"; // ✅ create umbrella
  if (f === "reset") return "🧘";
  return "✨";
}

function kindEmoji(kind?: string) {
  const k = (kind || "").toLowerCase();
  if (k.includes("playlist") || k.includes("album") || k.includes("song")) return "🎧";
  if (k.includes("watch") || k.includes("video") || k.includes("film")) return "📺";
  if (k.includes("read") || k.includes("book") || k.includes("article")) return "📚";
  if (k.includes("movement") || k.includes("exercise") || k.includes("move")) return "🧘";
  if (k.includes("creative") || k.includes("create")) return "🌸";
  if (k.includes("expansive")) return "🌱";
  if (k.includes("prompt") || k.includes("reflection")) return "📝";
  if (k.includes("visual") || k.includes("art")) return "🎨";
  return "🌿";
}

export default function QuizResult() {
  const navigate = useNavigate();

  const stateRaw = sessionStorage.getItem("kivaw_state") || "blank";
  const focusRaw = sessionStorage.getItem("kivaw_focus") || "";

  const stateKey = useMemo(() => normalizeState(stateRaw), [stateRaw]);
  const stateLabel = useMemo(() => displayState(stateRaw), [stateRaw]);
  const focusLabel = useMemo(() => displayFocus(focusRaw), [focusRaw]);
  const focusIcon = useMemo(() => focusEmoji(focusRaw), [focusRaw]);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!focusRaw) {
      navigate("/quiz/focus");
      return;
    }

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const focus = focusRaw.toLowerCase().trim();
        const [dbRecs, saved] = await Promise.all([
          getDbRecommendationsV2(stateKey, focusRaw, 12),
          fetchSavedIds(),
        ]);

        // Fetch external content if focus is "watch" or "read"
        let externalItems: ContentItem[] = [];
        try {
          if (focus === "watch") {
            // Get trending movies for "watch" focus
            const movies = await fetchMovies({ limit: 6 });
            externalItems = movies.map(externalToContentItem) as ContentItem[];
          } else if (focus === "read") {
            // Get suggested books for "read" focus (use state as subject hint)
            const subject = stateKey === "blank" ? "self-help" : stateKey;
            const books = await fetchBooks({ subject, limit: 6 });
            externalItems = books.map(externalToContentItem) as ContentItem[];
          }
        } catch (extErr) {
          // Silently fail external content - don't block UI if external providers are disabled
          console.warn("[QuizResult] Could not fetch external content:", extErr);
        }

        // Combine DB recommendations with external content (prioritize DB items)
        const allItems = [...(dbRecs || []), ...externalItems];
        setItems(allItems);
        setSavedIds(saved || []);
      } catch (e: any) {
        setErr(e?.message || "Could not load results.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, focusRaw, stateKey]);

  async function toggleSave(id: string, isSaved: boolean) {
    const uid = await requireAuth(navigate, `/quiz/result`);
    if (!uid) return;

    try {
      if (isSaved) await unsaveItem(id);
      else await saveItem(id);
      const updated = await fetchSavedIds();
      setSavedIds(updated || []);
    } catch {
      // silent on purpose
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <div className="quiz-shell">
          <div className="quiz-shell__top">
            <button className="btn-ghost" onClick={() => navigate(-1)} type="button">
              ← Back
            </button>

            <div className="quiz-view">
              <div className="quiz-view__label">VIEW:</div>
              <button
                className="quiz-view__pill"
                type="button"
                onClick={() => navigate("/quiz/focus")}
                title="Change focus"
              >
                Focus
              </button>
            </div>
          </div>

          <div className="quiz-header">
            <h1 className="quiz-title">Results</h1>
            <p className="quiz-subline">
              State: <strong>{stateLabel}</strong> <span style={{ opacity: 0.6 }}>•</span>{" "}
              Focus: <strong>{focusLabel}</strong> <span aria-hidden="true">{focusIcon}</span>
            </p>
          </div>

          <Card className="quiz-card">
            {loading ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Loading…
              </p>
            ) : err ? (
              <p className="muted" style={{ marginTop: 0 }}>
                {err}
              </p>
            ) : items.length === 0 ? (
              <div>
                <p className="muted" style={{ marginTop: 0 }}>
                  No results yet for this combo.
                </p>
                <button className="btn" type="button" onClick={() => navigate("/explore")}>
                  Browse everything →
                </button>
              </div>
            ) : (
              <div className="kivaw-rec-grid">
                {items.map((it) => {
                  const isSaved = savedIds.includes(it.id);

                  return (
                    <div
                      key={it.id}
                      className="kivaw-rec-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/item/${it.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") navigate(`/item/${it.id}`);
                      }}
                    >
                      <div className="kivaw-rec-card__body">
                        <div className="kivaw-rec-card__top">
                          <div className="kivaw-rec-card__meta">
                            <span aria-hidden="true" style={{ marginRight: 8 }}>
                              {kindEmoji(it.kind)}
                            </span>
                            <span>{it.kind || "Item"}</span>
                          </div>

                          <button
                            className="kivaw-heart"
                            aria-label={isSaved ? "Unsave" : "Save"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSave(it.id, isSaved);
                            }}
                            type="button"
                          >
                            {isSaved ? "♥" : "♡"}
                          </button>
                        </div>

                        <div className="kivaw-rec-card__title">{it.title}</div>

                        {it.byline ? (
                          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                            {it.byline}
                          </div>
                        ) : null}

                        {"usage_tags" in it &&
                        Array.isArray((it as any).usage_tags) &&
                        (it as any).usage_tags.length ? (
                          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {(it as any).usage_tags.slice(0, 3).map((t: string) => (
                              <span key={t} className="tag">
                                {t}
                              </span>
                            ))}
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
    </div>
  );
}





















