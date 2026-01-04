import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

type UserJourney = {
  last_state: string | null;
  last_visit: string | null;
  echo_count: number;
  save_count: number;
  most_used_category: string | null;
  most_used_state: string | null;
  total_waves: number;
};

type UserJourneyInspectorProps = {
  userId: string;
  userEmail: string | null;
  onClose: () => void;
};

export default function UserJourneyInspector({
  userId,
  userEmail,
  onClose,
}: UserJourneyInspectorProps) {
  const [journey, setJourney] = useState<UserJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserJourney() {
      setLoading(true);
      setError(null);

      try {
        // Get last state from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("last_state, last_sign_in_at")
          .eq("id", userId)
          .single();

      // Get echo count
      const { data: echoes } = await supabase
        .from("echoes")
        .select("id, created_at")
        .eq("user_id", userId);

      // Get save count
      const { data: saves } = await supabase
        .from("saves_v2")
        .select("id, content_id, created_at")
        .eq("user_id", userId);

      // Get waves count
      const { data: waves } = await supabase
        .from("waves_events")
        .select("id")
        .eq("user_id", userId);

        // Get most used category from saves
        let mostUsedCategory: string | null = null;
        if (saves && saves.length > 0) {
          const contentIds = saves.map((s) => s.content_id).filter(Boolean);
          if (contentIds.length > 0) {
            const { data: contentItems } = await supabase
              .from("content_items")
              .select("category")
              .in("id", contentIds);

            if (contentItems) {
              const categoryCounts: Record<string, number> = {};
              contentItems.forEach((item) => {
                if (item.category) {
                  categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
                }
              });
              mostUsedCategory =
                Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
            }
          }
        }

        // Get most used state from echoes (if they have state field)
        // For now, use last_state from profile as most_used_state
        const mostUsedState = profile?.last_state || null;

        // Get last visit (most recent activity)
        const allDates: string[] = [];
        if (profile?.last_sign_in_at) allDates.push(profile.last_sign_in_at);
        if (echoes) echoes.forEach((e) => allDates.push(e.created_at));
        if (saves) saves.forEach((s) => allDates.push(s.created_at));
        const lastVisit = allDates.length > 0
          ? allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : null;

        setJourney({
          last_state: profile?.last_state || null,
          last_visit: lastVisit,
          echo_count: echoes?.length || 0,
          save_count: saves?.length || 0,
          most_used_category: mostUsedCategory,
          most_used_state: mostUsedState,
          total_waves: waves?.length || 0,
        });
      } catch (e: any) {
        console.error("Error loading user journey:", e);
        setError(e?.message || "Could not load user journey.");
      } finally {
        setLoading(false);
      }
    }

    loadUserJourney();
  }, [userId]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div
          style={{
            maxWidth: 600,
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
          }}
        >
          <Card className="admin-section-card">
        <div className="admin-section-header">
          <div>
            <h3 className="admin-section-title">User Journey</h3>
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              {userEmail || userId.slice(0, 8) + "..."}
            </p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading journey data…</p>
        ) : error ? (
          <div className="echo-alert">{error}</div>
        ) : journey ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="admin-stats-grid">
              <Card className="admin-stat-card">
                <div className="admin-stat-icon">🎯</div>
                <div className="admin-stat-content">
                  <div className="admin-stat-value">
                    {journey.last_state || "—"}
                  </div>
                  <div className="admin-stat-label">Last State Chosen</div>
                </div>
              </Card>

              <Card className="admin-stat-card">
                <div className="admin-stat-icon">📅</div>
                <div className="admin-stat-content">
                  <div className="admin-stat-value" style={{ fontSize: 16 }}>
                    {journey.last_visit
                      ? new Date(journey.last_visit).toLocaleDateString()
                      : "—"}
                  </div>
                  <div className="admin-stat-label">Last Visit</div>
                </div>
              </Card>

              <Card className="admin-stat-card">
                <div className="admin-stat-icon">📖</div>
                <div className="admin-stat-content">
                  <div className="admin-stat-value">{journey.echo_count}</div>
                  <div className="admin-stat-label">Echoes</div>
                </div>
              </Card>

              <Card className="admin-stat-card">
                <div className="admin-stat-icon">🔖</div>
                <div className="admin-stat-content">
                  <div className="admin-stat-value">{journey.save_count}</div>
                  <div className="admin-stat-label">Saves</div>
                </div>
              </Card>

              <Card className="admin-stat-card">
                <div className="admin-stat-icon">🌊</div>
                <div className="admin-stat-content">
                  <div className="admin-stat-value">{journey.total_waves}</div>
                  <div className="admin-stat-label">Waves</div>
                </div>
              </Card>

              <Card className="admin-stat-card">
                <div className="admin-stat-icon">🏷️</div>
                <div className="admin-stat-content">
                  <div className="admin-stat-value" style={{ fontSize: 16 }}>
                    {journey.most_used_category || "—"}
                  </div>
                  <div className="admin-stat-label">Most Used Category</div>
                </div>
              </Card>
            </div>

            {journey.most_used_state && (
              <Card className="admin-section-card">
                <h4 className="admin-subsection-title">
                  <span className="admin-section-icon">📍</span>
                  Most Used State
                </h4>
                <div style={{ marginTop: 12 }}>
                  <span className="admin-badge" style={{ fontSize: 14, padding: "8px 16px" }}>
                    {journey.most_used_state}
                  </span>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <p className="muted">No journey data available.</p>
        )}
          </Card>
        </div>
      </div>
    </div>
  );
}

