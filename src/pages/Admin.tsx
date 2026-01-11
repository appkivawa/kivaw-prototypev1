// src/pages/admin.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  type: string;
  created_at: string;
};

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();

  const USER_MODE_KEY = "kivaw_user_mode"; // "user" | "admin"

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [userId, setUserId] = useState<string>("");

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "users"
    | "content"
    | "analytics"
    | "operations"
    | "settings"
    | "support"
    | "system"
    | "security"
  >("overview");

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

  // -----------------------------
  // URL <-> tab mapping
  // -----------------------------
  const tabToPath = useMemo(
    () =>
      (
        tab:
          | "overview"
          | "users"
          | "content"
          | "analytics"
          | "operations"
          | "settings"
          | "support"
          | "system"
          | "security"
      ) => (tab === "overview" ? "/admin" : `/admin/${tab}`),
    []
  );

  const pathToTab = useMemo(
    () => (pathname: string) => {
      const rest = pathname.replace(/^\/admin\/?/, "");
      const seg = rest.split("/")[0];

      const valid = new Set([
        "users",
        "content",
        "analytics",
        "operations",
        "settings",
        "support",
        "system",
        "security",
      ]);

      if (!seg) return "overview";
      if (valid.has(seg)) return seg as any;
      return "overview";
    },
    []
  );

  useEffect(() => {
    setActiveTab(pathToTab(location.pathname) as any);
  }, [location.pathname, pathToTab]);

  function enterUserMode() {
    localStorage.setItem(USER_MODE_KEY, "user");
    navigate("/feed", { replace: true });
  }

  function enterAdminMode() {
    localStorage.setItem(USER_MODE_KEY, "admin");
    navigate("/admin", { replace: true });
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const uid = await getUserId();
        if (!uid) {
          if (!alive) return;
          navigate("/login?next=%2Fadmin", { replace: true });
          return;
        }

        if (!alive) return;
        setUserId(uid);

        const isUserAdmin = await isAdmin();
        if (!isUserAdmin) {
          const { error: tableError } = await supabase.from("admin_users").select("user_id").limit(1);

          if (
            tableError &&
            (tableError.code === "42P01" || tableError.message?.includes("does not exist"))
          ) {
            setErr(
              "Admin table does not exist. Please run the SQL migration: supabase/migrations/create_admin_users.sql"
            );
          } else {
            setErr(
              "You do not have admin access. Your user ID: " +
                uid +
                ". Add this ID to the admin_users table to grant access."
            );
          }

          if (!alive) return;
          setLoading(false);
          return;
        }

        // mark that we're in admin mode (optional but helpful)
        localStorage.setItem(USER_MODE_KEY, "admin");

        await loadStats();
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
      let userCount = 0;
      try {
        const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
        userCount = count || 0;
      } catch {}

      let savesCount = 0;
      try {
        const { count } = await supabase.from("saves_v2").select("*", { count: "exact", head: true });
        savesCount = count || 0;
      } catch {}

      let echoesCount = 0;
      try {
        const { count } = await supabase.from("echoes").select("*", { count: "exact", head: true });
        echoesCount = count || 0;
      } catch {}

      let wavesCount = 0;
      try {
        const { count } = await supabase.from("waves_summary").select("*", { count: "exact", head: true });
        wavesCount = count || 0;
      } catch {}

      let contentCount = 0;
      try {
        const { count } = await supabase.from("content_items").select("*", { count: "exact", head: true });
        contentCount = count || 0;
      } catch {}

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
            return;
          }
        }

        setStats({
          users: 0,
          saves: 0,
          echoes: 0,
          waves: 0,
          contentItems: 0,
          recentUsers: 0,
        });
      } catch (e) {
        console.error("Edge function also failed:", e);
        setStats({
          users: 0,
          saves: 0,
          echoes: 0,
          waves: 0,
          contentItems: 0,
          recentUsers: 0,
        });
      }
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, created_at, last_sign_in_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setUsersError(
            "The 'profiles' table does not exist. You may need to create it or use an edge function to access user data."
          );
          setUsers([]);
          return;
        }
        if (error.code === "42501" || error.message?.includes("permission") || error.message?.includes("RLS")) {
          setUsersError(
            "Permission denied. The 'profiles' table may have Row Level Security enabled. Consider using an edge function with service role access."
          );
          setUsers([]);
          return;
        }
        throw error;
      }

      setUsers((data || []) as User[]);
      if ((data || []).length === 0) setUsersError("No users found in the profiles table.");
    } catch (error: any) {
      const errorMsg = error?.message || "Unknown error";
      if (errorMsg.includes("does not exist")) {
        setUsersError("The 'profiles' table does not exist. Create a profiles table or use an edge function.");
      } else if (errorMsg.includes("permission") || errorMsg.includes("RLS")) {
        setUsersError("Permission denied. Adjust RLS policies or use an edge function with service role access.");
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
        .select("id, title, type, created_at")
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
      if (users.length === 0 && !loadingUsers) loadUsers();
    }
    if (activeTab === "content") {
      if (contentItems.length === 0 && !loadingContent) loadContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: userData } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      const userGrowthMap = new Map<string, number>();
      (userData || []).forEach((user: any) => {
        const date = new Date(user.created_at).toISOString().split("T")[0];
        userGrowthMap.set(date, (userGrowthMap.get(date) || 0) + 1);
      });

      const userGrowth = Array.from(userGrowthMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const { data: savesData } = await supabase
        .from("saves_v2")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      const { data: echoesData } = await supabase
        .from("echoes")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      const engagementMap = new Map<string, { saves: number; echoes: number }>();

      (savesData || []).forEach((save: any) => {
        const date = new Date(save.created_at).toISOString().split("T")[0];
        const current = engagementMap.get(date) || { saves: 0, echoes: 0 };
        engagementMap.set(date, { ...current, saves: current.saves + 1 });
      });

      (echoesData || []).forEach((echo: any) => {
        const date = new Date(echo.created_at).toISOString().split("T")[0];
        const current = engagementMap.get(date) || { saves: 0, echoes: 0 };
        engagementMap.set(date, { ...current, echoes: current.echoes + 1 });
      });

      const engagement = Array.from(engagementMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

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
        ...(recentSaves || []).map((s: any) => ({ ...s, type: "save" })),
        ...(recentEchoes || []).map((e: any) => ({ ...e, type: "echo" })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      setAnalyticsData({ userGrowth, engagement, recentActivity });
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
          .select("id, title, type, created_at")
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .limit(20);
        setSearchResults(data || []);
      } else if (searchType === "activity") {
        const { data: saves } = await supabase.from("saves_v2").select("id, created_at, user_id").limit(10);
        const { data: echoes } = await supabase.from("echoes").select("id, created_at, user_id").limit(10);

        const combined = [
          ...(saves || []).map((s: any) => ({ ...s, type: "save" })),
          ...(echoes || []).map((e: any) => ({ ...e, type: "echo" })),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, timeRange]);

  useEffect(() => {
    const saved = localStorage.getItem("admin_settings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {}
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

              {/* ✅ Single, clean "mode switch" row (no window.location.reload nonsense) */}
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" type="button" onClick={enterUserMode}>
                  👤 Browse as User
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
                  🏠 Back to Site
                </button>
                {/* optional: quick way back to admin root */}
                {location.pathname !== "/admin" && (
                  <button className="btn btn-ghost" type="button" onClick={enterAdminMode}>
                    🛠 Admin Home
                  </button>
                )}
              </div>
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
                  onClick={() => navigate(tabToPath("overview"))}
                >
                  <span className="admin-tab-icon">📊</span>
                  Overview
                </button>

                <button
                  className={`admin-tab ${activeTab === "users" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setUsersError("");
                    navigate(tabToPath("users"));
                  }}
                >
                  <span className="admin-tab-icon">👥</span>
                  Users
                </button>

                <button
                  className={`admin-tab ${activeTab === "content" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("content"))}
                >
                  <span className="admin-tab-icon">📝</span>
                  Content
                </button>

                <button
                  className={`admin-tab ${activeTab === "analytics" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("analytics"))}
                >
                  <span className="admin-tab-icon">📈</span>
                  Analytics
                </button>

                <button
                  className={`admin-tab ${activeTab === "operations" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("operations"))}
                >
                  <span className="admin-tab-icon">⚙️</span>
                  Operations
                </button>

                <button
                  className={`admin-tab ${activeTab === "settings" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("settings"))}
                >
                  <span className="admin-tab-icon">🔧</span>
                  Settings
                </button>

                <button
                  className={`admin-tab ${activeTab === "support" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("support"))}
                >
                  <span className="admin-tab-icon">🎧</span>
                  Support
                </button>

                <button
                  className={`admin-tab ${activeTab === "system" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("system"))}
                >
                  <span className="admin-tab-icon">💚</span>
                  System Health
                </button>

                <button
                  className={`admin-tab ${activeTab === "security" ? "admin-tab-active" : ""}`}
                  type="button"
                  onClick={() => navigate(tabToPath("security"))}
                >
                  <span className="admin-tab-icon">🔒</span>
                  Security
                </button>
              </div>

              {/* ✅ Everything below stays exactly like your original tab panels.
                  If you want, paste the rest and I’ll re-stitch it in. */}
              {/* ... */}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}








