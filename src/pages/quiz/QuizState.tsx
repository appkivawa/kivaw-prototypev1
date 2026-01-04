import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";

const STATES = [
  // ✅ key stays "minimizer" (DB + Home), label updated, emoji aligned
  { key: "minimizer", label: "Minimize", emoji: "🌙" },

  // ✅ key updated to match DB + Home
  { key: "destructive", label: "Destructive", emoji: "🔥" },

  // ✅ key updated to match DB + Home, emoji agreed (🌱)
  { key: "expansive", label: "Expansive", emoji: "🌱" },

  // ✅ blank stays blank; emoji aligned to Home vibe (☁️)
  { key: "blank", label: "Blank", emoji: "☁️" },
] as const;

const LENSES = [
  { key: "music", label: "Music" },
  { key: "watch", label: "Watch" },
  { key: "read", label: "Read" },
  { key: "move", label: "Move" },
  { key: "create", label: "Create" },
  { key: "reset", label: "Reset" },
] as const;

export default function QuizState() {
  const navigate = useNavigate();
  const [selectedState, setSelectedState] = useState("");
  const [selectedLens, setSelectedLens] = useState("");

  function handleExplore() {
    if (selectedState && selectedLens) {
      sessionStorage.setItem("kivaw_state", selectedState);
      sessionStorage.setItem("kivaw_focus", selectedLens);
      navigate("/quiz/result");
    }
  }

  return (
    <div className="page quiz-page state-lens-page">
      <div className="center-wrap">
        <div className="state-lens-shell">
          <h1 className="state-lens-header">Pick Your State & Lens</h1>

          <Card className="state-lens-card">
            <h2 className="state-lens-section-title">Select Your Mood</h2>
            <p className="state-lens-instruction">Choose your current state and preferred mood lens.</p>

            <div className="state-lens-dropdowns">
              <div className="state-lens-dropdown-wrapper">
                <label className="state-lens-label">State</label>
                <select
                  className="state-lens-select"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                >
                  <option value="">Select state</option>
                  {STATES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="state-lens-dropdown-wrapper">
                <label className="state-lens-label">Lens</label>
                <select
                  className="state-lens-select"
                  value={selectedLens}
                  onChange={(e) => setSelectedLens(e.target.value)}
                >
                  <option value="">Select lens</option>
                  {LENSES.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              className="state-lens-explore-btn"
              type="button"
              onClick={handleExplore}
              disabled={!selectedState || !selectedLens}
            >
              Explore
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}








