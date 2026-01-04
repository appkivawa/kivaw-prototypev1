import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { listWavesFeed, type WavesFeedItem } from "../data/wavesApi";
import { getLastState, saveLastState } from "../data/userPreferences";
import { getTrendingStats } from "../data/trendingStats";

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

  const [lastState, setLastState] = useState<string | null>(null);
  const [trend, setTrend] = useState<WavesFeedItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendingStats, setTrendingStats] = useState<{
    topTag: { tag: string; count: number } | null;
    mostActiveTime: { time: string; count: number } | null;
    recurringTheme: { title: string; count: number } | null;
  } | null>(null);

  const greeting = useMemo(() => getGreeting(), []);
  const tod = useMemo(() => timeOfDayLabel(), []);

  // Load last state from database/localStorage
  useEffect(() => {
    let alive = true;
    (async () => {
      const state = await getLastState();
      if (alive) setLastState(state);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load trending stats
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stats = await getTrendingStats();
        if (alive) setTrendingStats(stats);
      } catch (e) {
        console.error("Error loading trending stats:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load trending items
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

  const onPickMood = async (m: Mood) => {
    try {
      sessionStorage.setItem("kivaw_state", m.key);
      await saveLastState(m.key);
    } catch {}
    setLastState(m.key);
    nav(`/quiz/focus?state=${m.key}`);
  };

  const onChooseForMe = async () => {
    // Randomly select a mood
    const randomMood = MOODS[Math.floor(Math.random() * MOODS.length)];
    await onPickMood(randomMood);
  };

  // Trending stats chips
  const chip1 = trendingStats?.topTag
    ? `📈 #${trendingStats.topTag.tag} — ${trendingStats.topTag.count} uses`
    : trendLoading
    ? "Loading…"
    : `📈 Trending right now`;

  const chip2 = trendingStats?.mostActiveTime
    ? `🕒 Most active ${trendingStats.mostActiveTime.time}`
    : `🕒 Most active ${tod}`;

  const chip3 = trendingStats?.recurringTheme
    ? `✨ ${trendingStats.recurringTheme.title} keeps showing up (${trendingStats.recurringTheme.count})`
    : trend[1]?.content?.title && typeof trend[1].uses === "number"
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
                  Last time you were feeling{" "}
                  <span className="homev2__state">{lastStateLabel}</span>. What's it like today?
                </>
              ) : (
                <>What's your energy like today?</>
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
          <h1 className="homev2__title">What do you need right now?</h1>
          <p className="homev2__subtitle">No judgment, just options that match where you're at.</p>
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
              onClick={onChooseForMe}
            >
              🎲 Choose for me <span aria-hidden>→</span>
            </button>
            <button
              className="homev2__justBrowsingBtn"
              type="button"
              onClick={() => nav("/explore")}
              style={{ marginTop: 8 }}
            >
              ✨ Or just browse around <span aria-hidden>→</span>
            </button>
          </div>
        </Card>

        <div className="homev2__subcards">
          <button className="homev2__subcard" type="button" onClick={() => nav("/waves")}>
            <div className="homev2__subcardTitle">🌊 What&apos;s working for others</div>
            <div className="homev2__subcardMeta">See what's resonating right now</div>
          </button>

          <button className="homev2__subcard" type="button" onClick={() => nav("/explore")}>
            <div className="homev2__subcardTitle">🧭 Browse everything</div>
            <div className="homev2__subcardMeta">Find something that fits your vibe</div>
          </button>
        </div>
      </div>
    </div>
  );
}























