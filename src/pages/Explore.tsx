import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listContentItems, type ContentItem } from "../data/contentApi";
import { fetchSavedIds, saveItem, unsaveItem } from "../data/savesApi";

import { isPublicDiscoverableContentItem } from "../utils/contentFilters";

import { fetchActivities, getRecommendations } from "../lib/recommend";
import type { RecommendationInput, RecommendationResult } from "../types/recommendations";

export default function Explore() {
  const navigate = useNavigate();

  // -----------------------------
  // Explore feed state
  // -----------------------------
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // -----------------------------
  // Recommendations state
  // -----------------------------
  const [recs, setRecs] = useState<RecommendationResult[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState("");

  const [mood, setMood] = useState<RecommendationInput["mood"]>("minimize");
  const [energy, setEnergy] = useState<RecommendationInput["energy"]>("low");
  const [social, setSocial] = useState<RecommendationInput["social"]>("solo");
  const [budget, setBudget] = useState<RecommendationInput["budget"]>("free");
  const [timeAvailable, setTimeAvailable] = useState<number>(30);

  const recInput = useMemo<RecommendationInput>(() => {
    return { mood, energy, social, budget, timeAvailable };
  }, [mood, energy, social, budget, timeAvailable]);

  // -----------------------------
  // Load Explore content (PUBLIC)
  // -----------------------------
  useEffect(() => {
    let alive = true;

    async function loadFeed() {
      setLoading(true);
      setErr("");

      try {
        // Your contentApi expects an options object
        const all = await listContentItems({
          limit: 60,
        });

        const visible = all.filter(isPublicDiscoverableContentItem);

        if (!alive) return;
        setItems(visible);

        // Saved items: only works when logged in.
        // If not logged in, fetchSavedIds() may throw — we just ignore.
        try {
          const ids = await fetchSavedIds();
          if (!alive) return;
          setSavedIds(new Set(ids));
        } catch {
          if (!alive) return;
          setSavedIds(new Set());
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load Explore feed.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadFeed();
    return () => {
      alive = false;
    };
  }, []);

  // -----------------------------
  // Load + compute recommendations
  // -----------------------------
  useEffect(() => {
    let alive = true;

    async function loadRecs() {
      setRecsLoading(true);
      setRecsError("");

      try {
        const activities = await fetchActivities();
        if (!alive) return;

        const scored = getRecommendations(activities, recInput);
        setRecs(scored);
      } catch (e: any) {
        if (!alive) return;
        setRecsError(e?.message ?? "Failed to load recommendations.");
        setRecs([]);
      } finally {
        if (!alive) return;
        setRecsLoading(false);
      }
    }

    loadRecs();
    return () => {
      alive = false;
    };
  }, [recInput]);

  // -----------------------------
  // Save / unsave
  // -----------------------------
  async function toggleSave(itemId: string) {
    const next = new Set(savedIds);

    try {
      if (next.has(itemId)) {
        await unsaveItem(itemId);
        next.delete(itemId);
      } else {
        await saveItem(itemId);
        next.add(itemId);
      }
      setSavedIds(next);
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      // If user isn't signed in, punt them to login
      if (msg.toLowerCase().includes("not logged in") || msg.toLowerCase().includes("auth")) {
        navigate("/login");
        return;
      }

      console.error("Save toggle failed:", e);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      {/* =============================
          RECOMMENDATIONS
         ============================= */}
      <section style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Recommended</h2>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>mood</span>
            <select value={mood} onChange={(e) => setMood(e.target.value as any)}>
              <option value="destructive">destructive</option>
              <option value="blank">blank</option>
              <option value="expansive">expansive</option>
              <option value="minimize">minimize</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>energy</span>
            <select value={energy} onChange={(e) => setEnergy(e.target.value as any)}>
              <option value="low">low</option>
              <option value="med">med</option>
              <option value="high">high</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>social</span>
            <select value={social} onChange={(e) => setSocial(e.target.value as any)}>
              <option value="solo">solo</option>
              <option value="social">social</option>
              <option value="either">either</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>budget</span>
            <select value={budget} onChange={(e) => setBudget(e.target.value as any)}>
              <option value="free">free</option>
              <option value="low">low</option>
              <option value="any">any</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>mins</span>
            <input
              type="number"
              min={5}
              max={240}
              value={timeAvailable}
              onChange={(e) => setTimeAvailable(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </label>
        </div>

        {recsError ? (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid red" }}>{recsError}</div>
        ) : null}

        {recsLoading ? <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div> : null}

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {!recsLoading && !recsError && recs.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No recommendations yet.</div>
          ) : null}

          {recs.map((r) => (
            <div
              key={r.activity.id}
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <b>{r.activity.title}</b>
                <span style={{ opacity: 0.7 }}>• score {r.score}</span>
                <span style={{ opacity: 0.7 }}>• {r.activity.duration_min} min</span>
                <span style={{ opacity: 0.7 }}>• cost {r.activity.cost_level}</span>
                <span style={{ opacity: 0.7 }}>• intensity {r.activity.intensity}</span>
              </div>

              <p style={{ marginTop: 8, marginBottom: 8, opacity: 0.9 }}>
                {r.activity.description}
              </p>

              <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.8 }}>
                {r.reasons.slice(0, 2).map((x, idx) => (
                  <li key={idx}>{x.reason}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* =============================
          CONTENT FEED
         ============================= */}
      <section>
        <h2 style={{ marginTop: 0 }}>Explore feed</h2>

        {err ? (
          <div style={{ padding: 12, border: "1px solid red", marginBottom: 16 }}>
            <b>Error:</b> {err}
          </div>
        ) : null}

        {loading ? <div style={{ opacity: 0.7 }}>Loading…</div> : null}

        {!loading && !err && items.length === 0 ? <div style={{ opacity: 0.7 }}>No content yet.</div> : null}

        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => {
            const isSaved = savedIds.has(item.id);

            return (
              <div
                key={item.id}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ display: "block" }}>{item.title}</b>
                    {item.byline ? <div style={{ opacity: 0.75 }}>{item.byline}</div> : null}
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" style={{ opacity: 0.8 }}>
                        {item.url}
                      </a>
                    ) : null}
                  </div>

                  <button onClick={() => toggleSave(item.id)}>{isSaved ? "Unsave" : "Save"}</button>
                </div>

                {item.meta ? <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.9 }}>{item.meta}</p> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}





