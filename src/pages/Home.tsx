import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";

type MoodKey = "blank" | "destructive" | "expansive" | "minimizer";

export default function Home() {
  const navigate = useNavigate();
  const [timeOfDay, setTimeOfDay] = useState<"morning" | "afternoon" | "evening">(
    "evening"
  );

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay("morning");
    else if (hour < 18) setTimeOfDay("afternoon");
    else setTimeOfDay("evening");
  }, []);

  const greetingEmoji = useMemo(() => {
    if (timeOfDay === "morning") return "☀️";
    if (timeOfDay === "afternoon") return "🌤️";
    return "🌙";
  }, [timeOfDay]);

  const moods: Array<{
    key: MoodKey;
    emoji: string;
    label: string;
    description: string;
  }> = useMemo(
    () => [
      { key: "blank", emoji: "☁️", label: "Blank", description: "Need to zone out" },
      {
        key: "destructive",
        emoji: "🔥",
        label: "Destructive",
        description: "Need to release energy",
      },
      { key: "expansive", emoji: "🌱", label: "Expansive", description: "Want to grow" },
      // ✅ label updated, key unchanged
      { key: "minimizer", emoji: "🌙", label: "Minimize", description: "Need simplicity" },
    ],
    []
  );

  function chooseMood(mood: MoodKey) {
    sessionStorage.setItem("kivaw_state", mood);
    // send them straight to focus selection since state is now chosen
    navigate("/quiz/focus");
  }

  return (
    <div className="page homev2">
      <div className="homev2__wrap">
        {/* Header */}
        <header className="homev2__header">
          <div className="homev2__greeting" aria-hidden="true">
            {greetingEmoji}
          </div>

          <h1 className="homev2__title">What would you like to do right now?</h1>
          <p className="homev2__sub">
            We&apos;ll help you find something that fits your energy.
          </p>
        </header>

        {/* Mood picker */}
        <Card className="homev2__card">
          <div className="homev2__moods" role="list">
            {moods.map((m) => (
              <button
                key={m.key}
                type="button"
                className="homev2__mood"
                onClick={() => chooseMood(m.key)}
              >
                <span className="homev2__moodLeft">
                  <span className="homev2__moodEmoji" aria-hidden="true">
                    {m.emoji}
                  </span>

                  <span className="homev2__moodText">
                    <span className="homev2__moodLabel">{m.label}</span>
                    <span className="homev2__moodDesc">{m.description}</span>
                  </span>
                </span>

                <span className="homev2__moodArrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="homev2__skip"
            onClick={() => navigate("/explore")}
          >
            Just browsing →
          </button>
        </Card>

        {/* Secondary actions */}
        <div className="homev2__actions">
          <button
            type="button"
            className="homev2__actionCard"
            onClick={() => navigate("/waves")}
          >
            <div className="homev2__actionTop">
              <span className="homev2__actionEmoji" aria-hidden="true">
                🌊
              </span>
              <span className="homev2__actionTitle">What&apos;s working for others</span>
            </div>
            <div className="homev2__actionSub">Live, real-time favorites</div>
          </button>

          {/* ✅ keep this button */}
          <button
            type="button"
            className="homev2__actionCard"
            onClick={() => navigate("/explore")}
          >
            <div className="homev2__actionTop">
              <span className="homev2__actionEmoji" aria-hidden="true">
                🧭
              </span>
              <span className="homev2__actionTitle">Browse everything</span>
            </div>
            <div className="homev2__actionSub">Explore by category and vibe</div>
          </button>
        </div>
      </div>
    </div>
  );
}






















