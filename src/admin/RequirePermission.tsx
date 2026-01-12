import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { useRoles } from "../auth/useRoles";
import Card from "../ui/Card";
import { canViewTab } from "./permissions";

type RequirePermissionProps = {
  children: React.ReactNode;
  tabName: string;
  fallback?: React.ReactNode;
  /**
   * Optional redirect when access is denied (NOT for unauth).
   * We'll ignore /team to prevent accidental "yeet to team portal" behavior.
   */
  redirectTo?: string;
};

function safeRedirect(to?: string) {
  if (!to) return null;
  // Hard block the Team portal from being an "oops redirect"
  if (to.startsWith("/team")) return null;
  return to;
}

export default function RequirePermission({
  children,
  tabName,
  fallback,
  redirectTo,
}: RequirePermissionProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { loading: sessionLoading, isAuthed } = useSession();
  const { roleKeys, isSuperAdmin, loading: rolesLoading } = useRoles();

  const loading = sessionLoading || rolesLoading;

  // Wait for auth/roles to load
  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <p className="muted">Loading permissions…</p>
          </Card>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login with next=<current path>
  if (!isAuthed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Check if user can view this tab
  const hasAccess = canViewTab(roleKeys, isSuperAdmin, tabName);

  // Access denied
  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    const safe = safeRedirect(redirectTo);
    if (safe) return <Navigate to={safe} replace />;

    // Default deny UI (no auto-redirect loops)
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: "500px", margin: "0 auto" }}>
              <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.6 }}>🚫</div>
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginBottom: 12,
                  lineHeight: 1.2,
                }}
              >
                No Access
              </h1>
              <p
                className="muted"
                style={{
                  fontSize: 17,
                  lineHeight: 1.6,
                  marginBottom: 32,
                  color: "var(--ink-muted)",
                }}
              >
                You don’t have permission to access this page.
              </p>

              <button className="btn" type="button" onClick={() => navigate("/admin", { replace: true })}>
                Go to Dashboard →
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


