import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { listWavesFeed, type WavesFeedItem } from "../data/wavesApi";

type MoodKey = "blank" | "destructive" | "expansive" | "minimize";

type Mood = {
  key: MoodKey;
  label: string;
  desc: string;
  emoji: string;
};

const MOODS: Mood[] = [
  { key: "blank", label: "Blank", desc: "Need to zone out and reset", emoji: "☁️" },
  { key: "destructive", label: "Destructive", desc: "Need to release energy", emoji: "🔥" },
  { key: "expansive", label: "Expansive", desc: "Want to grow and explore", emoji: "🌱" },
  { key: "minimize", label: "Minimize", desc: "Need simplicity and calm", emoji: "🌙" },
];

const LAST_STATE_KEY = "kivaw_last_state";

function getGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeOfDayLabel(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function moodLabelFromKey(key?: string | null) {
  const m = MOODS.find((x) => x.key === key);
  return m ? m.label : null;
}

function uniqByTitle(items: WavesFeedItem[]) {
  const seen = new Set<string>();
  const out: WavesFeedItem[] = [];
  for (const it of items) {
    const t = (it.content?.title || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
    if (out.length >= 5) break;
  }
  return out;
}

export default function Home() {
  const nav = useNavigate();

  const [lastState, setLastState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_STATE_KEY);
    } catch {
      return null;
    }
  });

  const [trend, setTrend] = useState<WavesFeedItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const tod = useMemo(() => timeOfDayLabel(), []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setTrendLoading(true);
        const feed = await listWavesFeed(60);
        // feed is already ordered by last_used_at desc
        const unique = uniqByTitle(feed);
        if (alive) setTrend(unique.slice(0, 3));
      } catch {
        if (alive) setTrend([]);
      } finally {
        if (alive) setTrendLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const lastStateLabel = moodLabelFromKey(lastState);

  const onPickMood = (m: Mood) => {
    try {
      localStorage.setItem(LAST_STATE_KEY, m.key);
      sessionStorage.setItem("kivaw_state", m.key);
    } catch {}
    setLastState(m.key);
    nav(`/quiz/focus?state=${m.key}`);
  };

  // “Real usage stats” chips (based on waves_summary counts)
  const chip1 =
    trend[0]?.content?.title && typeof trend[0].uses === "number"
      ? `📈 ${trend[0].content.title} — ${trend[0].uses} uses`
      : `📈 Trending right now`;

  const chip2 = `🕒 Most active ${tod}`;

  const chip3 =
    trend[1]?.content?.title && typeof trend[1].uses === "number"
      ? `✨ ${trend[1].content.title} keeps showing up (${trend[1].uses})`
      : `✨ Recurring favorite`;

  return (
    <div className="homev2">
      <div className="homev2__bg" />

      <div className="homev2__wrap">
        {/* Top “features” row (Kivaw-styled) */}
        <div className="homev2__top">
          <div>
            <h2 className="homev2__greet">
              {greeting} <span aria-hidden>✨</span>
            </h2>

            <p className="homev2__lead">
              {lastStateLabel ? (
                <>
                  Last time you felt{" "}
                  <span className="homev2__state">{lastStateLabel}</span>. How about now?
                </>
              ) : (
                <>How about right now?</>
              )}
            </p>

            <div className="homev2__chipRow" aria-label="Live usage highlights">
              <span className="chip">{trendLoading ? "Loading…" : chip1}</span>
              <span className="chip">{chip2}</span>
              <span className="chip">{trendLoading ? "Loading…" : chip3}</span>
            </div>
          </div>

          <div className="homev2__moonFloat" aria-hidden>
            🌙
          </div>
        </div>

        {/* Main question (keep your Kivaw center vibe) */}
        <div className="homev2__header">
          <h1 className="homev2__title">What would you like to do right now?</h1>
          <p className="homev2__subtitle">We&apos;ll help you find something that fits your energy.</p>
        </div>

        <Card className="homev2__card">
          <div className="homev2__moods">
            {MOODS.map((m) => (
              <button
                key={m.key}
                className="homev2__mood"
                onClick={() => onPickMood(m)}
                type="button"
              >
                <div className="homev2__moodEmoji" aria-hidden>
                  {m.emoji}
                </div>
                <div>
                  <div className="homev2__moodTitle">{m.label}</div>
                  <div className="homev2__moodDesc">{m.desc}</div>
                </div>
                <div className="homev2__moodArrow" aria-hidden>
                  →
                </div>
              </button>
            ))}
          </div>

          <div className="homev2__justBrowsing">
            <button
              className="homev2__justBrowsingBtn"
              type="button"
              onClick={() => nav("/explore")}
            >
              ✨ Explore without choosing <span aria-hidden>→</span>
            </button>
          </div>
        </Card>

        <div className="homev2__subcards">
          <button className="homev2__subcard" type="button" onClick={() => nav("/waves")}>
            <div className="homev2__subcardTitle">🌊 What&apos;s working for others</div>
            <div className="homev2__subcardMeta">Live, real-time favorites</div>
          </button>

          <button className="homev2__subcard" type="button" onClick={() => nav("/explore")}>
            <div className="homev2__subcardTitle">🧭 Browse everything</div>
            <div className="homev2__subcardMeta">Explore by category and vibe</div>
          </button>
        </div>
      </div>
    </div>
  );
}























