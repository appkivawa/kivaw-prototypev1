import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";

export default function Team() {
  const navigate = useNavigate();

  async function handleLogOut() {
    try {
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  return (
    <div className="coral-page-content">
      <div className="coral-portal-page">
        <h1 className="coral-portal-title">Team Portal</h1>
        <p className="coral-portal-subtitle">
          Access internal tools and resources for team members
        </p>

        {/* Action Cards */}
        <div className="coral-portal-actions">
          <div className="coral-card" style={{ cursor: "pointer", textAlign: "center" }} onClick={() => navigate("/admin")}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--coral-text-primary)" }}>
              Admin
            </h3>
            <p style={{ fontSize: 14, color: "var(--coral-text-muted)", margin: 0 }}>
              Admin dashboard
            </p>
          </div>

          <div className="coral-card" style={{ cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--coral-text-primary)" }}>
              Analytics
            </h3>
            <p style={{ fontSize: 14, color: "var(--coral-text-muted)", margin: 0 }}>
              View platform stats
            </p>
          </div>

          <div className="coral-card" style={{ cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--coral-text-primary)" }}>
              Users
            </h3>
            <p style={{ fontSize: 14, color: "var(--coral-text-muted)", margin: 0 }}>
              Manage users
            </p>
          </div>
        </div>

        {/* Log Out Button */}
        <div style={{ textAlign: "center" }}>
          <button
            className="coral-btn-secondary"
            type="button"
            onClick={handleLogOut}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

