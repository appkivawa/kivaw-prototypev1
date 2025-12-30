import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

function titleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function QuizResult() {
  const navigate = useNavigate();

  const stateRaw = sessionStorage.getItem("kivaw_state") || "blank";
  const focusRaw = sessionStorage.getItem("kivaw_focus") || "music";

  const state = titleCase(stateRaw);
  const focus = titleCase(focusRaw);

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <button className="btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <div className="result-text">
            <p style={{ fontSize: 18, fontWeight: 600, color: "var(--soft)" }}>
              You’re currently in a{" "}
              <span style={{ color: "var(--primary)" }}>{state}</span>{" "}
              state, drawn toward{" "}
              <span style={{ color: "var(--primary)" }}>{focus}</span>.
            </p>

            <p style={{ color: "var(--muted)", fontSize: 17 }}>
              Purpose-centered reflection and meaning.
            </p>
          </div>

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate("/quiz/focus")}
            >
              Try Another Focus
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => navigate("/quiz/state")}
            >
              Start over
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

