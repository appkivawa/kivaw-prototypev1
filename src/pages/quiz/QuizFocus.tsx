import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

const FOCUSES = [
  { key: "music", emoji: "🎵", label: "Music" },
  { key: "watch", emoji: "📺", label: "Watch" },
  { key: "read", emoji: "📚", label: "Read" },
  { key: "move", emoji: "🏃", label: "Move" },
  { key: "create", emoji: "✍️", label: "Create" },
  { key: "reset", emoji: "🧘", label: "Reset" },
] as const;

function titleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function QuizFocus() {
  const navigate = useNavigate();

  const stateRaw = sessionStorage.getItem("kivaw_state") || "blank";
  const stateLabel = titleCase(stateRaw);

  const viewTarget = useMemo(() => {
    // If focus already chosen, allow quick jump to results
    const hasFocus = !!sessionStorage.getItem("kivaw_focus");
    return hasFocus ? "/quiz/result" : null;
  }, []);

  function choose(focus: string) {
    sessionStorage.setItem("kivaw_focus", focus);
    navigate("/quiz/result");
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
                onClick={() => {
                  if (viewTarget) navigate(viewTarget);
                }}
                disabled={!viewTarget}
                aria-disabled={!viewTarget}
                title={!viewTarget ? "Pick a focus first" : "Go to results"}
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
              {FOCUSES.map((f) => (
                <button
                  key={f.key}
                  className="focus-row"
                  type="button"
                  onClick={() => choose(f.key)}
                >
                  <span className="focus-row__emoji" aria-hidden="true">
                    {f.emoji}
                  </span>
                  <span className="focus-row__label">{f.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}





