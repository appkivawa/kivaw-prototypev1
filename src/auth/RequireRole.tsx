import { useNavigate } from "react-router-dom";
import { useSession } from "./useSession";
import { useRoles } from "./useRoles";
import Card from "../ui/Card";
import { formatRoles } from "./roleUtils";
import type { RoleKey } from "./roleUtils";

type RequireRoleProps = {
  children: React.ReactNode;
  allow: RoleKey[];
  fallback?: React.ReactNode;
  redirectTo?: string;
};

/**
 * RequireRole - Component that restricts access based on user roles
 * 
 * Props:
 * - allow: Array of role keys that are allowed (e.g., ["admin"], ["admin", "it"])
 * - fallback: Optional custom component to show if access denied
 * - redirectTo: Optional URL to redirect to if access denied
 * 
 * Behavior:
 * - If not logged in -> redirects to /login
 * - If roles are loading -> shows loading state (DO NOT show "No Access")
 * - If roles errored but RPC says admin -> allows access
 * - If user lacks required role -> shows themed "No access" page
 * - If user has required role -> renders children
 * 
 * Note: This is a client-side UX guard only.
 * Security is enforced by RLS policies and Edge Functions on the backend.
 */
export default function RequireRole({
  children,
  allow,
  fallback,
  redirectTo,
}: RequireRoleProps) {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, isAuthed } = useSession();
  const { hasAnyRole, loading: rolesLoading, roleKeys, error: rolesError, rpcAdminCheck, isAdmin } = useRoles();

  const loading = sessionLoading || rolesLoading;

  // CRITICAL: Do not render "No Access" while roles are still loading
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

  // Check if user has required role
  const hasRequiredRole = hasAnyRole(allow);

  // SPECIAL CASE 1: If roles errored but RPC confirms admin, allow access
  // This prevents lockout when join query fails but user is actually admin
  if (!hasRequiredRole && rolesError && rpcAdminCheck === true && allow.includes("admin")) {
    if (import.meta.env.DEV) {
      console.warn(
        "[RequireRole] Roles query failed but RPC confirms admin - allowing access to prevent lockout"
      );
    }
    // Allow access - RPC confirmed admin status
    return <>{children}</>;
  }

  // SPECIAL CASE 2: If isAdmin is true (from any source), allow admin access
  // This catches cases where isAdmin was set via failsafe but hasAnyRole didn't catch it
  if (!hasRequiredRole && allow.includes("admin") && isAdmin) {
    if (import.meta.env.DEV) {
      console.warn(
        "[RequireRole] isAdmin is true but hasAnyRole returned false - allowing access anyway"
      );
    }
    return <>{children}</>;
  }

  // Access denied
  if (!hasRequiredRole) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return null;
    }

    // Show themed "No access" page (no gradients, matches app theme)
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
                marginBottom: 8,
                color: "var(--ink-muted)"
              }}>
                You don't have permission to access this page.
              </p>
              {allow.length > 0 && (
                <p className="muted" style={{ 
                  fontSize: 15, 
                  marginBottom: 32,
                  color: "var(--ink-tertiary)"
                }}>
                  Required: {formatRoles(allow)}
                </p>
              )}
              {roleKeys.length > 0 && (
                <p className="muted" style={{ 
                  fontSize: 14, 
                  marginBottom: 32,
                  color: "var(--ink-tertiary)"
                }}>
                  Your roles: {formatRoles(roleKeys)}
                </p>
              )}
              {rolesError && (
                <p className="muted" style={{ 
                  fontSize: 13, 
                  marginBottom: 32,
                  color: "var(--ink-tertiary)",
                  fontStyle: "italic"
                }}>
                  Note: There was an error loading roles. Please refresh the page.
                </p>
              )}
              {import.meta.env.DEV && (
                <div style={{ 
                  marginTop: 24, 
                  padding: 16, 
                  background: "var(--surface-2)", 
                  borderRadius: 8,
                  textAlign: "left",
                  fontSize: 12,
                  color: "var(--ink-muted)"
                }}>
                  <strong>Debug Info:</strong>
                  <pre style={{ marginTop: 8, fontSize: 11, overflow: "auto" }}>
                    {JSON.stringify({
                      roleKeys,
                      isAdmin,
                      rpcAdminCheck,
                      rolesError,
                      allow,
                      hasRequiredRole,
                      userEmail: session?.user?.email,
                    }, null, 2)}
                  </pre>
                </div>
              )}
              <button 
                className="btn" 
                type="button" 
                onClick={() => navigate("/")}
                style={{ marginTop: 8 }}
              >
                Go Home →
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
