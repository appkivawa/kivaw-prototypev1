import { useState } from "react";

type State = "minimizer" | "destructivist" | "expansivist" | "blank";
type Focus = "music" | "logic" | "art" | "faith" | "movement" | "beauty";

const recommendations: Record<State, Record<Focus, string>> = {
  minimizer: {
    logic: "Clear, structured content that reduces noise and helps you think efficiently.",
    music: "Minimal or instrumental tracks that support calm focus.",
    art: "Clean visuals with soft contrast—simple, intentional, uncluttered.",
    faith: "Quiet reflection that grounds you without overwhelming you.",
    movement: "Slow, intentional movement—stretching, walking, gentle flow.",
    beauty: "Neutral palettes, clean lines, subtle elegance—nothing loud.",
  },
  expansivist: {
    logic: "Big-picture ideas, frameworks, and curiosity-driven learning.",
    music: "Atmospheric or energizing sounds that spark momentum and imagination.",
    art: "Bold visuals, expressive color, and creative exploration.",
    faith: "Purpose-centered reflection that expands your perspective.",
    movement: "Dynamic motion—dance, active flow, anything that feels alive.",
    beauty: "Expressive styling and aesthetics—playful, radiant, expansive.",
  },
  destructivist: {
    logic: "Breakdown + rebuild: content that challenges assumptions and clears the old structure.",
    music: "Cathartic or intense soundscapes—release, reset, exhale.",
    art: "Abstract, disruptive visuals—raw expression and transformation energy.",
    faith: "Honest wrestling with meaning—finding truth through tension.",
    movement: "High-energy release—strength, sweat, shake it out.",
    beauty: "Unconventional beauty—raw, edgy, unapologetic.",
  },
  blank: {
    logic: "Light mental stimulation with zero pressure—gentle clarity.",
    music: "Soft ambient or easy-listening—something neutral and comforting.",
    art: "Open-ended visuals—so your mind can wander safely.",
    faith: "A quiet nudge toward peace—no demands, just presence.",
    movement: "Gentle motion or rest—whatever your body can do today.",
    beauty: "Simple calm aesthetics—clean, soft, steady.",
  },
};

const stateCards: Array<{ id: State; title: string; desc: string; icon: string }> = [
  { id: "minimizer", title: "Minimizer", desc: "calm • low stimulation • clarity", icon: "🧩" },
  { id: "destructivist", title: "Destructivist", desc: "release • intensity • reset", icon: "🔥" },
  { id: "expansivist", title: "Expansivist", desc: "curious • open • explore", icon: "🌱" },
  { id: "blank", title: "Blank", desc: "undecided • just nudge me", icon: "🌫️" },
];

const focusCards: Array<{ id: Focus; title: string; desc: string; icon: string }> = [
  { id: "music", title: "Music", desc: "songs, playlists, sound moods", icon: "🎵" },
  { id: "logic", title: "Logic", desc: "clarity, structure, frameworks", icon: "🧠" },
  { id: "art", title: "Art", desc: "visuals, creative inspiration", icon: "🎨" },
  { id: "faith", title: "Faith", desc: "meaning, comfort, reflection", icon: "🕊️" },
  { id: "movement", title: "Movement", desc: "energy, motion, activation", icon: "🏃" },
  { id: "beauty", title: "Beauty", desc: "aesthetic calm, harmony, style", icon: "💄" },
];

export default function App() {
  const [screen, setScreen] = useState<"home" | "state" | "focus" | "result">("home");
  const [state, setState] = useState<State | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  return (
    <div className="kivaw-wrap">
      <div className="kivaw-phone">
        {/* HOME */}
        {screen === "home" && (
          <>
            <h1 style={{ textAlign: "center", margin: 0, fontSize: 38, color: "#5D70AE" }}>
              KIVAW
            </h1>
            <p style={{ textAlign: "center", marginTop: 10, opacity: 0.7 }}>
              Find what fits your mood.
            </p>

            <button
              onClick={() => setScreen("state")}
              style={{
                marginTop: 22,
                width: "100%",
                padding: 14,
                borderRadius: 16,
                background: "#5D70AE",
                color: "white",
                border: "none",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Get Recommendations
            </button>
          </>
        )}

        {/* STATE */}
        {screen === "state" && (
          <>
            <button
              onClick={() => setScreen("home")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                marginBottom: 12,
                color: "rgba(47,59,102,0.8)",
                fontWeight: 700,
              }}
            >
              ← Back
            </button>

            <h2 style={{ marginTop: 0, marginBottom: 6 }}>How are you feeling?</h2>
            <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.7 }}>
              Choose the closest state.
            </p>

            {stateCards.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setState(s.id);
                  setScreen("focus");
                }}
                style={{
                  width: "100%",
                  margin: "10px 0",
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.78)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(233,238,250,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{s.title}</div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>{s.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {/* FOCUS */}
        {screen === "focus" && (
          <>
            <button
              onClick={() => setScreen("state")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                marginBottom: 12,
                color: "rgba(47,59,102,0.8)",
                fontWeight: 700,
              }}
            >
              ← Back
            </button>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(233,238,250,0.85)",
                  fontWeight: 700,
                }}
              >
                State: {state}
              </span>
            </div>

            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Choose your focus</h2>
            <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.7 }}>
              Pick one focus. We’ll match recommendations to your state.
            </p>

            {focusCards.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFocus(f.id);
                  setScreen("result");
                }}
                style={{
                  width: "100%",
                  margin: "10px 0",
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.78)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(233,238,250,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{f.title}</div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>{f.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {/* RESULT */}
        {screen === "result" && (
          <>
            <button
              onClick={() => setScreen("focus")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                marginBottom: 12,
                color: "rgba(47,59,102,0.8)",
                fontWeight: 700,
              }}
            >
              ← Back
            </button>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(233,238,250,0.85)",
                  fontWeight: 700,
                }}
              >
                State: {state}
              </span>
              <span
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(233,238,250,0.85)",
                  fontWeight: 700,
                }}
              >
                Focus: {focus}
              </span>
            </div>

            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Your Match</h2>

            <p style={{ opacity: 0.75, marginTop: 0, marginBottom: 18 }}>
              You’re in a <b>{state}</b> state, focused on <b>{focus}</b>.
            </p>

            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(0,0,0,0.08)",
                marginBottom: 18,
              }}
            >
              <strong>Recommendation</strong>
              <p style={{ marginTop: 6, fontSize: 14, opacity: 0.8 }}>
                {state && focus ? recommendations[state][focus] : "—"}
              </p>
            </div>

            <button
              onClick={() => setScreen("focus")}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 14,
                background: "#5D70AE",
                color: "white",
                border: "none",
                fontSize: 15,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              Change Focus
            </button>

            <button
              onClick={() => {
                setState(null);
                setFocus(null);
                setScreen("home");
              }}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 14,
                background: "transparent",
                border: "1px solid rgba(0,0,0,0.15)",
                color: "#2F3B66",
                fontSize: 14,
                opacity: 0.85,
                fontWeight: 800,
              }}
            >
              ← Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
