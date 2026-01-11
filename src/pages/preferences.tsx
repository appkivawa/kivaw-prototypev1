// pages/preferences.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Source = "rss" | "youtube" | "reddit" | "podcast" | "eventbrite" | "spotify";

type Prefs = {
  sources: Partial<Record<Source, number>>;
  topics: Array<{ key: string; w: number }>;
  blocked_topics: string[];
  length_pref: "short" | "medium" | "long";
};

type DbSourceRow = {
  id: string;
  type: Source;
  name: string | null;       // label
  url: string | null;        // handle/url/keyword/uri
  enabled: boolean | null;   // toggle
  is_active: boolean | null; // optional secondary toggle
  created_at?: string | null;
};

function cleanText(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function Pill(props: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        background: props.active ? "rgba(0,0,0,0.86)" : "rgba(255,255,255,0.75)",
        color: props.active ? "white" : "rgba(0,0,0,0.76)",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {props.children}
    </button>
  );
}

export default function Preferences() {
  const [prefs, setPrefs] = useState<Prefs>({
    sources: { youtube: 1.2, reddit: 1.0, rss: 1.0, spotify: 0.9, eventbrite: 0.9, podcast: 0.8 },
    topics: [{ key: "anime", w: 1.2 }, { key: "startups", w: 1.0 }],
    blocked_topics: [],
    length_pref: "medium",
  });

  const [topicInput, setTopicInput] = useState("");
  const [blockInput, setBlockInput] = useState("");

  // "Follows" are stored in public.sources (your existing schema)
  const [follows, setFollows] = useState<DbSourceRow[]>([]);
  const [followType, setFollowType] = useState<Source>("youtube");
  const [followUrl, setFollowUrl] = useState("");
  const [followLabel, setFollowLabel] = useState("");

  const [msg, setMsg] = useState("");

  const sources: Source[] = ["youtube", "reddit", "rss", "spotify", "eventbrite", "podcast"];
  const topicList = useMemo(() => prefs.topics ?? [], [prefs]);

  async function load() {
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setMsg("Log in to save preferences.");
      return;
    }

    // preferences json
    const { data: prefRow, error: prefErr } = await supabase
      .from("user_preferences")
      .select("prefs")
      .eq("user_id", uid)
      .maybeSingle();

    if (prefErr) setMsg(prefErr.message);
    if (prefRow?.prefs) setPrefs(prefRow.prefs as Prefs);

    // follows: pull from public.sources filtered to current user
    // IMPORTANT: this assumes your sources table has user_id (most setups do).
    // If you don't have user_id on sources yet, tell me and I’ll give you the exact ALTER TABLE + RLS patch.
    const { data: srcs, error: srcErr } = await supabase
      .from("sources")
      .select("id,type,name,url,enabled,is_active,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (srcErr) {
      // If you hit "column user_id does not exist", you need that column for per-user follows.
      setMsg(srcErr.message);
      setFollows([]);
      return;
    }

    setFollows((srcs as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function savePrefs() {
    setMsg("");
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return setMsg("Log in to save preferences.");

    const { error } = await supabase
      .from("user_preferences")
      .upsert([{ user_id: uid, prefs, updated_at: new Date().toISOString() }], { onConflict: "user_id" });

    if (error) return setMsg(error.message);
    setMsg("Saved ✅");
  }

  async function addFollow() {
    setMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return setMsg("Log in to add follows.");

    const url = cleanText(followUrl);
    if (!url) return setMsg("Add a handle / url / keyword first.");

    const payload = {
      user_id: uid,
      type: followType,
      url,
      name: cleanText(followLabel) || null,
      enabled: true,
      is_active: true,
      // config: {} // optional; keep for later
    };

    const { error } = await supabase.from("sources").insert([payload]);
    if (error) return setMsg(error.message);

    setFollowUrl("");
    setFollowLabel("");
    await load();
    setMsg("Added ✅");
  }

  async function toggleFollow(id: string, next: boolean) {
    setMsg("");
    const { error } = await supabase.from("sources").update({ enabled: next }).eq("id", id);
    if (error) setMsg(error.message);
    await load();
  }

  async function removeFollow(id: string) {
    setMsg("");
    const { error } = await supabase.from("sources").delete().eq("id", id);
    if (error) setMsg(error.message);
    await load();
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Preferences</h2>
          <div style={{ marginTop: 6, opacity: 0.72 }}>Tell Kivaw what you actually want.</div>
        </div>

        <button
          onClick={savePrefs}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(255,255,255,0.75)",
            cursor: "pointer",
            fontWeight: 950,
          }}
        >
          Save
        </button>
      </div>

      {msg ? <div style={{ marginTop: 12, opacity: 0.85 }}>{msg}</div> : null}

      {/* Topics */}
      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ fontWeight: 950 }}>Topics you want</div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {topicList.map((t, idx) => (
            <Pill
              key={idx}
              active
              onClick={() => setPrefs((p) => ({ ...p, topics: p.topics.filter((_, i) => i !== idx) }))}
            >
              {t.key} • {t.w.toFixed(1)} ✕
            </Pill>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Add a topic (e.g., anime, startups, skincare)…"
            style={{
              width: 320,
              maxWidth: "72vw",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              outline: "none",
              background: "rgba(255,255,255,0.75)",
            }}
          />
          <button
            onClick={() => {
              const k = cleanText(topicInput);
              if (!k) return;
              setPrefs((p) => ({ ...p, topics: [{ key: k, w: 1.0 }, ...(p.topics ?? [])].slice(0, 24) }));
              setTopicInput("");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 950,
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Blocked */}
      <div
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ fontWeight: 950 }}>Blocked topics</div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(prefs.blocked_topics ?? []).map((t, idx) => (
            <Pill
              key={idx}
              active
              onClick={() => setPrefs((p) => ({ ...p, blocked_topics: p.blocked_topics.filter((_, i) => i !== idx) }))}
            >
              {t} ✕
            </Pill>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            placeholder="Add a blocked topic (e.g., politics, crypto)…"
            style={{
              width: 320,
              maxWidth: "72vw",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              outline: "none",
              background: "rgba(255,255,255,0.75)",
            }}
          />
          <button
            onClick={() => {
              const k = cleanText(blockInput);
              if (!k) return;
              setPrefs((p) => ({ ...p, blocked_topics: [k, ...(p.blocked_topics ?? [])].slice(0, 24) }));
              setBlockInput("");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 950,
            }}
          >
            Block
          </button>
        </div>
      </div>

      {/* Source weights */}
      <div
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ fontWeight: 950 }}>Source mix</div>
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {sources.map((s) => (
            <div
              key={s}
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.75)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75 }}>{s.toUpperCase()}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.1}
                  value={prefs.sources?.[s] ?? 1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPrefs((p) => ({ ...p, sources: { ...(p.sources ?? {}), [s]: v } }));
                  }}
                  style={{ width: "100%" }}
                />
                <div style={{ width: 46, textAlign: "right", fontWeight: 950, opacity: 0.75 }}>
                  {(prefs.sources?.[s] ?? 1).toFixed(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follows */}
      <div
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ fontWeight: 950 }}>Follows</div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={followType}
            onChange={(e) => setFollowType(e.target.value as Source)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
            }}
          >
            <option value="youtube">YouTube (channel id)</option>
            <option value="reddit">Reddit (subreddit)</option>
            <option value="rss">RSS (url)</option>
            <option value="spotify">Spotify (uri)</option>
            <option value="eventbrite">Eventbrite (keyword/city)</option>
            <option value="podcast">Podcast (rss url)</option>
          </select>

          <input
            value={followUrl}
            onChange={(e) => setFollowUrl(e.target.value)}
            placeholder="Handle / URL / keyword"
            style={{
              width: 320,
              maxWidth: "72vw",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              outline: "none",
              background: "rgba(255,255,255,0.75)",
            }}
          />

          <input
            value={followLabel}
            onChange={(e) => setFollowLabel(e.target.value)}
            placeholder="Label (optional)"
            style={{
              width: 220,
              maxWidth: "72vw",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              outline: "none",
              background: "rgba(255,255,255,0.75)",
            }}
          />

          <button
            onClick={addFollow}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 950,
            }}
          >
            Follow
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {follows.length ? (
            follows.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950 }}>
                    {cleanText(f.name) || `${f.type}: ${cleanText(f.url)}`}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7, wordBreak: "break-word" }}>
                    {f.type} • {cleanText(f.url)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill active={Boolean(f.enabled)} onClick={() => toggleFollow(f.id, !Boolean(f.enabled))}>
                    {Boolean(f.enabled) ? "Enabled" : "Disabled"}
                  </Pill>

                  <button
                    onClick={() => removeFollow(f.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.75)",
                      cursor: "pointer",
                      fontWeight: 950,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              Add a few follows and your feed will stop feeling like random internet confetti.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

