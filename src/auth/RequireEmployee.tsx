import { useNavigate, useLocation } from "react-router-dom";
import { useSession } from "./useSession";
import { useRoles } from "./useRoles";
import { formatRoles } from "./roleUtils";
import AuthGate from "./AuthGate";

/**
 * RequireEmployee - Component that restricts access to employee portal pages
 * 
 * Requires roles: "ops" OR "admin" OR "super_admin"
 * 
 * Behavior:
 * - If not logged in -> redirects to /login with ?next= param
 * - If roles are loading -> shows loading state (DO NOT show "No Access")
 * - If user lacks required role -> shows themed "No access" page with button to /team
 * - If user has required role -> renders children
 */
export default function RequireEmployee({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: sessionLoading, isAuthed } = useSession();
  const { hasAnyRole, loading: rolesLoading, roleKeys, isSuperAdmin, isAdmin } = useRoles();

  const loading = sessionLoading || rolesLoading;
  const requiredRoles = ["ops", "admin"];

  // CRITICAL: Do not render "No Access" while roles are still loading
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

  // Not authenticated - show auth gate
  if (!isAuthed) {
    return (
      <AuthGate
        title="Team Portal"
        message="Log in to access the Team portal."
      />
    );
  }

  // Check if user has required role (including super_admin)
  const hasRequiredRole = isSuperAdmin || isAdmin || hasAnyRole(requiredRoles);

  // Access denied - show friendly "No access" page
  if (!hasRequiredRole) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ maxWidth: "560px", margin: "0 auto", padding: "80px 20px" }}>
          <div className="coral-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.6 }}>🚫</div>
            <h1 style={{ 
              fontSize: "32px", 
              fontWeight: 700, 
              color: "var(--coral-text-primary)", 
              marginBottom: 12,
              lineHeight: 1.2
            }}>
              No Access
            </h1>
            <p style={{ 
              fontSize: "17px", 
              lineHeight: 1.6, 
              marginBottom: 8,
              color: "var(--coral-text-muted)"
            }}>
              This area is for employees only.
            </p>
            <p style={{ 
              fontSize: "15px", 
              marginBottom: 32,
              color: "var(--coral-text-tertiary)"
            }}>
              Required: Ops, Admin, or Super Admin role
            </p>
            {roleKeys.length > 0 && (
              <p style={{ 
                fontSize: "14px", 
                marginBottom: 32,
                color: "var(--coral-text-tertiary)"
              }}>
                Your roles: {formatRoles(roleKeys)}
              </p>
            )}
            <button 
              className="coral-btn" 
              type="button" 
              onClick={() => navigate("/team")}
              style={{ marginTop: 8 }}
            >
              Go to Team Portal →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Access granted - render children
  return <>{children}</>;
}


