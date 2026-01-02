import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

const FOCUSES = [
  { key: "music", emoji: "🎵", label: "Music" },
  { key: "watch", emoji: "📺", label: "Watch" },
  { key: "read", emoji: "📚", label: "Read" },
  { key: "move", emoji: "🏃", label: "Move" },

  // ✅ Create includes sound/music creation too (key stays "create")
  { key: "create", emoji: "🎨", label: "Create" },

  { key: "reset", emoji: "🧘", label: "Reset" },
] as const;

type FocusKey = (typeof FOCUSES)[number]["key"];

function titleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function QuizFocus() {
  const navigate = useNavigate();

  const [selectedFocus, setSelectedFocus] = useState<string>(
    () => sessionStorage.getItem("kivaw_focus") || ""
  );

  // Keep UI in sync if user navigates back here after selecting a focus
  useEffect(() => {
    const current = sessionStorage.getItem("kivaw_focus") || "";
    setSelectedFocus(current);
  }, []);

  const stateRaw = sessionStorage.getItem("kivaw_state") || "blank";
  const stateLabel = stateRaw === "blank" ? "Blank" : titleCase(stateRaw);

  const hasFocus = !!selectedFocus;

  function choose(focus: FocusKey) {
    sessionStorage.setItem("kivaw_focus", focus);
    setSelectedFocus(focus);
    navigate("/quiz/result");
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <div className="quiz-shell">
          <div className="quiz-shell__top">
            <button
              className="btn-ghost"
              onClick={() => navigate(-1)}
              type="button"
            >
              ← Back
            </button>

            <div className="quiz-view">
              <div className="quiz-view__label">VIEW:</div>
              <button
                className="quiz-view__pill"
                type="button"
                onClick={() => {
                  if (hasFocus) navigate("/quiz/result");
                }}
                disabled={!hasFocus}
                aria-disabled={!hasFocus}
                title={!hasFocus ? "Pick a focus first" : "Go to results"}
              >
                Results
              </button>
            </div>
          </div>

          <h1 className="quiz-title">What’s your focus?</h1>
          <div className="quiz-subline">
            State: <strong>{stateLabel}</strong>
          </div>

          <Card className="quiz-card">
            <div className="focus-list">
              {FOCUSES.map((f) => {
                const isSelected = selectedFocus === f.key;

                return (
                  <button
                    key={f.key}
                    className="focus-row"
                    type="button"
                    onClick={() => choose(f.key)}
                    aria-pressed={isSelected}
                    aria-label={`Choose focus: ${f.label}`}
                    title={isSelected ? "Selected" : `Choose ${f.label}`}
                  >
                    <span className="focus-row__emoji" aria-hidden="true">
                      {f.emoji}
                    </span>
                    <span className="focus-row__label">{f.label}</span>

                    {/* Optional subtle indicator without requiring CSS changes */}
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        style={{ marginLeft: "auto", opacity: 0.8 }}
                      >
                        ✓
                      </span>
                    ) : (
                      <span aria-hidden="true" style={{ marginLeft: "auto" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}








