import { useNavigate, useLocation } from "react-router-dom";

type AuthGateProps = {
  title: string;
  message: string;
  loginButtonText?: string;
  backButtonText?: string;
  showBackButton?: boolean;
};

export default function AuthGate({
  title,
  message,
  loginButtonText = "Log in / Sign up",
  backButtonText = "Back to Home",
  showBackButton = true,
}: AuthGateProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogin() {
    navigate(`/login?next=${encodeURIComponent(location.pathname)}`, {
      state: { from: location.pathname },
    });
  }

  function handleBack() {
    navigate("/");
  }

  return (
    <div className="coral-page-content">
      <div className="coral-section" style={{ maxWidth: "560px", margin: "0 auto", padding: "80px 20px" }}>
        <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <h1 style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--coral-text-primary)",
            margin: "0 0 16px",
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: "16px",
            color: "var(--coral-text-muted)",
            margin: "0 0 32px",
            lineHeight: 1.6,
          }}>
            {message}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
            <button
              className="coral-btn"
              type="button"
              onClick={handleLogin}
            >
              {loginButtonText}
            </button>

            {showBackButton && (
              <button
                className="coral-btn-secondary"
                type="button"
                onClick={handleBack}
              >
                {backButtonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


