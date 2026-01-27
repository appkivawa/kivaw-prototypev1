import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";
import RecommendationCover from "../ui/RecommendationCover";
import { supabase } from "../lib/supabaseClient";
import { getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/authUtils";
import { SparkleIcon, TVIcon, BookIcon, MusicIcon } from "../components/icons/ContentIcons";

type PublicRecommendation = {
  id: string;
  title: string;
  type: "watch" | "read" | "event" | "listen";
  source: string;
  url: string | null;
  image_url: string | null;
  description: string | null;
  mood_tags: string[] | null;
  focus_tags: string[] | null;
  published_at: string;
  rank: number;
};

const MOODS = ["all", "reset", "beauty", "logic", "faith", "reflect", "comfort"];
const FOCUSES = ["All", "Watch", "Read"] as const;
type Focus = "All" | "Watch" | "Read";

function stateLabel(tag: string) {
  const t = (tag || "").trim().toLowerCase();
  if (t === "all") return "All";
  if (t === "reset") return "Reset";
  if (t === "beauty") return "Beauty";
  if (t === "logic") return "Logic";
  if (t === "faith") return "Faith";
  if (t === "reflect") return "Reflect";
  if (t === "comfort") return "Comfort";
  return tag;
}

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

const MOOD_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  all: { icon: <SparkleIcon size={16} />, label: "All Moods" },
  reset: { icon: <SparkleIcon size={16} />, label: "Reset" },
  beauty: { icon: <SparkleIcon size={16} />, label: "Beauty" },
  logic: { icon: <SparkleIcon size={16} />, label: "Logic" },
  faith: { icon: <SparkleIcon size={16} />, label: "Faith" },
  reflect: { icon: <SparkleIcon size={16} />, label: "Reflect" },
  comfort: { icon: <SparkleIcon size={16} />, label: "Comfort" },
};

export default function ForYou() {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<PublicRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [selectedFocus, setSelectedFocus] = useState<Focus>("All");

  // Load recommendations
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Check auth
        let uid = await getUserId();
        if (!uid) {
          const authedUid = await requireAuth(navigate, "/for-you");
          if (!authedUid || cancelled) return;
          uid = authedUid;
          setIsAuthed(true);
        } else {
          setIsAuthed(true);
        }

        // Get user's existing signals
        const { data: signalsData } = await supabase
          .from("user_signals")
          .select("recommendation_id")
          .eq("user_id", uid);

        const excludedIds = new Set((signalsData || []).map((s) => s.recommendation_id));

        // Build query
        let query = supabase
          .from("public_recommendations")
          .select("id, title, type, source, url, image_url, description, mood_tags, focus_tags, published_at, rank")
          .order("rank", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(50);

        // Filter by focus
        if (selectedFocus !== "All") {
          query = query.eq("type", selectedFocus.toLowerCase());
        }

        const { data, error } = await query;

        if (error) throw error;

        // Filter out items user has already interacted with
        let filtered = (data || []).filter((item) => !excludedIds.has(item.id));

        // Filter by mood if selected
        if (selectedMood !== "all") {
          filtered = filtered.filter((item) => {
            const moodTags = (item.mood_tags || []).map((t: string) => norm(t));
            return moodTags.includes(norm(selectedMood));
          });
        }

        if (!cancelled) {
          setRecommendations(filtered as PublicRecommendation[]);
          setCurrentIndex(0);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load recommendations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMood, selectedFocus, navigate]);

  const currentItem = recommendations[currentIndex];

  async function handleAction(action: "save" | "pass" | "try") {
    if (!isAuthed || !currentItem) return;

    const uid = await getUserId();
    if (!uid) return;

    try {
      const { error } = await supabase
        .from("user_signals")
        .insert({
          recommendation_id: currentItem.id,
          action: action,
        });

      if (error) {
        // If unique constraint violation, update instead
        if (error.code === "23505") {
          await supabase
            .from("user_signals")
            .delete()
            .eq("recommendation_id", currentItem.id)
            .eq("action", action);

          await supabase
            .from("user_signals")
            .insert({
              recommendation_id: currentItem.id,
              action: action,
            });
        } else {
          console.error("Error saving signal:", error);
        }
      }

      // Advance to next item
      if (currentIndex < recommendations.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // No more items
        setRecommendations([]);
      }
    } catch (err) {
      console.error("Error handling action:", err);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="For You" subtitle="Your personalized recommendations" />
        <div className="center-wrap">
          <Card style={{ padding: 40, textAlign: "center" }}>
            <p className="muted">Loading…</p>
          </Card>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page">
        <PageHeader title="For You" subtitle="Your personalized recommendations" />
        <div className="center-wrap">
          <Card style={{ padding: 40, textAlign: "center" }}>
            <p className="muted">{err}</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="page">
        <PageHeader title="For You" subtitle="Your personalized recommendations" />
        <div className="center-wrap">
          <Card style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px 0" }}>All caught up!</h3>
            <p className="muted" style={{ margin: "0 0 16px 0" }}>
              You've seen all available recommendations. Check back later for more.
            </p>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => navigate("/explore")}
            >
              Browse Explore →
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="For You" subtitle="Your personalized recommendations" />

      <div className="center-wrap">
        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FOCUSES.map((focus) => (
                <button
                  key={focus}
                  type="button"
                  className={`explore-mood-btn ${selectedFocus === focus ? "explore-mood-btn-active" : ""}`}
                  onClick={() => setSelectedFocus(focus)}
                  style={{ fontSize: 13, padding: "6px 12px" }}
                >
                  <span className="explore-mood-emoji" style={{ fontSize: 14 }}>
                    {focus === "All" ? <SparkleIcon size={14} /> : focus === "Watch" ? <TVIcon size={14} /> : <BookIcon size={14} />}
                  </span>
                  <span className="explore-mood-label">{focus}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {MOODS.map((m) => {
                const config = MOOD_CONFIG[m] || { icon: <SparkleIcon size={16} />, label: stateLabel(m) };
                return (
                  <button
                    key={m}
                    type="button"
                    className={`explore-mood-btn ${selectedMood === m ? "explore-mood-btn-active" : ""}`}
                    onClick={() => setSelectedMood(m)}
                    style={{ fontSize: 13, padding: "6px 12px" }}
                  >
                    <span className="explore-mood-emoji" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{config.icon}</span>
                    <span className="explore-mood-label">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Current Card */}
        <Card style={{ maxWidth: 500, margin: "0 auto", padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <RecommendationCover
              type={currentItem.type}
              imageUrl={currentItem.image_url}
              title={currentItem.title}
              height={200}
              showImage={false}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="kivaw-meta-pill">{currentItem.type === "watch" ? "Watch" : currentItem.type === "read" ? "Read" : currentItem.type}</span>
              {currentItem.source === "tmdb" ? (
                <>
                  <span className="kivaw-meta-dot">•</span>
                  <span className="kivaw-meta-soft">Movie</span>
                </>
              ) : currentItem.source === "open_library" ? (
                <>
                  <span className="kivaw-meta-dot">•</span>
                  <span className="kivaw-meta-soft">Book</span>
                </>
              ) : null}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px 0" }}>{currentItem.title}</h2>
            {currentItem.description && (
              <p style={{ fontSize: 14, color: "var(--text2)", margin: 0, lineHeight: 1.5 }}>
                {currentItem.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => handleAction("pass")}
              style={{ fontSize: 14, padding: "10px 20px" }}
            >
              ✖️ Pass
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => handleAction("save")}
              style={{ fontSize: 14, padding: "10px 20px" }}
            >
              ❤️ Save
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => handleAction("try")}
              style={{ fontSize: 14, padding: "10px 20px" }}
            >
              ⭐ Try tonight
            </button>
          </div>

          {/* Progress indicator */}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>
              {currentIndex + 1} of {recommendations.length}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

