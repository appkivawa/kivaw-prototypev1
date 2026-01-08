import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";

export default function Creator() {
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
        <h1 className="coral-portal-title">Creator Portal</h1>
        <p className="coral-portal-subtitle">
          Share your content and connect with your audience
        </p>

        {/* Action Cards */}
        <div className="coral-portal-actions">
          <div className="coral-card" style={{ cursor: "pointer", textAlign: "center" }} onClick={() => navigate("/creators/dashboard")}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--coral-text-primary)" }}>
              Dashboard
            </h3>
            <p style={{ fontSize: 14, color: "var(--coral-text-muted)", margin: 0 }}>
              View your analytics
            </p>
          </div>

          <div className="coral-card" style={{ cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>➕</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--coral-text-primary)" }}>
              Create
            </h3>
            <p style={{ fontSize: 14, color: "var(--coral-text-muted)", margin: 0 }}>
              Add new content
            </p>
          </div>

          <div className="coral-card" style={{ cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--coral-text-primary)" }}>
              Manage
            </h3>
            <p style={{ fontSize: 14, color: "var(--coral-text-muted)", margin: 0 }}>
              Edit your content
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

