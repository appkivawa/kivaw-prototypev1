import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { logAdminAction } from "../auditLog";
import * as XLSX from "xlsx";

type DailyActivity = {
  date: string;
  saves: number;
  total: number;
};

type AnalyticsData = {
  totalSaves: number;
  dailyActivity: DailyActivity[];
};

type StateHealth = {
  state: string;
  total_users: number;
  second_action_rate: number; // % who take a second action
  return_within_24h_rate: number; // % who return within 24h
  avg_engagement_score: number; // simplified metric
};

import { useRoles } from "../../auth/useRoles";
import { canManage } from "../permissions";

export default function Analytics() {
  const { roleKeys, isSuperAdmin } = useRoles();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [stateHealth, setStateHealth] = useState<StateHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStateHealth, setLoadingStateHealth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Operations role can only view (read-only), cannot manage
  const canManageAnalytics = canManage(roleKeys, isSuperAdmin || false, "analytics");

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      // Get total counts
      const { count: totalSaves } = await supabase
        .from("saves_v2")
        .select("*", { count: "exact", head: true });

      // Get daily activity for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = sevenDaysAgo.toISOString().split("T")[0];

      // Fetch saves for last 7 days
      const { data: savesData } = await supabase
        .from("saves_v2")
        .select("created_at")
        .gte("created_at", startDate);

      // Group by date
      const activityMap = new Map<string, { saves: number }>();

      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        activityMap.set(dateStr, { saves: 0 });
      }

      // Count saves by date
      (savesData || []).forEach((save) => {
        const date = new Date(save.created_at).toISOString().split("T")[0];
        const existing = activityMap.get(date);
        if (existing) {
          existing.saves++;
        } else {
          activityMap.set(date, { saves: 1 });
        }
      });

      // Convert to array and sort by date
      const dailyActivity: DailyActivity[] = Array.from(activityMap.entries())
        .map(([date, counts]) => ({
          date,
          saves: counts.saves,
          total: counts.saves,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        totalSaves: totalSaves || 0,
        dailyActivity,
      });
    } catch (e: any) {
      console.error("Error loading analytics:", e);
      setError(e?.message || "Could not load analytics data.");
      setData({
        totalSaves: 0,
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

          // Get users who took a second action (saved after state selection)
          const { data: savesData } = await supabase
            .from("saves_v2")
            .select("user_id, created_at")
            .in("user_id", userIds);

          const usersWithSecondAction = new Set<string>();
          (savesData || []).forEach((action) => {
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

          // Calculate average engagement (saves per user)
          const totalSaves = savesData?.length || 0;
          const avgEngagement = users.length > 0 ? totalSaves / users.length : 0;

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


  async function gatherExportData() {
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

    // Get time-of-day trends (from saves)
    const { data: savesData } = await supabase
      .from("saves_v2")
      .select("created_at");

    const timeOfDayCounts: Record<number, number> = {};
    savesData?.forEach((save) => {
      const hour = new Date(save.created_at).getHours();
      timeOfDayCounts[hour] = (timeOfDayCounts[hour] || 0) + 1;
    });

    const timeOfDayTrends = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: timeOfDayCounts[i] || 0,
    }));

    return {
      export_date: new Date().toISOString(),
      weekly_state_usage: Object.entries(stateUsage).map(([state, count]) => ({
        state,
        user_count: count,
      })),
      top_themes: topThemes,
      time_of_day_trends: timeOfDayTrends,
      summary: {
        total_users: profiles?.length || 0,
        total_saves: savesData?.length || 0,
        most_used_state: Object.entries(stateUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A",
        peak_hour: timeOfDayTrends.sort((a, b) => b.count - a.count)[0]?.hour || null,
      },
    };
  }

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportForReflection(format: "json" | "csv" | "xlsx" = "json") {
    try {
      const exportData = await gatherExportData();
      const dateStr = new Date().toISOString().split("T")[0];

      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        downloadFile(blob, `kivaw-reflection-export-${dateStr}.json`);
      } else if (format === "csv") {
        // Create CSV content
        let csvContent = "Kivaw Reflection Export\n";
        csvContent += `Export Date,${exportData.export_date}\n\n`;

        // Summary
        csvContent += "Summary\n";
        csvContent += `Total Users,${exportData.summary.total_users}\n`;
        csvContent += `Total Saves,${exportData.summary.total_saves}\n`;
        csvContent += `Most Used State,${exportData.summary.most_used_state}\n`;
        csvContent += `Peak Hour,${exportData.summary.peak_hour}\n\n`;

        // Weekly State Usage
        csvContent += "Weekly State Usage\n";
        csvContent += "State,User Count\n";
        exportData.weekly_state_usage.forEach((item) => {
          csvContent += `${item.state},${item.user_count}\n`;
        });
        csvContent += "\n";

        // Top Themes
        csvContent += "Top Themes\n";
        csvContent += "Theme,Count\n";
        exportData.top_themes.forEach((item) => {
          csvContent += `${item.theme},${item.count}\n`;
        });
        csvContent += "\n";

        // Time of Day Trends
        csvContent += "Time of Day Trends\n";
        csvContent += "Hour,Count\n";
        exportData.time_of_day_trends.forEach((item) => {
          csvContent += `${item.hour},${item.count}\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        downloadFile(blob, `kivaw-reflection-export-${dateStr}.csv`);
      } else if (format === "xlsx") {
        // Create workbook
        const wb = XLSX.utils.book_new();

        // Summary sheet
        const summaryData = [
          ["Kivaw Reflection Export"],
          ["Export Date", exportData.export_date],
          [],
          ["Summary"],
          ["Total Users", exportData.summary.total_users],
          ["Total Saves", exportData.summary.total_saves],
          ["Most Used State", exportData.summary.most_used_state],
          ["Peak Hour", exportData.summary.peak_hour],
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

        // Weekly State Usage sheet
        const stateUsageData = [["State", "User Count"], ...exportData.weekly_state_usage.map((item) => [item.state, item.user_count])];
        const stateUsageWs = XLSX.utils.aoa_to_sheet(stateUsageData);
        XLSX.utils.book_append_sheet(wb, stateUsageWs, "State Usage");

        // Top Themes sheet
        const themesData = [["Theme", "Count"], ...exportData.top_themes.map((item) => [item.theme, item.count])];
        const themesWs = XLSX.utils.aoa_to_sheet(themesData);
        XLSX.utils.book_append_sheet(wb, themesWs, "Top Themes");

        // Time of Day Trends sheet
        const timeOfDayData = [["Hour", "Count"], ...exportData.time_of_day_trends.map((item) => [item.hour, item.count])];
        const timeOfDayWs = XLSX.utils.aoa_to_sheet(timeOfDayData);
        XLSX.utils.book_append_sheet(wb, timeOfDayWs, "Time of Day");

        // Write file
        XLSX.writeFile(wb, `kivaw-reflection-export-${dateStr}.xlsx`);
      }

      await logAdminAction("export_reflection", null, { format });
      setShowExportMenu(false);
    } catch (e: any) {
      console.error("Error exporting data:", e);
      alert("Error: " + (e?.message || "Could not export data."));
    }
  }

  useEffect(() => {
    loadAnalytics();
    loadStateHealth();
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-export-menu]')) {
        setShowExportMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

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

  return (
    <div className="admin-analytics">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Analytics & Reporting</h3>
        <div style={{ display: "flex", gap: 8, position: "relative", alignItems: "center" }}>
          {/* Export button - only visible if user can manage analytics */}
          {canManageAnalytics && (
            <div style={{ position: "relative" }} data-export-menu>
              <button
                className="btn"
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                📥 Export for Reflection
              </button>
              {showExportMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 8,
                    background: "var(--white)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 1000,
                    minWidth: 180,
                    padding: 8,
                  }}
                >
                  <button
                    className="admin-action-btn"
                    type="button"
                    onClick={() => exportForReflection("json")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      marginBottom: 4,
                    }}
                  >
                    📄 JSON
                  </button>
                  <button
                    className="admin-action-btn"
                    type="button"
                    onClick={() => exportForReflection("csv")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      marginBottom: 4,
                    }}
                  >
                    📊 CSV
                  </button>
                  <button
                    className="admin-action-btn"
                    type="button"
                    onClick={() => exportForReflection("xlsx")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                    }}
                  >
                    📈 XLSX
                  </button>
                </div>
              )}
            </div>
          )}
          
          {!canManageAnalytics && (
            <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                📖 Read-only mode: You can view analytics but cannot export data.
              </p>
            </div>
          )}
          
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

    </div>
  );
}
