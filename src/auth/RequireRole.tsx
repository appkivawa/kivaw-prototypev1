// src/auth/RequireRole.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "./usePermissions";

type RequireRoleProps = {
  allow: string[];              // e.g. ["creator"] or ["ops"]
  children: React.ReactNode;
  redirectTo?: string;          // where to send authed-but-not-allowed users
};

export default function RequireRole({
  allow,
  children,
  redirectTo = "/",
}: RequireRoleProps) {
  const location = useLocation();
  const { loading, isAuthed, roleKeys, isAdmin, isSuperAdmin, error } = usePermissions();

  if (loading) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ maxWidth: 560, margin: "0 auto", padding: "80px 20px" }}>
          <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <p style={{ color: "var(--coral-text-muted)" }}>Loading permissions…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Fail closed on permissions failure
  if (error) {
    if (import.meta.env.DEV) {
      return (
        <div className="coral-page-content">
          <div className="coral-section" style={{ maxWidth: 560, margin: "0 auto", padding: "80px 20px" }}>
            <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
              <p style={{ color: "var(--coral-text-muted)" }}>Permissions error:</p>
              <pre style={{ textAlign: "left", whiteSpace: "pre-wrap", marginTop: 12 }}>{error}</pre>
            </div>
          </div>
        </div>
      );
    }
    return <Navigate to={redirectTo} replace />;
  }

  // Admin override: admins can do anything
  if (isSuperAdmin || isAdmin) return <>{children}</>;

  const allowSet = new Set((allow || []).map((s) => String(s).toLowerCase()));
  const hasAny = (roleKeys || []).some((rk) => allowSet.has(String(rk).toLowerCase()));

  if (!hasAny) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}




