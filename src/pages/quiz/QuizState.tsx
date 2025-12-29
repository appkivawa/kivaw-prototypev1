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
    <Card>
      <h1 className="h1">What’s your current state?</h1>
      <div className="stack">
        {STATES.map((s) => (
          <button key={s.key} className="pill" onClick={() => choose(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
