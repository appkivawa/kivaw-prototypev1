import { useNavigate } from "react-router-dom";

export default function QuizResult() {
  const navigate = useNavigate();

  const state = localStorage.getItem("state") || "blank";
  const focus = localStorage.getItem("focus") || "faith";

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          background: "var(--card)",
          borderRadius: 24,
          padding: 28,
          boxShadow: "var(--shadow)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img src="/kivaw-logo.png" alt="Kivaw" width={80} />
        </div>

        <div style={{ textAlign: "center", fontSize: 18 }}>
          You’re currently in a{" "}
          <span style={{ color: "var(--primary)", fontWeight: 500 }}>
            {state}
          </span>{" "}
          state, drawn toward{" "}
          <span style={{ color: "var(--primary)", fontWeight: 500 }}>
            {focus}
          </span>.
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 6,
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          Quiet grounding presence.
        </div>

        <button
          style={{
            width: "100%",
            marginTop: 20,
            padding: 14,
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(90deg,#5d70ae,#6f83cf)",
            color: "white",
            cursor: "pointer",
          }}
          onClick={() => navigate("/quiz/focus")}
        >
          Try another focus
        </button>

        <button
          style={{
            width: "100%",
            marginTop: 10,
            padding: 14,
            borderRadius: 999,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text)",
            cursor: "pointer",
          }}
          onClick={() => navigate("/")}
        >
          ← Home
        </button>
      </div>
    </div>
  );
}



