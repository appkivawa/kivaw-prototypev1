import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { useRoles } from "../auth/useRoles";
import Card from "../ui/Card";
import { canViewTab } from "./permissions";

type RequirePermissionProps = {
  children: React.ReactNode;
  tabName: string;
  fallback?: React.ReactNode;
  redirectTo?: string;
};

/**
 * RequirePermission - Component that restricts access based on tab permissions
 * 
 * Props:
 * - tabName: Name of the tab (e.g., "users", "security", "content")
 * - fallback: Optional custom component to show if access denied
 * - redirectTo: Optional URL to redirect to if access denied
 * 
 * Behavior:
 * - If not logged in -> redirects to /login
 * - If user lacks permission -> shows themed "No access" page
 * - If user has permission -> renders children
 */
export default function RequirePermission({
  children,
  tabName,
  fallback,
  redirectTo,
}: RequirePermissionProps) {
  const navigate = useNavigate();
  const { loading: sessionLoading, isAuthed } = useSession();
  const { roleKeys, isSuperAdmin, loading: rolesLoading } = useRoles();

  const loading = sessionLoading || rolesLoading;

  // Wait for auth/roles to load
  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <p className="muted">Loading…</p>
          </Card>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthed) {
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return null;
    }
    navigate("/login", { replace: true });
    return null;
  }

  // Check if user can view this tab
  const hasAccess = canViewTab(roleKeys, isSuperAdmin || false, tabName);

  // Access denied
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return null;
    }

    // Show themed "No access" page
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: "500px", margin: "0 auto" }}>
              <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.6 }}>🚫</div>
              <h1 style={{
                fontSize: 32,
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: 12,
                lineHeight: 1.2
              }}>
                No Access
              </h1>
              <p className="muted" style={{
                fontSize: 17,
                lineHeight: 1.6,
                marginBottom: 32,
                color: "var(--ink-muted)"
              }}>
                You don't have permission to access this page.
              </p>
              <button
                className="btn"
                type="button"
                onClick={() => navigate("/admin")}
                style={{ marginTop: 8 }}
              >
                Go to Dashboard →
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Access granted - render children
  return <>{children}</>;
}

