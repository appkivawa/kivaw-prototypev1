import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Popover from "../../ui/Popover";

const STATES = [
  { key: "minimizer", label: "Minimizer", emoji: "🧩" },
  { key: "destructivist", label: "Destructivist", emoji: "🔥" },
  { key: "expansivist", label: "Expansivist", emoji: "🌿" },
  { key: "blank", label: "Blank", emoji: "🫧" },
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
            <button className="quiz-back" onClick={() => navigate(-1)}>
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
              <button key={s.key} className="quiz-option" onClick={() => choose(s.key)}>
                <span className="quiz-emoji">{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}







