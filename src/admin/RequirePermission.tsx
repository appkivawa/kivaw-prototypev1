import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { canViewTab } from "./permissions";
import { useMyPermissions } from "../auth/useMyPermissions";

type RequirePermissionProps = {
  children: React.ReactNode;
  tabName: string;
  fallback?: React.ReactNode;
  redirectTo?: string; // optional, but we won't use /login here
};

function safeRedirect(to?: string) {
  if (!to) return null;
  if (to.startsWith("/team")) return null;
  if (to.startsWith("/login")) return null; // hard block login redirects here
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
  const { loading, perms, error } = useMyPermissions();

  // Wait for perms (do NOT redirect)
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

  // If perms RPC failed, show error UI (don’t redirect and create thrash)
  if (error) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <h3 style={{ marginTop: 0 }}>Permissions check failed</h3>
            <p className="muted">
              This tab can’t load because permissions couldn’t be verified.
            </p>
            {import.meta.env.DEV && (
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{error}</pre>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => navigate("/admin", { replace: true })}>
                Back to Admin
              </button>
              <button className="btn" type="button" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // If for some reason perms are missing, don’t bounce to login.
  // RequireAdmin should have ensured auth already.
  if (!perms?.is_authenticated) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <h3 style={{ marginTop: 0 }}>Session missing</h3>
            <p className="muted">
              You’re on an admin route, but the session isn’t available yet. Try reload.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button className="btn" type="button" onClick={() => navigate("/studio", { replace: true })}>
                Go Home
              </button>
            </div>
            {import.meta.env.DEV && (
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
                path: {location.pathname}
              </pre>
            )}
          </Card>
        </div>
      </div>
    );
  }

  const roleKeys = perms.role_keys || [];
  const isSuperAdmin = !!perms.is_super_admin;

  const hasAccess = canViewTab(roleKeys, isSuperAdmin, tabName);

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    const safe = safeRedirect(redirectTo);
    if (safe) {
      // Allowed redirects only (never login)
      navigate(safe, { replace: true });
      return null;
    }

    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: "520px", margin: "0 auto" }}>
              <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.6 }}>🚫</div>
              <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>
                No Access
              </h1>
              <p className="muted" style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
                You don’t have permission for <code>{tabName}</code>.
              </p>

              <button className="btn" type="button" onClick={() => navigate("/admin", { replace: true })}>
                Go to Dashboard →
              </button>

              {import.meta.env.DEV && (
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 16, textAlign: "left" }}>
                  roles: {JSON.stringify(roleKeys)}
                  {"\n"}super: {String(isSuperAdmin)}
                </pre>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}






