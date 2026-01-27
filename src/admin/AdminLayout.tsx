// src/admin/AdminLayout.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import TopNav from "../ui/TopNav";
import { supabase } from "../lib/supabaseClient";
import { useMyPermissions } from "../auth/useMyPermissions";
import { canViewTab } from "./permissions";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { perms, loading: permsLoading } = useMyPermissions();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setUserEmail(data.session?.user?.email || "");
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Convert route → tabName
  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/") return "overview";
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] === "admin") {
      const routePath = segments[1];
      const tabMap: Record<string, string> = {
        "creator-requests": "creator_requests",
        "recommendations-preview": "recommendations_preview",
        "publish-to-explore": "publish_to_explore",
      };
      return tabMap[routePath] || routePath;
    }
    return "overview";
  }, [location.pathname]);

  function getTabPath(tabName: string): string {
    if (tabName === "overview") return "/admin";
    const pathMap: Record<string, string> = {
      creator_requests: "creator-requests",
      recommendations_preview: "recommendations-preview",
      publish_to_explore: "publish-to-explore",
    };
    return `/admin/${pathMap[tabName] || tabName}`;
  }

  const roleKeys = perms?.role_keys || [];
  const isSuperAdmin = !!perms?.is_super_admin;

  const tabs = [
    { name: "overview", label: "Overview", icon: "📊" },
    { name: "users", label: "Users", icon: "👥" },
    { name: "content", label: "Content", icon: "📝" },
    { name: "analytics", label: "Analytics", icon: "📈" },
    { name: "operations", label: "Operations", icon: "⚙️" },
    { name: "settings", label: "Settings", icon: "🔧" },
    { name: "support", label: "Support", icon: "🎧" },
    { name: "health", label: "System Health", icon: "💚" },
    { name: "security", label: "Security", icon: "🔒" },
    { name: "finance", label: "Finance", icon: "💰" },
    { name: "experiments", label: "Experiments", icon: "🧪" },
    { name: "creator_requests", label: "Creator Requests", icon: "✍️" },
    { name: "integrations", label: "Integrations", icon: "🔌" },
    { name: "recommendations_preview", label: "Recommendations", icon: "🎯" },
    { name: "publish_to_explore", label: "Publish to Explore", icon: "📤" },
  ];

  const visibleTabs = useMemo(() => {
    if (permsLoading) return [];
    return tabs.filter((t) => canViewTab(roleKeys, isSuperAdmin, t.name));
  }, [permsLoading, roleKeys, isSuperAdmin]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/studio", { replace: true });
  }

  return (
    <div className="coral-page-content">
      <TopNav />

      <div className="coral-section" style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-subtitle">Manage content, users, and platform settings</p>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="coral-btn-secondary" type="button" onClick={() => navigate("/studio")} style={{ fontSize: 12, padding: "8px 16px" }}>
                🏠 Home
              </button>
              <button className="coral-btn-secondary" type="button" onClick={() => navigate("/feed")} style={{ fontSize: 12, padding: "8px 16px" }}>
                🔍 Explore
              </button>
              <button className="coral-btn-secondary" type="button" onClick={() => navigate("/timeline")} style={{ fontSize: 12, padding: "8px 16px" }}>
                💭 Timeline
              </button>
              <button className="coral-btn-secondary" type="button" onClick={() => navigate("/waves")} style={{ fontSize: 12, padding: "8px 16px" }}>
                🌊 Waves
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {userEmail && (
              <div className="admin-user-info">
                <div className="admin-user-label">Signed in as:</div>
                <div className="admin-user-id">{userEmail}</div>
              </div>
            )}

            <button className="coral-btn-secondary" type="button" onClick={handleSignOut} style={{ fontSize: 12, padding: "8px 16px" }}>
              Sign Out
            </button>
          </div>
        </div>

        <div className="admin-tabs">
          {permsLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--coral-text-muted)" }}>
              Loading tabs...
            </div>
          ) : visibleTabs.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--coral-text-muted)" }}>
              No tabs available. Please check your permissions.
            </div>
          ) : (
            visibleTabs.map((tab) => {
              const tabPath = getTabPath(tab.name);
              const isActive = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => navigate(tabPath)}
                  className={`admin-tab ${isActive ? "admin-tab-active" : ""}`}
                >
                  <span className="admin-tab-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })
          )}
        </div>

        <div className="coral-card" style={{ padding: 32 }}>
          {permsLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--coral-text-muted)" }}>Loading permissions...</p>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}







