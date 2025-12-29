import { useState } from "react";

type State = "minimizer" | "destructivist" | "expansivist" | "blank";
type Focus = "music" | "logic" | "art" | "faith" | "movement" | "beauty";

const recommendations: Record<State, Record<Focus, string>> = {
  minimizer: {
    logic: "Clear, structured content that reduces noise and helps you think efficiently.",
    music: "Minimal or instrumental tracks that support calm focus.",
    art: "Clean visuals with soft contrast and breathing room.",
    faith: "Quiet reflection that grounds without overwhelm.",
    movement: "Slow, intentional movement — walking or stretching.",
    beauty: "Neutral tones and subtle elegance.",
  },
  expansivist: {
    logic: "Big-picture thinking and curiosity-driven learning.",
    music: "Atmospheric or energizing sounds that spark momentum.",
    art: "Bold visuals and expressive creativity.",
    faith: "Purpose-centered reflection and meaning.",
    movement: "Dynamic motion — dance or active flow.",
    beauty: "Radiant, expressive aesthetics.",
  },
  destructivist: {
    logic: "Breaking patterns and rebuilding perspective.",
    music: "Cathartic or intense soundscapes.",
    art: "Raw or abstract expression.",
    faith: "Deep emotional processing and release.",
    movement: "Strong physical release.",
    beauty: "Unconventional, striking visuals.",
  },
  blank: {
    logic: "Gentle clarity without pressure.",
    music: "Soft ambient sound.",
    art: "Open-ended, calming visuals.",
    faith: "Quiet grounding presence.",
    movement: "Light movement or rest.",
    beauty: "Simple, peaceful aesthetics.",
  },
};

export default function App() {
  const [screen, setScreen] = useState<"home" | "state" | "focus" | "result">("home");
  const [state, setState] = useState<State | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  return (
    <div className="kivaw-wrap">
      <div className="kivaw-phone">

        {/* HOME */}
        {screen === "home" && (
          <div className="kfade">
            <h1 className="kivaw-h1">KIVAW</h1>
            <p className="kivaw-sub">Find what fits your mood.</p>

            <button
              className="kbtn kbtn-primary"
              onClick={() => setScreen("state")}
              style={{ marginTop: 24 }}
            >
              Get Recommendations
            </button>
          </div>
        )}

        {/* STATE */}
        {screen === "state" && (
          <div className="kfade">
            <button className="kbtn-link" onClick={() => setScreen("home")}>
              ← Back
            </button>

            <h2 className="kivaw-h2">What’s your current state?</h2>

            {[
              { key: "minimizer", label: "🧩 Minimizer" },
              { key: "destructivist", label: "🔥 Destructivist" },
              { key: "expansivist", label: "🌱 Expansivist" },
              { key: "blank", label: "🌫️ Blank" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className="kbtn"
                onClick={() => {
                  setState(key as State);
                  setScreen("focus");
                }}
                style={{ margin: "10px 0" }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* FOCUS */}
        {screen === "focus" && (
          <div className="kfade">
            <button className="kbtn-link" onClick={() => setScreen("state")}>
              ← Back
            </button>

            <h2 className="kivaw-h2">Choose your focus</h2>

            {[
              { key: "music", label: "🎵 Music" },
              { key: "logic", label: "🧠 Logic" },
              { key: "art", label: "🎨 Art" },
              { key: "faith", label: "🙏 Faith" },
              { key: "movement", label: "🏃 Movement" },
              { key: "beauty", label: "✨ Beauty" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className="kbtn"
                onClick={() => {
                  setFocus(key as Focus);
                  setScreen("result");
                }}
                style={{ margin: "10px 0" }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* RESULT */}
        {screen === "result" && (
          <div className="kfade">
            <button className="kbtn-link" onClick={() => setScreen("focus")}>
              ← Back
            </button>

            <div className="kcard" style={{ textAlign: "center" }}>
              <img
                src="/favicon.svg"
                alt="Kivaw"
                style={{
                  width: 44,
                  marginBottom: 12,
                  opacity: 0.8,
                }}
              />

              <p style={{ fontSize: 14, opacity: 0.7 }}>
                You’re currently in a{" "}
                <span style={{ color: "#5d70ae" }}>{state}</span> state,
                drawn toward{" "}
                <span style={{ color: "#5d70ae" }}>{focus}</span>.
              </p>

              <p style={{ marginTop: 14, color: "rgba(0,0,0,0.65)", lineHeight: 1.6 }}>
                {state && focus && recommendations[state][focus]}
              </p>
            </div>

            <button
              className="kbtn kbtn-primary"
              onClick={() => setScreen("focus")}
              style={{ marginTop: 18 }}
            >
              Try Another Focus
            </button>

            <button
              className="kbtn kbtn-outline"
              onClick={() => {
                setState(null);
                setFocus(null);
                setScreen("home");
              }}
              style={{ marginTop: 10 }}
            >
              ← Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
