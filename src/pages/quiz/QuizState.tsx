import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Popover from "../../ui/Popover";

const STATES = [
  // ✅ key stays "minimizer" (DB + Home), label updated, emoji aligned
  { key: "minimizer", label: "Minimize", emoji: "🌙" },

  // ✅ key updated to match DB + Home
  { key: "destructive", label: "Destructive", emoji: "🔥" },

  // ✅ key updated to match DB + Home, emoji agreed (🌱)
  { key: "expansive", label: "Expansive", emoji: "🌱" },

  // ✅ blank stays blank; emoji aligned to Home vibe (☁️)
  { key: "blank", label: "Blank", emoji: "☁️" },
] as const;

export default function QuizState() {
  const navigate = useNavigate();

  function choose(state: string) {
    sessionStorage.setItem("kivaw_state", state);
    navigate("/quiz/focus");
  }

  return (
    <div className="page quiz-page">
      <div className="quiz-wrap">
        <Card className="quiz-card">
          <div className="quiz-top">
            <button className="quiz-back" onClick={() => navigate(-1)} type="button">
              ← Back
            </button>

            <Popover
              label="Help"
              content={
                <div className="quiz-popover">
                  <div className="popover__title">Quick definitions</div>
                  <p>
                    <strong>State</strong> = your current mode (how you’re processing today).
                  </p>
                  <p>
                    <strong>Focus</strong> = the area you’re aiming at.
                  </p>
                  <p>
                    <strong>State + Focus</strong> = your recommendation style for right now.
                  </p>
                </div>
              }
            >
              <span className="quiz-helpchip">?</span>
            </Popover>
          </div>

          <h1 className="quiz-title">What’s your current state?</h1>

          <div className="quiz-options">
            {STATES.map((s) => (
              <button
                key={s.key}
                className="quiz-option"
                onClick={() => choose(s.key)}
                type="button"
              >
                <span className="quiz-emoji" aria-hidden="true">
                  {s.emoji}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}








