import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { logAdminAction } from "../auditLog";

type DailyActivity = {
  date: string;
  saves: number;
  echoes: number;
  waves: number;
  total: number;
};

type AnalyticsData = {
  totalSaves: number;
  totalEchoes: number;
  totalWaves: number;
  dailyActivity: DailyActivity[];
};

type StateHealth = {
  state: string;
  total_users: number;
  second_action_rate: number; // % who take a second action
  return_within_24h_rate: number; // % who return within 24h
  avg_engagement_score: number; // simplified metric
};

type EchoPattern = {
  time_of_day_distribution: Array<{ hour: number; count: number }>;
  states_most_associated: Array<{ state: string; count: number }>;
  word_count_trends: {
    short: number; // < 100 words
    medium: number; // 100-500 words
    long: number; // > 500 words
  };
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [stateHealth, setStateHealth] = useState<StateHealth[]>([]);
  const [echoPatterns, setEchoPatterns] = useState<EchoPattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStateHealth, setLoadingStateHealth] = useState(false);
  const [loadingEchoPatterns, setLoadingEchoPatterns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      // Get total counts
      const [savesResult, echoesResult, wavesResult] = await Promise.all([
        supabase.from("saves_v2").select("*", { count: "exact", head: true }),
        supabase.from("echoes").select("*", { count: "exact", head: true }),
        supabase.from("waves_events").select("*", { count: "exact", head: true }),
      ]);

      const totalSaves = savesResult.count || 0;
      const totalEchoes = echoesResult.count || 0;
      const totalWaves = wavesResult.count || 0;

      // Get daily activity for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = sevenDaysAgo.toISOString().split("T")[0];

      // Fetch saves for last 7 days
      const { data: savesData } = await supabase
        .from("saves_v2")
        .select("created_at")
        .gte("created_at", startDate);

      // Fetch echoes for last 7 days
      const { data: echoesData } = await supabase
        .from("echoes")
        .select("created_at")
        .gte("created_at", startDate);

      // Fetch waves for last 7 days (from waves_events table)
      const { data: wavesData } = await supabase
        .from("waves_events")
        .select("created_at")
        .gte("created_at", startDate);

      // Group by date
      const activityMap = new Map<string, { saves: number; echoes: number; waves: number }>();

      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        activityMap.set(dateStr, { saves: 0, echoes: 0, waves: 0 });
      }

      // Count saves by date
      (savesData || []).forEach((save) => {
        const date = new Date(save.created_at).toISOString().split("T")[0];
        const existing = activityMap.get(date);
        if (existing) {
          existing.saves++;
        } else {
          activityMap.set(date, { saves: 1, echoes: 0, waves: 0 });
        }
      });

      // Count echoes by date
      (echoesData || []).forEach((echo) => {
        const date = new Date(echo.created_at).toISOString().split("T")[0];
        const existing = activityMap.get(date);
        if (existing) {
          existing.echoes++;
        } else {
          activityMap.set(date, { saves: 0, echoes: 1, waves: 0 });
        }
      });

      // Count waves by date
      (wavesData || []).forEach((wave) => {
        const date = new Date(wave.created_at).toISOString().split("T")[0];
        const existing = activityMap.get(date);
        if (existing) {
          existing.waves++;
        } else {
          activityMap.set(date, { saves: 0, echoes: 0, waves: 1 });
        }
      });

      // Convert to array and sort by date
      const dailyActivity: DailyActivity[] = Array.from(activityMap.entries())
        .map(([date, counts]) => ({
          date,
          saves: counts.saves,
          echoes: counts.echoes,
          waves: counts.waves,
          total: counts.saves + counts.echoes + counts.waves,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        totalSaves,
        totalEchoes,
        totalWaves,
        dailyActivity,
      });
    } catch (e: any) {
      console.error("Error loading analytics:", e);
      setError(e?.message || "Could not load analytics data.");
      setData({
        totalSaves: 0,
        totalEchoes: 0,
        totalWaves: 0,
        dailyActivity: [],
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStateHealth() {
    setLoadingStateHealth(true);
    try {
      // Get all users with their last state
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, last_state, last_sign_in_at, updated_at")
        .not("last_state", "is", null);

      if (!profiles || profiles.length === 0) {
        setStateHealth([]);
        return;
      }

      // Group by state
      const stateGroups: Record<string, any[]> = {};
      profiles.forEach((p) => {
        if (p.last_state) {
          if (!stateGroups[p.last_state]) {
            stateGroups[p.last_state] = [];
          }
          stateGroups[p.last_state].push(p);
        }
      });

      // Calculate health metrics for each state
      const healthData: StateHealth[] = await Promise.all(
        Object.entries(stateGroups).map(async ([state, users]) => {
          const userIds = users.map((u) => u.id);

          // Get users who took a second action (saved or echoed after state selection)
          const [savesResult, echoesResult] = await Promise.all([
            supabase
              .from("saves_v2")
              .select("user_id, created_at")
              .in("user_id", userIds),
            supabase
              .from("echoes")
              .select("user_id, created_at")
              .in("user_id", userIds),
          ]);

          const usersWithSecondAction = new Set<string>();
          [...(savesResult.data || []), ...(echoesResult.data || [])].forEach((action) => {
            usersWithSecondAction.add(action.user_id);
          });

          const secondActionRate =
            users.length > 0 ? (usersWithSecondAction.size / users.length) * 100 : 0;

          // Calculate return within 24h rate
          const now = new Date();
          const usersReturned24h = users.filter((u) => {
            if (!u.last_sign_in_at) return false;
            const lastSignIn = new Date(u.last_sign_in_at);
            const hoursSince = (now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60);
            return hoursSince <= 24;
          }).length;

          const return24hRate = users.length > 0 ? (usersReturned24h / users.length) * 100 : 0;

          // Calculate average engagement (saves + echoes per user)
          const totalSaves = savesResult.data?.length || 0;
          const totalEchoes = echoesResult.data?.length || 0;
          const avgEngagement = users.length > 0 ? (totalSaves + totalEchoes) / users.length : 0;

          return {
            state,
            total_users: users.length,
            second_action_rate: Math.round(secondActionRate * 10) / 10,
            return_within_24h_rate: Math.round(return24hRate * 10) / 10,
            avg_engagement_score: Math.round(avgEngagement * 10) / 10,
          };
        })
      );

      // Sort by total users descending
      healthData.sort((a, b) => b.total_users - a.total_users);
      setStateHealth(healthData);
    } catch (e: any) {
      console.error("Error loading state health:", e);
    } finally {
      setLoadingStateHealth(false);
    }
  }

  async function loadEchoPatterns() {
    setLoadingEchoPatterns(true);
    try {
      // Get all echoes
      const { data: echoes } = await supabase
        .from("echoes")
        .select("id, user_id, content_id, created_at, reflection");

      if (!echoes || echoes.length === 0) {
        setEchoPatterns({
          time_of_day_distribution: [],
          states_most_associated: [],
          word_count_trends: { short: 0, medium: 0, long: 0 },
        });
        return;
      }

      // Time of day distribution
      const hourCounts: Record<number, number> = {};
      echoes.forEach((echo) => {
        const hour = new Date(echo.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const timeDistribution = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourCounts[i] || 0,
      }));

      // States most associated with echoes (from user profiles)
      const userIds = [...new Set(echoes.map((e) => e.user_id).filter(Boolean))];
      const stateCounts: Record<string, number> = {};
      
      if (userIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from("profiles")
          .select("id, last_state")
          .in("id", userIds);

        // Count echoes per state
        userProfiles?.forEach((profile) => {
          if (profile.last_state) {
            const userEchoCount = echoes.filter((e) => e.user_id === profile.id).length;
            stateCounts[profile.last_state] = (stateCounts[profile.last_state] || 0) + userEchoCount;
          }
        });
      }

      const statesMostAssociated = Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([state, count]) => ({ state, count }));

      // Word count trends
      const wordCounts = { short: 0, medium: 0, long: 0 };
      echoes.forEach((echo) => {
        if (echo.reflection) {
          const wordCount = echo.reflection.split(/\s+/).filter((w: string) => w.length > 0).length;
          if (wordCount < 100) {
            wordCounts.short++;
          } else if (wordCount <= 500) {
            wordCounts.medium++;
          } else {
            wordCounts.long++;
          }
        } else {
          wordCounts.short++; // No reflection = short
        }
      });

      setEchoPatterns({
        time_of_day_distribution: timeDistribution,
        states_most_associated: statesMostAssociated,
        word_count_trends: wordCounts,
      });
    } catch (e: any) {
      console.error("Error loading echo patterns:", e);
    } finally {
      setLoadingEchoPatterns(false);
    }
  }

  async function exportForReflection() {
    try {
      // Get weekly state usage
      const { data: profiles } = await supabase
        .from("profiles")
        .select("last_state, updated_at")
        .not("last_state", "is", null);

      const stateUsage: Record<string, number> = {};
      profiles?.forEach((p) => {
        if (p.last_state) {
          stateUsage[p.last_state] = (stateUsage[p.last_state] || 0) + 1;
        }
      });

      // Get top themes (from content items tags/categories)
      const { data: contentItems } = await supabase
        .from("content_items")
        .select("tags, category");

      const themeCounts: Record<string, number> = {};
      contentItems?.forEach((item) => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: string) => {
            themeCounts[tag] = (themeCounts[tag] || 0) + 1;
          });
        }
        if (item.category) {
          themeCounts[item.category] = (themeCounts[item.category] || 0) + 1;
        }
      });

      const topThemes = Object.entries(themeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([theme, count]) => ({ theme, count }));

      // Get time-of-day trends (from echoes)
      const { data: echoes } = await supabase
        .from("echoes")
        .select("created_at");

      const timeOfDayCounts: Record<number, number> = {};
      echoes?.forEach((echo) => {
        const hour = new Date(echo.created_at).getHours();
        timeOfDayCounts[hour] = (timeOfDayCounts[hour] || 0) + 1;
      });

      const timeOfDayTrends = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: timeOfDayCounts[i] || 0,
      }));

      // Create export data (anonymized)
      const exportData = {
        export_date: new Date().toISOString(),
        weekly_state_usage: Object.entries(stateUsage).map(([state, count]) => ({
          state,
          user_count: count,
        })),
        top_themes: topThemes,
        time_of_day_trends: timeOfDayTrends,
        summary: {
          total_users: profiles?.length || 0,
          total_echoes: echoes?.length || 0,
          most_used_state: Object.entries(stateUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A",
          peak_hour: timeOfDayTrends.sort((a, b) => b.count - a.count)[0]?.hour || null,
        },
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kivaw-reflection-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await logAdminAction("export_reflection", null, {});
    } catch (e: any) {
      console.error("Error exporting data:", e);
      alert("Error: " + (e?.message || "Could not export data."));
    }
  }

  useEffect(() => {
    loadAnalytics();
    loadStateHealth();
    loadEchoPatterns();
  }, []);

  if (loading) {
    return <p className="muted">Loading analytics…</p>;
  }

  if (error) {
    return (
      <div className="admin-analytics">
        <div className="echo-alert">{error}</div>
        <button className="btn" type="button" onClick={loadAnalytics}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="muted">No analytics data available.</p>;
  }

  // Calculate totals for the 7-day period
  const sevenDayTotal = data.dailyActivity.reduce((sum, day) => sum + day.total, 0);
  const sevenDaySaves = data.dailyActivity.reduce((sum, day) => sum + day.saves, 0);
  const sevenDayEchoes = data.dailyActivity.reduce((sum, day) => sum + day.echoes, 0);
  const sevenDayWaves = data.dailyActivity.reduce((sum, day) => sum + day.waves, 0);

  return (
    <div className="admin-analytics">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Analytics & Reporting</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button" onClick={exportForReflection}>
            📥 Export for Reflection
          </button>
          <button className="btn btn-ghost" type="button" onClick={loadAnalytics}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="admin-stats-grid" style={{ marginBottom: 24 }}>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">♥</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{data.totalSaves.toLocaleString()}</div>
            <div className="admin-stat-label">Total Saves</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🫧</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{data.totalEchoes.toLocaleString()}</div>
            <div className="admin-stat-label">Total Echoes</div>
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🌊</div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{data.totalWaves.toLocaleString()}</div>
            <div className="admin-stat-label">Total Waves</div>
          </div>
        </Card>
      </div>

      {/* Daily Activity Section */}
      <Card className="admin-section-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">📊</span>
          Daily Activity (Last 7 Days)
        </h4>

        <div style={{ marginBottom: 16 }}>
          <div className="admin-metrics-grid">
            <div className="admin-metric-item">
              <div className="admin-metric-label">Total Activity</div>
              <div className="admin-metric-value">{sevenDayTotal.toLocaleString()}</div>
            </div>
            <div className="admin-metric-item">
              <div className="admin-metric-label">Saves</div>
              <div className="admin-metric-value">{sevenDaySaves.toLocaleString()}</div>
            </div>
            <div className="admin-metric-item">
              <div className="admin-metric-label">Echoes</div>
              <div className="admin-metric-value">{sevenDayEchoes.toLocaleString()}</div>
            </div>
            <div className="admin-metric-item">
              <div className="admin-metric-label">Waves</div>
              <div className="admin-metric-value">{sevenDayWaves.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Daily Activity List */}
        <div className="admin-activity-list">
          {data.dailyActivity.length > 0 ? (
            <table className="admin-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Saves</th>
                  <th>Echoes</th>
                  <th>Waves</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.dailyActivity.map((day) => (
                  <tr key={day.date}>
                    <td>
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>{day.saves}</td>
                    <td>{day.echoes}</td>
                    <td>{day.waves}</td>
                    <td>
                      <strong>{day.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No activity data for the last 7 days.</p>
          )}
        </div>
      </Card>

      {/* State Health Monitor */}
      <div style={{ marginTop: 24 }}>
        <Card className="admin-section-card">
        <div className="admin-section-header">
          <h4 className="admin-subsection-title">
            <span className="admin-section-icon">💚</span>
            State Health Monitor
          </h4>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadStateHealth}
            disabled={loadingStateHealth}
          >
            {loadingStateHealth ? "Loading…" : "🔄 Refresh"}
          </button>
        </div>

        {loadingStateHealth ? (
          <p className="muted">Loading state health data…</p>
        ) : stateHealth.length > 0 ? (
          <div className="admin-table-wrapper" style={{ marginTop: 8 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Total Users</th>
                  <th>Second Action Rate</th>
                  <th>Return Within 24h</th>
                  <th>Avg Engagement</th>
                  <th>Health Status</th>
                </tr>
              </thead>
              <tbody>
                {stateHealth.map((health) => {
                  const isHealthy =
                    health.second_action_rate > 30 && health.return_within_24h_rate > 20;
                  const isWarning =
                    health.second_action_rate < 20 || health.return_within_24h_rate < 10;

                  return (
                    <tr key={health.state}>
                      <td>
                        <span className="admin-badge">{health.state}</span>
                      </td>
                      <td>{health.total_users}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 8,
                              background: "var(--white-75)",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(health.second_action_rate, 100)}%`,
                                height: "100%",
                                background:
                                  health.second_action_rate > 30
                                    ? "#10b981"
                                    : health.second_action_rate > 15
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 45 }}>
                            {health.second_action_rate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 8,
                              background: "var(--white-75)",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(health.return_within_24h_rate, 100)}%`,
                                height: "100%",
                                background:
                                  health.return_within_24h_rate > 20
                                    ? "#10b981"
                                    : health.return_within_24h_rate > 10
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 45 }}>
                            {health.return_within_24h_rate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>{health.avg_engagement_score.toFixed(1)}</td>
                      <td>
                        <span
                          className="admin-badge"
                          style={{
                            background: isHealthy
                              ? "rgba(16, 185, 129, 0.15)"
                              : isWarning
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color: isHealthy ? "#10b981" : isWarning ? "#ef4444" : "#f59e0b",
                            borderColor: isHealthy
                              ? "rgba(16, 185, 129, 0.3)"
                              : isWarning
                                ? "rgba(239, 68, 68, 0.3)"
                                : "rgba(245, 158, 11, 0.3)",
                          }}
                        >
                          {isHealthy ? "✓ Healthy" : isWarning ? "⚠ Needs Attention" : "⚠ Warning"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">📊</div>
            <div className="admin-empty-state-title">No State Data</div>
            <div className="admin-empty-state-desc">
              State health metrics will appear here as users interact with different states.
            </div>
          </div>
        )}
        </Card>
      </div>

      {/* Echo Pattern Analyzer */}
      <div style={{ marginTop: 24 }}>
        <Card className="admin-section-card">
        <div className="admin-section-header">
          <h4 className="admin-subsection-title">
            <span className="admin-section-icon">📖</span>
            Echo Pattern Analyzer
          </h4>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadEchoPatterns}
            disabled={loadingEchoPatterns}
          >
            {loadingEchoPatterns ? "Loading…" : "🔄 Refresh"}
          </button>
        </div>

        {loadingEchoPatterns ? (
          <p className="muted">Loading echo patterns…</p>
        ) : echoPatterns ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Time of Day Distribution */}
            <div>
              <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
                Time of Day Distribution
              </h5>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 4,
                  height: 120,
                  padding: 12,
                  background: "var(--white-75)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                {echoPatterns.time_of_day_distribution.map((item) => {
                  const maxCount = Math.max(
                    ...echoPatterns.time_of_day_distribution.map((i) => i.count),
                    1
                  );
                  const height = (item.count / maxCount) * 100;
                  return (
                    <div
                      key={item.hour}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${height}%`,
                          minHeight: item.count > 0 ? 4 : 0,
                          background: "linear-gradient(180deg, var(--accent), rgba(142,163,255,0.6))",
                          borderRadius: "4px 4px 0 0",
                          transition: "all 0.2s ease",
                        }}
                        title={`${item.hour}:00 - ${item.count} echoes`}
                      />
                      <span style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700 }}>
                        {item.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* States Most Associated */}
            {echoPatterns.states_most_associated.length > 0 && (
              <div>
                <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
                  States Most Associated with Echoes
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {echoPatterns.states_most_associated.map((item) => (
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
                      <span className="admin-badge">{item.state}</span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{item.count} echoes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Word Count Trends */}
            <div>
              <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
                Word Count Trends
              </h5>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div
                  style={{
                    padding: 16,
                    background: "var(--white-75)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", marginBottom: 4 }}>
                    {echoPatterns.word_count_trends.short}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>
                    Short (&lt;100 words)
                  </div>
                </div>
                <div
                  style={{
                    padding: 16,
                    background: "var(--white-75)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", marginBottom: 4 }}>
                    {echoPatterns.word_count_trends.medium}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>
                    Medium (100-500)
                  </div>
                </div>
                <div
                  style={{
                    padding: 16,
                    background: "var(--white-75)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", marginBottom: 4 }}>
                    {echoPatterns.word_count_trends.long}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>
                    Long (&gt;500 words)
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">📖</div>
            <div className="admin-empty-state-title">No Echo Patterns</div>
            <div className="admin-empty-state-desc">
              Echo patterns will appear here as users create echoes.
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  );
}
