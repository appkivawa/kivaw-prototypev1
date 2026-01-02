import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

function titleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type RecItem = {
  id: string;
  title: string;
  type: string;
  subtitle: string;
  source: string;
  iconEmoji: string;
  iconToneClass: "tone-blue" | "tone-purple" | "tone-orange" | "tone-teal";
  tags?: string[];
};

function buildMockResults(state: string, focus: string): RecItem[] {
  const base: RecItem[] = [
    {
      id: "neutral-sounds",
      title: "Neutral Sounds",
      type: "Playlist",
      subtitle: "Background calm",
      source: "Kivaw",
      iconEmoji: "🎧",
      iconToneClass: "tone-blue",
    },
    {
      id: "soft-reset",
      title: "Soft Reset",
      type: "Playlist",
      subtitle: "Calm, grounding sounds",
      source: "Kivaw",
      iconEmoji: "🎵",
      iconToneClass: "tone-purple",
      tags: ["#windingdown", "#latenight", "#emotionalreset"],
    },
    {
      id: "release-playlist",
      title: "Release Playlist",
      type: "Playlist",
      subtitle: "Let it out safely",
      source: "Kivaw",
      iconEmoji: "🎶",
      iconToneClass: "tone-orange",
    },
    {
      id: "tiny-ritual",
      title: "Tiny Ritual",
      type: "Practice",
      subtitle: "One small reset",
      source: "Kivaw",
      iconEmoji: "🕯️",
      iconToneClass: "tone-teal",
    },
    {
      id: "comfort-watch",
      title: "Comfort Watch",
      type: "Watch",
      subtitle: "Low effort, high comfort",
      source: "Kivaw",
      iconEmoji: "🍿",
      iconToneClass: "tone-blue",
    },
    {
      id: "quiet-pages",
      title: "Quiet Pages",
      type: "Read",
      subtitle: "Gentle reading energy",
      source: "Kivaw",
      iconEmoji: "📖",
      iconToneClass: "tone-purple",
    },
    {
      id: "gentle-momentum",
      title: "Gentle Momentum",
      type: "Move",
      subtitle: "Soft movement",
      source: "Kivaw",
      iconEmoji: "👟",
      iconToneClass: "tone-orange",
    },
    {
      id: "creative-spark",
      title: "Creative Spark",
      type: "Create",
      subtitle: "Make something small",
      source: "Kivaw",
      iconEmoji: "✍️",
      iconToneClass: "tone-teal",
    },
    {
      id: "deep-breath",
      title: "Deep Breath",
      type: "Reset",
      subtitle: "Back to center",
      source: "Kivaw",
      iconEmoji: "🧘",
      iconToneClass: "tone-blue",
    },
    {
      id: "mood-mix",
      title: "Mood Mix",
      type: "Playlist",
      subtitle: "Match your current vibe",
      source: "Kivaw",
      iconEmoji: "🎛️",
      iconToneClass: "tone-purple",
    },
  ];

  // Tiny flavor variations based on focus (optional)
  if (focus === "read") {
    base[0] = {
      ...base[0],
      title: "Reading Atmosphere",
      iconEmoji: "📚",
      iconToneClass: "tone-teal",
    };
  }
  if (focus === "watch") {
    base[1] = {
      ...base[1],
      title: "Comfort Watch",
      iconEmoji: "📺",
      iconToneClass: "tone-blue",
    };
  }
  if (focus === "move") {
    base[2] = {
      ...base[2],
      title: "Release Through Motion",
      iconEmoji: "🏃",
      iconToneClass: "tone-orange",
    };
  }

  return base;
}

export default function QuizResult() {
  const navigate = useNavigate();
  const [likes, setLikes] = useState<Record<string, boolean>>({});

  // This controls which "chunk" of results you're seeing
  const ITEMS_PER_PAGE = 3;
  const [page, setPage] = useState(0);

  const stateRaw = sessionStorage.getItem("kivaw_state") || "blank";
  const focusRaw = sessionStorage.getItem("kivaw_focus") || "music";

  const stateLabel = titleCase(stateRaw);
  const focusLabel = titleCase(focusRaw);

  // Full list for this combo
  const fullList = useMemo(() => buildMockResults(stateRaw, focusRaw), [stateRaw, focusRaw]);

  const totalForCombo = fullList.length;

  // total "shuffle pages" (10 items, 3 per page => 4 pages)
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalForCombo / ITEMS_PER_PAGE));
  }, [totalForCombo]);

  // If the user changes state/focus, restart the cycle
  useEffect(() => {
    setPage(0);
  }, [stateRaw, focusRaw]);

  // Slice the list based on the current page
  const items = useMemo(() => {
    if (totalForCombo === 0) return [];
    const start = page * ITEMS_PER_PAGE;
    return fullList.slice(start, start + ITEMS_PER_PAGE);
  }, [fullList, page, totalForCombo]);

  // Progress count that resets when we loop
  const shown = useMemo(() => {
    if (totalForCombo === 0) return 0;
    return Math.min((page + 1) * ITEMS_PER_PAGE, totalForCombo);
  }, [page, totalForCombo]);

  function shuffle() {
    // Move to next chunk; if we hit the end, wrap back to page 0 (count resets)
    setPage((p) => (p + 1) % totalPages);
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <div className="quiz-shell quiz-shell--wide">
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

          <div className="results-head">
            <h1 className="results-title">
              You&apos;re in a {stateLabel} mode — leaning into {focusLabel}
            </h1>
            <p className="results-sub">Here are a few picks. Shuffle when you want a new set.</p>

            <div className="results-actions">
              <button className="btn-soft" type="button" onClick={shuffle}>
                Shuffle ↻
              </button>

              <button
                className="btn-soft"
                type="button"
                onClick={() => {
                  sessionStorage.removeItem("kivaw_state");
                  sessionStorage.removeItem("kivaw_focus");
                  navigate("/");
                }}
              >
                Start over
              </button>

              <button className="btn-soft" type="button" onClick={() => navigate("/quiz/focus")}>
                Change focus
              </button>
            </div>
          </div>

          <div className="results-list">
            {items.map((it) => {
              const liked = !!likes[it.id];
              return (
                <Card key={it.id} className="rec-card">
                  <div className="rec-card__row">
                    <div className={`rec-icon ${it.iconToneClass}`} aria-hidden="true">
                      {it.iconEmoji}
                    </div>

                    <div className="rec-main">
                      <div className="rec-title">{it.title}</div>

                      <div className="rec-meta">
                        <span className="rec-type">{it.type}</span>
                        <span className="rec-dot">•</span>
                        <span className="rec-subtitle">{it.subtitle}</span>
                      </div>

                      {it.tags && it.tags.length > 0 && (
                        <div className="rec-tags">
                          {it.tags.map((t) => (
                            <span key={t} className="chip">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="rec-source">{it.source}</div>
                    </div>

                    <button
                      className={`heart ${liked ? "is-liked" : ""}`}
                      type="button"
                      aria-label={liked ? "Unsave" : "Save"}
                      onClick={() => setLikes((m) => ({ ...m, [it.id]: !m[it.id] }))}
                    >
                      {liked ? "♥" : "♡"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="results-count">
            {shown} / {totalForCombo} shown for this combo
          </div>
        </div>
      </div>
    </div>
  );
}

















