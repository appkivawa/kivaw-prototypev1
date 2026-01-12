import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

type Stats = {
  users: number;
  saves: number;
  contentItems: number;
  recentUsers: number;
};

type WorkingFailing = {
  top_states_this_week: Array<{ state: string; count: number }>;
  high_bounce_states: Array<{ state: string; bounce_rate: number }>;
};

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [workingFailing, setWorkingFailing] = useState<WorkingFailing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);

  async function loadStats() {
    try {
      let userCount = 0;
      try {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        userCount = count || 0;
      } catch (e) {
        console.warn("Could not get user count:", e);
      }

      let savesCount = 0;
      try {
        const { count } = await supabase
          .from("saves_v2")
          .select("*", { count: "exact", head: true });
        savesCount = count || 0;
      } catch (e) {
        console.warn("Could not get saves count:", e);
      }

      let contentCount = 0;
      try {
        const { count } = await supabase
          .from("content_items")
          .select("*", { count: "exact", head: true });
        contentCount = count || 0;
      } catch (e) {
        console.warn("Could not get content count:", e);
      }

      setStats({
        users: userCount,
        saves: savesCount,
        contentItems: contentCount,
        recentUsers: 0,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
      setStats({
        users: 0,
        saves: 0,
        contentItems: 0,
        recentUsers: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    loadWorkingFailing();
  }, []);

  async function loadWorkingFailing() {
    setLoadingInsights(true);
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Top 3 states this week
      const { data: recentProfiles } = await supabase
        .from("profiles")
        .select("last_state, updated_at")
        .not("last_state", "is", null)
        .gte("updated_at", oneWeekAgo.toISOString());

      const stateCounts: Record<string, number> = {};
      recentProfiles?.forEach((p) => {
        if (p.last_state) {
          stateCounts[p.last_state] = (stateCounts[p.last_state] || 0) + 1;
        }
      });

      const topStates = Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([state, count]) => ({ state, count }));

      // High bounce states (users who pick state but don't save within 24h)
      // This is simplified - in reality you'd track state selection vs follow-up actions
      const highBounceStates: Array<{ state: string; bounce_rate: number }> = [];
      // Placeholder - would need more sophisticated tracking

      setWorkingFailing({
        top_states_this_week: topStates,
        high_bounce_states: highBounceStates,
      });
    } catch (error: any) {
      console.error("Error loading working/failing insights:", error);
    } finally {
      setLoadingInsights(false);
    }
  }

  async function refreshStats() {
    setLoading(true);
    await loadStats();
    setLoading(false);
  }

  if (loading) {
    return <p className="muted">Loading stats…</p>;
  }

  if (!stats) {
    return <p className="muted">Could not load stats.</p>;
  }

  return (
    <div className="admin-overview">
      <div className="admin-stats-grid">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{stats.users.toLocaleString()}</div>
            <div className="admin-stat-label">Total Users</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">📝</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{stats.contentItems.toLocaleString()}</div>
            <div className="admin-stat-label">Content Items</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">♥</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{stats.saves.toLocaleString()}</div>
            <div className="admin-stat-label">Total Saves</div>
          </div>
        </Card>
      </div>

      {/* What's Working / What's Failing Panel */}
      <div style={{ marginTop: 24 }}>
        <Card className="admin-section-card">
        <div className="admin-section-header">
          <h4 className="admin-subsection-title">
            <span className="admin-section-icon">💡</span>
            What's Working / What's Failing
          </h4>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadWorkingFailing}
            disabled={loadingInsights}
          >
            {loadingInsights ? "Loading…" : "🔄 Refresh"}
          </button>
        </div>

        {loadingInsights ? (
          <p className="muted">Loading insights…</p>
        ) : workingFailing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Top States This Week */}
            {workingFailing.top_states_this_week.length > 0 && (
              <div>
                <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
                  ✅ Top 3 States This Week
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {workingFailing.top_states_this_week.map((item, idx) => (
                    <div
                      key={item.state}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: "var(--white-75)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                        <span className="admin-badge">{item.state}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{item.count} users</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workingFailing.top_states_this_week.length === 0 && (
                <div className="admin-empty-state">
                  <div className="admin-empty-state-icon">📊</div>
                  <div className="admin-empty-state-title">No Insights Yet</div>
                  <div className="admin-empty-state-desc">
                    Insights will appear here as users interact with the platform.
                  </div>
                </div>
              )}
          </div>
        ) : (
          <p className="muted">Could not load insights.</p>
        )}
        </Card>
      </div>

      <div className="admin-actions-bar">
        <button className="btn" type="button" onClick={refreshStats}>
          🔄 Refresh Stats
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => window.location.href = "/team"}>
          ← Back to Site
        </button>
      </div>
    </div>
  );
}

