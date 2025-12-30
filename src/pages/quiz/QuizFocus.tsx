import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

const FOCUSES = [
  { key: "music", label: "🎵 Music" },
  { key: "logic", label: "🧠 Logic" },
  { key: "art", label: "🎨 Art" },
  { key: "faith", label: "🙏 Faith" },
  { key: "movement", label: "🏃 Movement" },
  { key: "beauty", label: "✨ Beauty" },
] as const;

export default function QuizFocus() {
  const navigate = useNavigate();

  function choose(focus: string) {
    sessionStorage.setItem("kivaw_focus", focus);
    navigate("/quiz/result");
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <button className="btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <h1 className="h1" style={{ marginTop: 14 }}>
            Choose your focus
          </h1>

          <div className="stack" style={{ marginTop: 16 }}>
            {FOCUSES.map((f) => (
              <button key={f.key} className="pill" onClick={() => choose(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

