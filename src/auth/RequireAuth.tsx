import React from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "./useSession";
import AuthGate from "./AuthGate";

export default function RequireAuth({ 
  children,
  title,
  message 
}: { 
  children: React.ReactNode;
  title?: string;
  message?: string;
}) {
  const { isAuthed, loading } = useSession();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ maxWidth: "560px", margin: "0 auto", padding: "80px 20px" }}>
          <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <p style={{ color: "var(--coral-text-muted)" }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    // Use page-specific messages for Creator and Team portals
    let gateTitle = title || "Sign in to continue";
    let gateMessage = message;
    
    if (loc.pathname === "/creator") {
      gateTitle = "Creator Portal";
      gateMessage = "Log in or sign up to access the Creator portal.";
    } else if (loc.pathname === "/team") {
      gateTitle = "Team Portal";
      gateMessage = "Log in to access the Team portal.";
    } else if (!message) {
      gateMessage = "You can browse as a guest, but saving Echoes requires an account.";
    }

    return (
      <AuthGate
        title={gateTitle}
        message={gateMessage || "Please sign in to continue."}
      />
    );
  }

  return <>{children}</>;
}