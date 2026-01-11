import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Interest = {
  id: string;
  type: "keyword" | "topic" | "subreddit" | "youtube_channel" | "podcast" | "domain";
  value: string;
  weight: number;
  source_filters: string[] | null;
  muted: boolean;
};

const types: Interest["type"][] = ["keyword", "topic", "subreddit", "youtube_channel", "podcast", "domain"];

export default function Interests() {
  const [items, setItems] = useState<Interest[]>([]);
  const [type, setType] = useState<Interest["type"]>("topic");
  const [value, setValue] = useState("");
  const [weight, setWeight] = useState(0.6);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    const { data, error } = await supabase.from("user_interests").select("*").order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setItems((data ?? []) as Interest[]);
  }

  async function add() {
    setErr("");
    const v = value.trim();
    if (!v) return;

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return setErr("Not logged in");

    const { error } = await supabase.from("user_interests").insert([
      { user_id: userId, type, value: v, weight, source_filters: null, muted: false },
    ]);

    if (error) return setErr(error.message);
    setValue("");
    await load();
  }

  async function toggleMute(id: string, muted: boolean) {
    await supabase.from("user_interests").update({ muted }).eq("id", id);
    await load();
  }

  async function remove(id: string) {
    await supabase.from("user_interests").delete().eq("id", id);
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <h2 style={{ margin: 0 }}>Interests</h2>
      <div style={{ marginTop: 6, opacity: 0.72 }}>
        Teach Kivaw what you care about so your feed stops acting like a random number generator.
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,0,0,0.35)" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "160px 1fr 120px 120px",
          gap: 10,
          alignItems: "center",
        }}
      >
        <select value={type} onChange={(e) => setType(e.target.value as any)} style={{ padding: 10, borderRadius: 12 }}>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Formula 1, r/startups, channel_id:..."
          style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}
        />

        <input
          type="number"
          step="0.1"
          min="0"
          max="1"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}
          title="Weight 0–1"
        />

        <button
          onClick={add}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(255,255,255,0.8)",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <div
            key={it.id}
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(255,255,255,0.68)",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.65 }}>
                {it.type} • weight {it.weight.toFixed(1)} {it.muted ? "• muted" : ""}
              </div>
              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950 }}>
                {it.value}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => toggleMute(it.id, !it.muted)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.8)",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {it.muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={() => remove(it.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.8)",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
