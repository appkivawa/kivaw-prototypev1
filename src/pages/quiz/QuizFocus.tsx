import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Popover from "../../ui/Popover";


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
                    <strong>Focus</strong> = the area of life you’re aiming at.
                  </p>
                  <p>
                    <strong>State</strong> = your current mode (how you’re processing today).
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

