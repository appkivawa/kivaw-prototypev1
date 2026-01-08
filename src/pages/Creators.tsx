import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import TopNav from "../ui/TopNav";

export default function Creators() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <TopNav />
      <main className="main">
        <div className="center-wrap">
          <Card className="center card-pad" style={{ maxWidth: "600px", marginTop: "60px" }}>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <h1 style={{
                fontSize: 48,
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: 16,
                lineHeight: 1.1
              }}>
                Share your work
              </h1>
              <p style={{
                fontSize: 19,
                color: "var(--ink-muted)",
                lineHeight: 1.6,
                marginBottom: 40,
                maxWidth: "500px",
                marginLeft: "auto",
                marginRight: "auto"
              }}>
                Join creators who are making content that helps people navigate their states. Request access to start sharing.
              </p>
              
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => navigate("/creators/apply")}
                  style={{ minWidth: "180px" }}
                >
                  Apply / Request Access
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => navigate("/login")}
                  style={{ minWidth: "140px" }}
                >
                  Log in
                </button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}


