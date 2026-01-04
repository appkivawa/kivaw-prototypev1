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

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

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

      <div className="admin-actions-bar">
        <button className="btn" type="button" onClick={refreshStats}>
          🔄 Refresh Stats
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
          ← Back to Site
        </button>
      </div>
    </div>
  );
}

