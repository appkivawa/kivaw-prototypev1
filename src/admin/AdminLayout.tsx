import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRoles } from "../auth/useRoles";
import { canViewTab } from "./permissions";
import TopNav from "../ui/TopNav";

import Overview from "./tabs/Overview";
import Users from "./tabs/Users";
import Content from "./tabs/Content";
import Analytics from "./tabs/Analytics";
import Operations from "./tabs/Operations";
import Settings from "./tabs/Settings";
import Support from "./tabs/Support";
import Health from "./tabs/Health";
import Security from "./tabs/Security";
import Finance from "./tabs/Finance";
import Experiments from "./tabs/Experiments";
import CreatorRequests from "./tabs/CreatorRequests";
import Integrations from "./tabs/Integrations";
import RecommendationsPreview from "./tabs/RecommendationsPreview";
import PublishToExplore from "./tabs/PublishToExplore";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userEmail, setUserEmail] = useState<string>("");
  const { roleKeys, isSuperAdmin, loading: rolesLoading } = useRoles();

  // Sync activeTab with current route
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const email = data.session?.user?.email || "";
      setUserEmail(email);
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Determine active tab from current location
  // Converts route paths (hyphens) back to tab names (underscores)
  const activeTab = (() => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/") return "overview";
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] === "admin") {
      const routePath = segments[1];
      // Map route paths back to tab names
      const tabMap: Record<string, string> = {
        "creator-requests": "creator_requests",
        "recommendations-preview": "recommendations_preview",
        "publish-to-explore": "publish_to_explore",
      };
      return tabMap[routePath] || routePath;
    }
    return "overview";
  })();

  // Helper to get path for a tab
  // Converts tab names (underscores) to route paths (hyphens where needed)
  function getTabPath(tabName: string): string {
    if (tabName === "overview") return "/admin";
    
    // Map tab names to route paths (some use hyphens in URLs)
    const pathMap: Record<string, string> = {
      creator_requests: "creator-requests",
      recommendations_preview: "recommendations-preview",
      publish_to_explore: "publish-to-explore",
    };
    
    const path = pathMap[tabName] || tabName;
    return `/admin/${path}`;
  }

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

  // Wait for roles to load before filtering tabs to avoid race condition
  const visibleTabs = (() => {
    if (rolesLoading) {
      return []; // Don't show tabs until roles are loaded
    }
    
    return tabs.filter((tab) => canViewTab(roleKeys, isSuperAdmin || false, tab.name));
  })();

  // This function is no longer needed since we're using React Router nested routes
  // But keeping it as fallback in case routes don't render correctly
  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return <Overview />;
      case "users":
        return <Users />;
      case "content":
        return <Content />;
      case "analytics":
        return <Analytics />;
      case "operations":
        return <Operations />;
      case "settings":
        return <Settings />;
      case "support":
        return <Support />;
      case "health":
        return <Health />;
      case "security":
        return <Security />;
      case "finance":
        return <Finance />;
      case "experiments":
        return <Experiments />;
      case "creator_requests":
        return <CreatorRequests />;
      case "integrations":
        return <Integrations />;
      case "recommendations_preview":
        return <RecommendationsPreview />;
      case "publish_to_explore":
        return <PublishToExplore />;
      default:
        return <Overview />;
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      navigate("/studio", { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  return (
    <div className="coral-page-content">
      <TopNav />

      <div className="coral-section" style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-subtitle">Manage content, users, and platform settings</p>

            {/* Quick navigation buttons */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="coral-btn-secondary"
                type="button"
                onClick={() => navigate("/studio")}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                🏠 Home
              </button>
              <button
                className="coral-btn-secondary"
                type="button"
                onClick={() => navigate("/feed")}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                🔍 Explore
              </button>
              <button
                className="coral-btn-secondary"
                type="button"
                onClick={() => navigate("/timeline")}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                💭 Timeline
              </button>
              <button
                className="coral-btn-secondary"
                type="button"
                onClick={() => navigate("/waves")}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
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

            <button
              className="coral-btn-secondary"
              type="button"
              onClick={handleSignOut}
              style={{ fontSize: 12, padding: "8px 16px" }}
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="admin-tabs">
          {rolesLoading ? (
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
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(tabPath);
                  }}
                  className={`admin-tab ${isActive ? "admin-tab-active" : ""}`}
                >
                  <span className="admin-tab-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })
          )}
        </div>

        {/* Content is rendered by React Router nested routes */}
        <div className="coral-card" style={{ padding: 32 }}>
          {/* Show loading state if roles are still loading */}
          {rolesLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--coral-text-muted)" }}>Loading permissions...</p>
            </div>
          ) : (
            /* Render content - try Outlet first, fallback to direct rendering if needed */
            (() => {
              // If we're on an admin route, try Outlet first
              if (location.pathname.startsWith("/admin")) {
                // Check if Outlet rendered anything by checking if we're still on an admin route after a brief moment
                return <Outlet />;
              }
              return (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <p>Route mismatch: {location.pathname}</p>
                  <button onClick={() => navigate("/admin")}>Go to Admin Overview</button>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}

