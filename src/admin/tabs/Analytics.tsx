import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

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

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadAnalytics();
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
        <button className="btn btn-ghost" type="button" onClick={loadAnalytics}>
          🔄 Refresh
        </button>
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
    </div>
  );
}
