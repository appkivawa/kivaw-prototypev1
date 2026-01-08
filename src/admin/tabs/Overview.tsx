import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

type Stats = {
  users: number;
  saves: number;
  echoes: number;
  waves: number;
  contentItems: number;
  recentUsers: number;
};

type WorkingFailing = {
  top_states_this_week: Array<{ state: string; count: number }>;
  high_bounce_states: Array<{ state: string; bounce_rate: number }>;
  saved_not_echoed: Array<{ content_id: string; title: string; saves: number; echoes: number }>;
  echoed_not_saved: Array<{ content_id: string; title: string; saves: number; echoes: number }>;
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

      let echoesCount = 0;
      try {
        const { count } = await supabase
          .from("echoes")
          .select("*", { count: "exact", head: true });
        echoesCount = count || 0;
      } catch (e) {
        console.warn("Could not get echoes count:", e);
      }

      let wavesCount = 0;
      try {
        const { count } = await supabase
          .from("waves_summary")
          .select("*", { count: "exact", head: true });
        wavesCount = count || 0;
      } catch (e) {
        console.warn("Could not get waves count:", e);
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
        echoes: echoesCount,
        waves: wavesCount,
        contentItems: contentCount,
        recentUsers: 0,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
      setStats({
        users: 0,
        saves: 0,
        echoes: 0,
        waves: 0,
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

      // High bounce states (users who pick state but don't save/echo within 24h)
      // This is simplified - in reality you'd track state selection vs follow-up actions
      const highBounceStates: Array<{ state: string; bounce_rate: number }> = [];
      // Placeholder - would need more sophisticated tracking

      // Content saved but not echoed
      const { data: allSaves } = await supabase
        .from("saves_v2")
        .select("content_id");

      const { data: allEchoes } = await supabase
        .from("echoes")
        .select("content_id");

      const saveCounts: Record<string, number> = {};
      const echoCounts: Record<string, number> = {};

      allSaves?.forEach((s) => {
        if (s.content_id) {
          saveCounts[s.content_id] = (saveCounts[s.content_id] || 0) + 1;
        }
      });

      allEchoes?.forEach((e) => {
        if (e.content_id) {
          echoCounts[e.content_id] = (echoCounts[e.content_id] || 0) + 1;
        }
      });

      const savedNotEchoed: Array<{ content_id: string; title: string; saves: number; echoes: number }> = [];
      const echoedNotSaved: Array<{ content_id: string; title: string; saves: number; echoes: number }> = [];

      // Get content items for saved but not echoed
      const savedIds = Object.keys(saveCounts).filter(
        (id) => (saveCounts[id] || 0) > 0 && (echoCounts[id] || 0) === 0
      );
      if (savedIds.length > 0) {
        const { data: savedContent } = await supabase
          .from("content_items")
          .select("id, title")
          .in("id", savedIds.slice(0, 10));

        savedContent?.forEach((item) => {
          savedNotEchoed.push({
            content_id: item.id,
            title: item.title || "Untitled",
            saves: saveCounts[item.id] || 0,
            echoes: echoCounts[item.id] || 0,
          });
        });
      }

      // Get content items for echoed but not saved
      const echoedIds = Object.keys(echoCounts).filter(
        (id) => (echoCounts[id] || 0) > 0 && (saveCounts[id] || 0) === 0
      );
      if (echoedIds.length > 0) {
        const { data: echoedContent } = await supabase
          .from("content_items")
          .select("id, title")
          .in("id", echoedIds.slice(0, 10));

        echoedContent?.forEach((item) => {
          echoedNotSaved.push({
            content_id: item.id,
            title: item.title || "Untitled",
            saves: saveCounts[item.id] || 0,
            echoes: echoCounts[item.id] || 0,
          });
        });
      }

      setWorkingFailing({
        top_states_this_week: topStates,
        high_bounce_states: highBounceStates,
        saved_not_echoed: savedNotEchoed.slice(0, 5),
        echoed_not_saved: echoedNotSaved.slice(0, 5),
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

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🫧</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{stats.echoes.toLocaleString()}</div>
            <div className="admin-stat-label">Echoes</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🌊</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{stats.waves.toLocaleString()}</div>
            <div className="admin-stat-label">Waves</div>
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

            {/* Content Saved But Not Echoed */}
            {workingFailing.saved_not_echoed.length > 0 && (
              <div>
                <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
                  ⚠️ Saved But Not Echoed
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {workingFailing.saved_not_echoed.map((item) => (
                    <div
                      key={item.content_id}
                      style={{
                        padding: "10px 14px",
                        background: "var(--white-75)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {item.saves} saves • {item.echoes} echoes
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Echoed But Not Saved */}
            {workingFailing.echoed_not_saved.length > 0 && (
              <div>
                <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
                  📖 Echoed But Not Saved
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {workingFailing.echoed_not_saved.map((item) => (
                    <div
                      key={item.content_id}
                      style={{
                        padding: "10px 14px",
                        background: "var(--white-75)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {item.saves} saves • {item.echoes} echoes
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workingFailing.top_states_this_week.length === 0 &&
              workingFailing.saved_not_echoed.length === 0 &&
              workingFailing.echoed_not_saved.length === 0 && (
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

