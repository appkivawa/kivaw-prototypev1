import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Activity = {
  id: string;
  title: string;
  description: string;
  mood: string;
  tags: string[];
  duration_min: number;
  cost_level: number;
  intensity: number;
  created_at: string;
};

const MOODS = [
  { value: "destructive", label: "Destructive" },
  { value: "blank", label: "Blank" },
  { value: "expansive", label: "Expansive" },
  { value: "minimize", label: "Minimize" },
];

export default function RecommendationsPage() {
  const [mood, setMood] = useState<string>("minimize");
  const [tagsInput, setTagsInput] = useState<string>("comfort, solo");
  const [limit, setLimit] = useState<number>(10);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [recs, setRecs] = useState<Activity[]>([]);

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function fetchRecs() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.rpc("get_activity_recommendations", {
      p_mood: mood,
      p_tags: null,
      p_limit: 5,
      p_max_cost: 3,
      p_max_duration: 9999,
      p_max_intensity: 5,
    });
    

    if (error) {
      console.error("RPC error:", error);
      setErrorMsg(error.message ?? "Failed to fetch recommendations.");
      setRecs([]);
      setLoading(false);
      return;
    }

    setRecs(data ?? []);
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 6 }}>KIVAW Recommendations</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Minimal test page. If this works, everything works.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 150px",
          gap: 12,
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <select value={mood} onChange={(e) => setMood(e.target.value)}>
          {MOODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="comfort, solo"
        />

        <button onClick={fetchRecs} disabled={loading}>
          {loading ? "Loading..." : "Get recs"}
        </button>
      </div>

      {errorMsg ? (
        <div style={{ padding: 12, border: "1px solid red", marginBottom: 16 }}>
          <b>Error:</b> {errorMsg}
        </div>
      ) : null}

      {recs.map((a) => (
        <div
          key={a.id}
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.12)",
            marginBottom: 10,
          }}
        >
          <b>{a.title}</b> – {a.description}  
          <br />
          Duration: {a.duration_min} min • Cost Level: {a.cost_level} • Intensity: {a.intensity}
        </div>
      ))}
    </div>
  );
}
