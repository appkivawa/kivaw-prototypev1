import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      // Get user email
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    })();
  }, []);

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
            <NavLink
              to="/admin"
              end
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">📊</span>
              Overview
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">👥</span>
              Users
            </NavLink>
            <NavLink
              to="/admin/content"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">📝</span>
              Content
            </NavLink>
            <NavLink
              to="/admin/analytics"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">📈</span>
              Analytics
            </NavLink>
            <NavLink
              to="/admin/operations"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">⚙️</span>
              Operations
            </NavLink>
            <NavLink
              to="/admin/settings"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">🔧</span>
              Settings
            </NavLink>
            <NavLink
              to="/admin/support"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">🎧</span>
              Support
            </NavLink>
            <NavLink
              to="/admin/health"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">💚</span>
              System Health
            </NavLink>
            <NavLink
              to="/admin/security"
              className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">🔒</span>
              Security
            </NavLink>
          </div>

          {/* Nested Route Content */}
          <Outlet />
        </Card>
      </div>
    </div>
  );
}

