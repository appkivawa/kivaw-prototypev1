import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

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
          <button className="btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <h1 className="h1" style={{ marginTop: 14 }}>
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



