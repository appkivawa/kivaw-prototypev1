import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
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
  const [userEmail, setUserEmail] = useState<string>("");
  const { roleKeys, isSuperAdmin } = useRoles();
  const [activeTab, setActiveTab] = useState<string>("overview");

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

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter((tab) =>
    canViewTab(roleKeys, isSuperAdmin || false, tab.name)
  );

  // Render tab content based on activeTab
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
      navigate("/");
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
              className="coral-btn-secondary"
              type="button"
              onClick={handleSignOut}
              style={{ fontSize: 12, padding: "8px 16px" }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="admin-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.name}
              type="button"
              onClick={() => setActiveTab(tab.name)}
              className={`admin-tab ${activeTab === tab.name ? "admin-tab-active" : ""}`}
            >
              <span className="admin-tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="coral-card" style={{ padding: 32 }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
