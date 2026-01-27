// src/admin/RequireAdmin.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMyPermissions } from "../auth/useMyPermissions";

function parseDevAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { perms, loading, error } = useMyPermissions();

  const devAdmins = React.useMemo(
    () => parseDevAdminEmails(import.meta.env.VITE_DEV_ADMIN_EMAILS),
    []
  );

  // Loading gate
  if (loading) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ maxWidth: 560, margin: "0 auto", padding: "80px 20px" }}>
          <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <p style={{ color: "var(--coral-text-muted)" }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in → go login with next
  if (!perms?.is_authenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // DEV bypass (optional)
  const email = (perms.email || "").toLowerCase();
  if (import.meta.env.DEV && email && devAdmins.has(email)) {
    return <>{children}</>;
  }

  // RPC failed → show error (don’t hide it behind redirects)
  if (error) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 20px" }}>
          <div className="coral-card" style={{ padding: "32px" }}>
            <h2 style={{ marginTop: 0 }}>Admin access check failed</h2>
            <p style={{ color: "var(--coral-text-muted)" }}>
              Couldn’t verify permissions from the database.
            </p>
            {import.meta.env.DEV && (
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{error}</pre>
            )}
            <p style={{ color: "var(--coral-text-muted)", marginTop: 16 }}>
              Fix the RPC/RLS, then reload.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = !!perms?.is_admin || !!perms?.is_super_admin;

  if (!isAdmin) {
    return <Navigate to="/studio" replace />;
  }

  return <>{children}</>;
}









