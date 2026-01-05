import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRoles } from "../auth/useRoles";
import { canViewTab } from "./permissions";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const { roleKeys, isSuperAdmin } = useRoles();

  useEffect(() => {
    (async () => {
      // Get user email
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    })();
  }, []);

  // Define tabs with their permission requirements
  const tabs = [
    { path: "/admin", name: "overview", label: "Overview", icon: "📊" },
    { path: "/admin/users", name: "users", label: "Users", icon: "👥" },
    { path: "/admin/content", name: "content", label: "Content", icon: "📝" },
    { path: "/admin/analytics", name: "analytics", label: "Analytics", icon: "📈" },
    { path: "/admin/operations", name: "operations", label: "Operations", icon: "⚙️" },
    { path: "/admin/settings", name: "settings", label: "Settings", icon: "🔧" },
    { path: "/admin/support", name: "support", label: "Support", icon: "🎧" },
    { path: "/admin/health", name: "health", label: "System Health", icon: "💚" },
    { path: "/admin/security", name: "security", label: "Security", icon: "🔒" },
    { path: "/admin/finance", name: "finance", label: "Finance", icon: "💰" },
    { path: "/admin/experiments", name: "experiments", label: "Experiments", icon: "🧪" },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter((tab) =>
    canViewTab(roleKeys, isSuperAdmin || false, tab.name)
  );

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <div className="admin-header">
            <div>
              <h1 className="admin-title">Admin Dashboard</h1>
              <p className="admin-subtitle">Manage your Kivaw platform</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              {userEmail && (
                <div className="admin-user-info">
                  <div className="admin-user-label">Signed in as:</div>
                  <div className="admin-user-id">{userEmail}</div>
                </div>
              )}
              <button
                className="btn btn-ghost"
                type="button"
                onClick={handleSignOut}
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="admin-tabs">
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === "/admin"}
                className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
              >
                <span className="admin-tab-icon">{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </div>

          {/* Nested Route Content */}
          <Outlet />
        </Card>
      </div>
    </div>
  );
}

