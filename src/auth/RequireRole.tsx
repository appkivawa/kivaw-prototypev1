// src/auth/RequireRole.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "./useSession";
import { useRoles } from "./useRoles";

type RequireRoleProps = {
  allow: string[];              // e.g. ["admin"] or ["admin","ops"]
  children: React.ReactNode;
  redirectTo?: string;          // where to send authed-but-not-allowed users
};

export default function RequireRole({
  allow,
  children,
  redirectTo = "/",
}: RequireRoleProps) {
  const location = useLocation();
  const { loading: sessionLoading, isAuthed } = useSession();
  const { loading: rolesLoading, roleKeys, isSuperAdmin } = useRoles();

  const loading = sessionLoading || rolesLoading;

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

  // super admins can do anything
  if (isSuperAdmin) return <>{children}</>;

  const allowSet = new Set((allow || []).map(String));
  const hasAny = (roleKeys || []).some((rk) => allowSet.has(rk));

  if (!hasAny) {
    // CRITICAL: If we're on an admin route but roles are empty, 
    // it might be a race condition - show error instead of redirecting
    if (location.pathname.startsWith("/admin") && (!roleKeys || roleKeys.length === 0)) {
      return (
        <div className="coral-page-content">
          <div className="coral-section" style={{ maxWidth: 560, margin: "0 auto", padding: "80px 20px" }}>
            <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
              <p style={{ color: "var(--coral-text-muted)" }}>Loading roles... Please wait.</p>
            </div>
          </div>
        </div>
      );
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}


