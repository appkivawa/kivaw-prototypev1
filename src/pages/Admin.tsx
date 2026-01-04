import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import { isAdmin } from "../auth/adminAuth";
import { getUserId } from "../data/savesApi";

type Stats = {
  users: number;
  saves: number;
  echoes: number;
  waves: number;
  contentItems: number;
  recentUsers: number;
};

type User = {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string;
  updated_at?: string;
};

type ContentItem = {
  id: string;
  title: string;
  kind: string;
  created_at: string;
};

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "content" | "analytics">("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [usersError, setUsersError] = useState<string>("");
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<{
    userGrowth: { date: string; count: number }[];
    engagement: { date: string; saves: number; echoes: number }[];
    recentActivity: any[];
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"users" | "content" | "activity">("users");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // System Settings state
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowSignups: true,
    maxContentItems: 1000,
    enableAnalytics: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        // Check if user is signed in first
        const userId = await getUserId();
        if (!userId) {
          if (!alive) return;
          navigate("/login");
          return;
        }

        if (!alive) return;
        setUserId(userId);

        // Check admin access (but don't redirect immediately - show error if not admin)
        const isUserAdmin = await isAdmin();
        if (!isUserAdmin) {
          // Check if table exists
          const { error: tableError } = await supabase
            .from("admin_users")
            .select("user_id")
            .limit(1);

          if (tableError && (tableError.code === "42P01" || tableError.message?.includes("does not exist"))) {
            setErr(
              "Admin table does not exist. Please run the SQL migration: supabase/migrations/create_admin_users.sql"
            );
          } else {
            setErr(
              "You do not have admin access. Your user ID: " + userId + ". Add this ID to the admin_users table to grant access."
            );
          }
          if (!alive) return;
          setLoading(false);
          return;
        }

        // User is admin - load stats
        console.log("User is admin, loading stats...");
        await loadStats();
        console.log("Stats loaded, current stats state:", stats);

        if (!alive) return;
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Admin load failed.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  async function loadStats() {
    try {
      // Get user count - try profiles table first
      let userCount = 0;
      try {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        userCount = count || 0;
      } catch (e) {
        console.warn("Could not get user count:", e);
      }

      // Get saves count
      let savesCount = 0;
      try {
        const { count } = await supabase
          .from("saves_v2")
          .select("*", { count: "exact", head: true });
        savesCount = count || 0;
      } catch (e) {
        console.warn("Could not get saves count:", e);
      }

      // Get echoes count
      let echoesCount = 0;
      try {
        const { count } = await supabase
          .from("echoes")
          .select("*", { count: "exact", head: true });
        echoesCount = count || 0;
      } catch (e) {
        console.warn("Could not get echoes count:", e);
      }

      // Get waves count
      let wavesCount = 0;
      try {
        const { count } = await supabase
          .from("waves_summary")
          .select("*", { count: "exact", head: true });
        wavesCount = count || 0;
      } catch (e) {
        console.warn("Could not get waves count:", e);
      }

      // Get content items count
      let contentCount = 0;
      try {
        const { count } = await supabase
          .from("content_items")
          .select("*", { count: "exact", head: true });
        contentCount = count || 0;
      } catch (e) {
        console.warn("Could not get content count:", e);
      }

      const newStats = {
        users: userCount,
        saves: savesCount,
        echoes: echoesCount,
        waves: wavesCount,
        contentItems: contentCount,
        recentUsers: 0, // TODO: Calculate recent users
      };
      console.log("Setting stats:", newStats);
      setStats(newStats);
    } catch (error: any) {
      console.error("Error loading stats:", error);
      // Fallback: try edge function if available
      try {
        const { data: sessData } = await supabase.auth.getSession();
        const token = sessData.session?.access_token;
        if (token) {
          const { data, error } = await supabase.functions.invoke("admin-stats", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!error && data) {
            setStats((data as any)?.stats || null);
          } else {
            // Set default stats if everything fails
            const defaultStats = {
              users: 0,
              saves: 0,
              echoes: 0,
              waves: 0,
              contentItems: 0,
              recentUsers: 0,
            };
            console.log("Setting default stats (edge function failed):", defaultStats);
            setStats(defaultStats);
          }
        } else {
          // Set default stats if no session
          const defaultStats = {
            users: 0,
            saves: 0,
            echoes: 0,
            waves: 0,
            contentItems: 0,
            recentUsers: 0,
          };
          console.log("Setting default stats (no session):", defaultStats);
          setStats(defaultStats);
        }
      } catch (e) {
        console.error("Edge function also failed:", e);
        // Set default stats as last resort
        const defaultStats = {
          users: 0,
          saves: 0,
          echoes: 0,
          waves: 0,
          contentItems: 0,
          recentUsers: 0,
        };
        console.log("Setting default stats (catch block):", defaultStats);
        setStats(defaultStats);
      }
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setUsersError(""); // Clear previous errors
    try {
      // Try to load from profiles table first
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, created_at, last_sign_in_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // Check if table doesn't exist
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("Profiles table does not exist");
          setUsersError("The 'profiles' table does not exist. You may need to create it or use an edge function to access user data.");
          setUsers([]);
          return;
        }
        
        // Check if it's a permission/RLS issue
        if (error.code === "42501" || error.message?.includes("permission") || error.message?.includes("RLS")) {
          console.warn("RLS or permission issue accessing profiles");
          setUsersError("Permission denied. The 'profiles' table may have Row Level Security enabled. Consider using an edge function with service role access.");
          setUsers([]);
          return;
        }
        
        throw error;
      }
      
      // Success - set users
      setUsers((data || []) as User[]);
      if ((data || []).length === 0) {
        setUsersError("No users found in the profiles table.");
      }
    } catch (error: any) {
      console.error("Error loading users:", error);
      const errorMsg = error?.message || "Unknown error";
      
      // Provide more specific error messages
      if (errorMsg.includes("does not exist")) {
        setUsersError("The 'profiles' table does not exist. Create a profiles table or use an edge function to access user data.");
      } else if (errorMsg.includes("permission") || errorMsg.includes("RLS")) {
        setUsersError("Permission denied. You may need to adjust RLS policies or use an edge function with service role access.");
      } else {
        setUsersError(`Could not load users: ${errorMsg}. Consider using an edge function for admin access.`);
      }
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadContent() {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, kind, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setContentItems((data || []) as ContentItem[]);
    } catch (error: any) {
      console.error("Error loading content:", error);
      setErr("Could not load content items.");
    } finally {
      setLoadingContent(false);
    }
  }

  useEffect(() => {
    if (activeTab === "users") {
      // Always try to load users when switching to users tab (if not already loaded or loading)
      if (users.length === 0 && !loadingUsers) {
        loadUsers();
      }
    }
    if (activeTab === "content") {
      if (contentItems.length === 0 && !loadingContent) {
        loadContent();
      }
    }
  }, [activeTab]);

  async function hardResetAuth() {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/admin";
  }

  async function refreshStats() {
    setLoading(true);
    await loadStats();
    setLoading(false);
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true);
    try {
      // Get user growth data (last 30 days by default)
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get user growth
      const { data: userData } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });
      
      // Group by date
      const userGrowthMap = new Map<string, number>();
      (userData || []).forEach((user) => {
        const date = new Date(user.created_at).toISOString().split("T")[0];
        userGrowthMap.set(date, (userGrowthMap.get(date) || 0) + 1);
      });
      
      const userGrowth = Array.from(userGrowthMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Get engagement data (saves and echoes)
      const { data: savesData } = await supabase
        .from("saves_v2")
        .select("created_at")
        .gte("created_at", startDate.toISOString());
      
      const { data: echoesData } = await supabase
        .from("echoes")
        .select("created_at")
        .gte("created_at", startDate.toISOString());
      
      const engagementMap = new Map<string, { saves: number; echoes: number }>();
      
      (savesData || []).forEach((save) => {
        const date = new Date(save.created_at).toISOString().split("T")[0];
        const current = engagementMap.get(date) || { saves: 0, echoes: 0 };
        engagementMap.set(date, { ...current, saves: current.saves + 1 });
      });
      
      (echoesData || []).forEach((echo) => {
        const date = new Date(echo.created_at).toISOString().split("T")[0];
        const current = engagementMap.get(date) || { saves: 0, echoes: 0 };
        engagementMap.set(date, { ...current, echoes: current.echoes + 1 });
      });
      
      const engagement = Array.from(engagementMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Get recent activity
      const { data: recentSaves } = await supabase
        .from("saves_v2")
        .select("created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(10);
      
      const { data: recentEchoes } = await supabase
        .from("echoes")
        .select("created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(10);
      
      const recentActivity = [
        ...(recentSaves || []).map((s) => ({ ...s, type: "save" })),
        ...(recentEchoes || []).map((e) => ({ ...e, type: "echo" })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      
      setAnalyticsData({
        userGrowth,
        engagement,
        recentActivity,
      });
    } catch (error: any) {
      console.error("Error loading analytics:", error);
      setErr("Could not load analytics data.");
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function performSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      if (searchType === "users") {
        const { data } = await supabase
          .from("profiles")
          .select("id, created_at")
          .ilike("id", `%${searchQuery}%`)
          .limit(20);
        setSearchResults(data || []);
      } else if (searchType === "content") {
        const { data } = await supabase
          .from("content_items")
          .select("id, title, kind, created_at")
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .limit(20);
        setSearchResults(data || []);
      } else if (searchType === "activity") {
        // Search both saves and echoes
        const { data: saves } = await supabase
          .from("saves_v2")
          .select("id, created_at, user_id")
          .limit(10);
        
        const { data: echoes } = await supabase
          .from("echoes")
          .select("id, created_at, user_id")
          .limit(10);
        
        const combined = [
          ...(saves || []).map((s) => ({ ...s, type: "save" })),
          ...(echoes || []).map((e) => ({ ...e, type: "echo" })),
        ]
          .filter((item) => item.user_id?.includes(searchQuery) || item.id?.includes(searchQuery))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20);
        
        setSearchResults(combined);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      setErr("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      // In a real app, you'd save these to a settings table or config
      // For now, just store in localStorage
      localStorage.setItem("admin_settings", JSON.stringify(settings));
      alert("Settings saved successfully!");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      setErr("Could not save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => {
    if (activeTab === "analytics" && !analyticsData && !loadingAnalytics) {
      loadAnalytics();
    }
  }, [activeTab, timeRange]);

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem("admin_settings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.warn("Could not load saved settings");
      }
    }
  }, []);

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <div className="admin-header">
            <div>
              <h1 className="admin-title">Admin Dashboard</h1>
              <p className="admin-subtitle">Manage your Kivaw platform</p>
            </div>
            {userId && (
              <div className="admin-user-info">
                <div className="admin-user-label">Signed in as:</div>
                <div className="admin-user-id">{userId}</div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="admin-loading">
              <p className="muted">Loading admin dashboard…</p>
              <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
                Checking permissions and loading stats…
              </p>
            </div>
          ) : err ? (
            <div className="admin-error">
              <div className="echo-alert">
                {err}
                {err.includes("does not exist") && (
                  <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
                    <strong>Setup Required:</strong> Run the SQL migration in{" "}
                    <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>
                      supabase/migrations/create_admin_users.sql
                    </code>{" "}
                    to create the admin_users table. See ADMIN_SETUP.md for instructions.
                  </div>
                )}
              </div>
              <div className="admin-actions">
                <button className="btn" type="button" onClick={refreshStats}>
                Retry
              </button>
              <button className="btn btn-ghost" type="button" onClick={hardResetAuth}>
                  Sign out + reset
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
                Go home →
              </button>
            </div>
            </div>
          ) : !stats ? (
            <div className="admin-error">
              <div className="echo-alert">
                Stats failed to load. Please check your database connection.
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
                  Debug info: loading={String(loading)}, err={err || "none"}, stats={stats ? "loaded" : "null"}
                </div>
              </div>
              <div className="admin-actions">
                <button className="btn" type="button" onClick={refreshStats}>
                  Retry
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
                  Go home →
                </button>
              </div>
                </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="admin-tabs">
                <button
                  className={`admin-tab ${activeTab === "overview" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab("overview")}
                >
                  <span className="admin-tab-icon">📊</span>
                  Overview
                </button>
                <button
                  className={`admin-tab ${activeTab === "users" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setActiveTab("users");
                    // Clear any previous errors when switching to users tab
                    setUsersError("");
                  }}
                >
                  <span className="admin-tab-icon">👥</span>
                  Users
                </button>
                <button
                  className={`admin-tab ${activeTab === "content" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab("content")}
                >
                  <span className="admin-tab-icon">📝</span>
                  Content
                </button>
                <button
                  className={`admin-tab ${activeTab === "analytics" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab("analytics")}
                >
                  <span className="admin-tab-icon">📈</span>
                  Analytics
                </button>
              </div>

              {/* Overview Tab */}
              {activeTab === "overview" && stats && (
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
              )}

              {/* Users Tab */}
              {activeTab === "users" && (
                <div className="admin-users">
                  <div className="admin-section-header">
                    <h3 className="admin-section-title">User Management</h3>
                    <button className="btn btn-ghost" type="button" onClick={loadUsers}>
                      {loadingUsers ? "Loading…" : "🔄 Refresh"}
                    </button>
                  </div>
                  {loadingUsers ? (
                    <p className="muted">Loading users…</p>
                  ) : usersError ? (
                    <div className="admin-error">
                      <div className="echo-alert">
                        {usersError}
                        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
                          <strong>Options to fix:</strong>
                          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                            <li>Create a <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>profiles</code> table that mirrors auth.users</li>
                            <li>Create a Supabase Edge Function with service role access to query auth.users</li>
                            <li>Adjust RLS policies on the profiles table to allow admin access</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : users.length > 0 ? (
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>User ID</th>
                            <th>Created</th>
                            <th>Last Sign In</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id}>
                              <td>{user.email || <span className="muted">No email</span>}</td>
                              <td>
                                <code className="admin-code">{user.id.slice(0, 8)}...</code>
                              </td>
                              <td>{new Date(user.created_at).toLocaleDateString()}</td>
                              <td>
                                {user.last_sign_in_at 
                                  ? new Date(user.last_sign_in_at).toLocaleDateString()
                                  : <span className="muted">Never</span>}
                              </td>
                              <td>
                                <button
                                  className="admin-action-btn"
                                  type="button"
                                  onClick={() => {
                                    // TODO: Implement user actions
                                    alert(`User actions for ${user.id}`);
                                  }}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No users found. User data may require edge function access.</p>
                  )}
              </div>
              )}

              {/* Content Tab */}
              {activeTab === "content" && (
                <div className="admin-content">
                  <div className="admin-section-header">
                    <h3 className="admin-section-title">Content Management</h3>
                    <button className="btn btn-ghost" type="button" onClick={loadContent}>
                      {loadingContent ? "Loading…" : "🔄 Refresh"}
                    </button>
                  </div>
                  {loadingContent ? (
                    <p className="muted">Loading content…</p>
                  ) : contentItems.length > 0 ? (
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Kind</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contentItems.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.title || "Untitled"}</strong>
                              </td>
                              <td>
                                <span className="admin-badge">{item.kind || "Item"}</span>
                              </td>
                              <td>{new Date(item.created_at).toLocaleDateString()}</td>
                              <td>
                                <button
                                  className="admin-action-btn"
                                  type="button"
                                  onClick={() => navigate(`/item/${item.id}`)}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No content items found.</p>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === "analytics" && (
                <div className="admin-analytics">
                  <div className="admin-section-header">
                    <h3 className="admin-section-title">Analytics & Insights</h3>
                    <button className="btn btn-ghost" type="button" onClick={loadAnalytics} disabled={loadingAnalytics}>
                      {loadingAnalytics ? "Loading…" : "🔄 Refresh"}
                    </button>
                  </div>

                  {/* Growth Metrics Section */}
                  <div className="admin-analytics-section">
                    <div className="admin-section-subheader">
                      <h4 className="admin-subsection-title">
                        <span className="admin-section-icon">📊</span>
                        Growth Metrics
                      </h4>
                      <div className="admin-time-range">
                        <button
                          className={`admin-time-btn ${timeRange === "7d" ? "active" : ""}`}
                          type="button"
                          onClick={() => setTimeRange("7d")}
                        >
                          7d
                        </button>
                        <button
                          className={`admin-time-btn ${timeRange === "30d" ? "active" : ""}`}
                          type="button"
                          onClick={() => setTimeRange("30d")}
                        >
                          30d
                        </button>
                        <button
                          className={`admin-time-btn ${timeRange === "90d" ? "active" : ""}`}
                          type="button"
                          onClick={() => setTimeRange("90d")}
                        >
                          90d
                        </button>
                        <button
                          className={`admin-time-btn ${timeRange === "all" ? "active" : ""}`}
                          type="button"
                          onClick={() => setTimeRange("all")}
                        >
                          All
                        </button>
              </div>
                    </div>

                    {loadingAnalytics ? (
                      <p className="muted">Loading analytics…</p>
                    ) : analyticsData ? (
                      <div className="admin-metrics-grid">
                        <Card className="admin-metric-card">
                          <div className="admin-metric-header">
                            <span className="admin-metric-label">User Growth</span>
                            <span className="admin-metric-value">
                              {analyticsData.userGrowth.reduce((sum, d) => sum + d.count, 0)}
                            </span>
                          </div>
                          <div className="admin-metric-chart">
                            {analyticsData.userGrowth.length > 0 ? (
                              <div className="admin-chart-bars">
                                {analyticsData.userGrowth.map((point, i) => {
                                  const max = Math.max(...analyticsData.userGrowth.map((p) => p.count));
                                  const height = max > 0 ? (point.count / max) * 100 : 0;
                                  return (
                                    <div key={i} className="admin-chart-bar" style={{ height: `${height}%` }} title={`${point.date}: ${point.count}`} />
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="muted" style={{ fontSize: 12 }}>No data for this period</p>
                            )}
                          </div>
                        </Card>

                        <Card className="admin-metric-card">
                          <div className="admin-metric-header">
                            <span className="admin-metric-label">Engagement</span>
                            <span className="admin-metric-value">
                              {analyticsData.engagement.reduce((sum, d) => sum + d.saves + d.echoes, 0)}
                            </span>
                          </div>
                          <div className="admin-metric-chart">
                            {analyticsData.engagement.length > 0 ? (
                              <div className="admin-chart-bars">
                                {analyticsData.engagement.map((point, i) => {
                                  const max = Math.max(...analyticsData.engagement.map((p) => p.saves + p.echoes));
                                  const height = max > 0 ? ((point.saves + point.echoes) / max) * 100 : 0;
                                  return (
                                    <div key={i} className="admin-chart-bar admin-chart-bar-engagement" style={{ height: `${height}%` }} title={`${point.date}: ${point.saves} saves, ${point.echoes} echoes`} />
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="muted" style={{ fontSize: 12 }}>No data for this period</p>
                            )}
                          </div>
                        </Card>

                        <Card className="admin-metric-card">
                          <div className="admin-metric-header">
                            <span className="admin-metric-label">Recent Activity</span>
                            <span className="admin-metric-value">{analyticsData.recentActivity.length}</span>
                          </div>
                          <div className="admin-activity-list">
                            {analyticsData.recentActivity.slice(0, 5).map((activity, i) => (
                              <div key={i} className="admin-activity-item">
                                <span className="admin-activity-type">{activity.type === "save" ? "💾" : "🫧"}</span>
                                <span className="admin-activity-text">
                                  {activity.type === "save" ? "Save" : "Echo"} by {activity.user_id?.slice(0, 8)}...
                                </span>
                                <span className="admin-activity-time">
                                  {new Date(activity.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Card>
            </div>
          ) : (
                      <p className="muted">No analytics data available.</p>
                    )}
                  </div>

                  {/* Search & Filter Section */}
                  <div className="admin-analytics-section">
                    <h4 className="admin-subsection-title">
                      <span className="admin-section-icon">🔍</span>
                      Search & Filter
                    </h4>
                    <div className="admin-search-wrapper">
                      <div className="admin-search-controls">
                        <div className="admin-search-type">
                          <button
                            className={`admin-search-type-btn ${searchType === "users" ? "active" : ""}`}
                            type="button"
                            onClick={() => setSearchType("users")}
                          >
                            Users
                          </button>
                          <button
                            className={`admin-search-type-btn ${searchType === "content" ? "active" : ""}`}
                            type="button"
                            onClick={() => setSearchType("content")}
                          >
                            Content
                          </button>
                          <button
                            className={`admin-search-type-btn ${searchType === "activity" ? "active" : ""}`}
                            type="button"
                            onClick={() => setSearchType("activity")}
                          >
                            Activity
                          </button>
                        </div>
                        <div className="admin-search-input-wrapper">
                          <input
                            type="text"
                            className="admin-search-input"
                            placeholder={`Search ${searchType}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && performSearch()}
                          />
                          <button className="btn" type="button" onClick={performSearch} disabled={searching}>
                            {searching ? "Searching…" : "Search"}
                          </button>
                        </div>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="admin-search-results">
                          <div className="admin-search-results-header">
                            <span>Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</span>
                            <button className="btn btn-ghost" type="button" onClick={() => setSearchResults([])}>
                              Clear
                            </button>
                          </div>
                          <div className="admin-search-results-list">
                            {searchResults.map((result, i) => (
                              <Card key={i} className="admin-search-result-item">
                                {searchType === "users" && (
                                  <>
                                    <div className="admin-search-result-id">
                                      <code>{result.id}</code>
                                    </div>
                                    <div className="admin-search-result-meta">
                                      Joined: {new Date(result.created_at).toLocaleDateString()}
                                    </div>
                                  </>
                                )}
                                {searchType === "content" && (
                                  <>
                                    <div className="admin-search-result-title">{result.title || "Untitled"}</div>
                                    <div className="admin-search-result-meta">
                                      <span className="admin-badge">{result.kind}</span>
                                      {new Date(result.created_at).toLocaleDateString()}
                                    </div>
                                  </>
                                )}
                                {searchType === "activity" && (
                                  <>
                                    <div className="admin-search-result-title">
                                      {result.type === "save" ? "💾 Save" : "🫧 Echo"}
                                    </div>
                                    <div className="admin-search-result-meta">
                                      User: <code>{result.user_id?.slice(0, 8)}...</code>
                                      {" • "}
                                      {new Date(result.created_at).toLocaleDateString()}
                                    </div>
                                  </>
                                )}
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* System Settings Section */}
                  <div className="admin-analytics-section">
                    <h4 className="admin-subsection-title">
                      <span className="admin-section-icon">⚙️</span>
                      System Settings
                    </h4>
                    <Card className="admin-settings-card">
                      <div className="admin-setting-item">
                        <div className="admin-setting-info">
                          <div className="admin-setting-label">Maintenance Mode</div>
                          <div className="admin-setting-desc">Disable public access to the platform</div>
                        </div>
                        <label className="admin-toggle">
                          <input
                            type="checkbox"
                            checked={settings.maintenanceMode}
                            onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                          />
                          <span className="admin-toggle-slider" />
                        </label>
                      </div>

                      <div className="admin-setting-item">
                        <div className="admin-setting-info">
                          <div className="admin-setting-label">Allow New Signups</div>
                          <div className="admin-setting-desc">Enable or disable user registration</div>
                        </div>
                        <label className="admin-toggle">
                          <input
                            type="checkbox"
                            checked={settings.allowSignups}
                            onChange={(e) => setSettings({ ...settings, allowSignups: e.target.checked })}
                          />
                          <span className="admin-toggle-slider" />
                        </label>
                      </div>

                      <div className="admin-setting-item">
                        <div className="admin-setting-info">
                          <div className="admin-setting-label">Max Content Items</div>
                          <div className="admin-setting-desc">Maximum number of content items allowed</div>
                        </div>
                        <input
                          type="number"
                          className="admin-setting-input"
                          value={settings.maxContentItems}
                          onChange={(e) => setSettings({ ...settings, maxContentItems: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      </div>

                      <div className="admin-setting-item">
                        <div className="admin-setting-info">
                          <div className="admin-setting-label">Enable Analytics</div>
                          <div className="admin-setting-desc">Track user behavior and platform metrics</div>
                        </div>
                        <label className="admin-toggle">
                          <input
                            type="checkbox"
                            checked={settings.enableAnalytics}
                            onChange={(e) => setSettings({ ...settings, enableAnalytics: e.target.checked })}
                          />
                          <span className="admin-toggle-slider" />
                        </label>
                      </div>

                      <div className="admin-settings-actions">
                        <button
                          className="btn"
                          type="button"
                          onClick={saveSettings}
                          disabled={savingSettings}
                        >
                          {savingSettings ? "Saving…" : "💾 Save Settings"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => {
                            const saved = localStorage.getItem("admin_settings");
                            if (saved) {
                              setSettings(JSON.parse(saved));
                            }
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}





