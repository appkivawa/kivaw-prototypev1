import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Popover from "../../ui/Popover";
import { FAQ } from "../../data/faq";

const STATES = [
  { key: "minimizer", label: "🧩 Minimizer" },
  { key: "destructivist", label: "🔥 Destructivist" },
  { key: "expansivist", label: "🌿 Expansivist" },
  { key: "blank", label: "🫧 Blank" },
] as const;

export default function QuizState() {
  const navigate = useNavigate();

  function choose(state: string) {
    sessionStorage.setItem("kivaw_state", state);
    navigate("/quiz/focus");
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <div className="quiz-top">
            <button className="btn-back" onClick={() => navigate(-1)}>
              ← Back
            </button>

            <Popover
              label="Help"
              content={
                <div>
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
              <span className="help-chip">?</span>
            </Popover>
          </div>

          <h1 className="h1" style={{ marginTop: 12 }}>
            What’s your current state?
          </h1>

          <div className="stack" style={{ marginTop: 16 }}>
            {STATES.map((s) => (
              <button key={s.key} className="pill" onClick={() => choose(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}




