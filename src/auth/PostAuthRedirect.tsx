import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSession } from "./useSession";
import { useRoles } from "./useRoles";
import { getLandingRouteFromRoles } from "./getLandingRouteFromRoles";

/**
 * PostAuthRedirect - Centralized post-login redirect controller
 * 
 * Waits for both session and roles to load, then redirects based on user roles.
 * 
 * Redirect rules:
 * - super_admin, admin, or ops -> /admin
 * - creator or partner -> /creators/dashboard
 * - else -> /home (consumer app)
 * 
 * This component should be mounted once in the top-level layout.
 * It renders null and only handles navigation.
 */
export default function PostAuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: sessionLoading, isAuthed } = useSession();
  const { roleKeys, loading: rolesLoading, isSuperAdmin } = useRoles();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Don't redirect if:
    // - Still loading session or roles
    // - Not authenticated
    // - Already redirected in this session
    if (sessionLoading || rolesLoading || !isAuthed || hasRedirected.current) {
      return;
    }

    const currentPath = location.pathname;

    // Don't redirect if we're on login or auth callback pages
    if (currentPath === "/login" || currentPath === "/auth/callback") {
      return;
    }

    // Don't redirect if we're on public entry pages or homepage
    if (
      currentPath === "/" ||
      currentPath === "/creators" ||
      currentPath === "/creators/apply" ||
      currentPath === "/team" ||
      currentPath === "/creator"
    ) {
      return;
    }

    // Check for ?next= query param first (from route guards)
    const params = new URLSearchParams(location.search);
    const nextParam = params.get("next");
    
    // If ?next= is present and user has access, use it
    if (nextParam) {
      // Validate that nextParam is a safe path (starts with /)
      if (nextParam.startsWith("/")) {
        // PostAuthRedirect will let the route guards handle access control
        // Just redirect to the requested path
        hasRedirected.current = true;
        navigate(nextParam, { replace: true });
        return;
      }
    }

    // Determine redirect path based on roles
    let redirectPath = getLandingRouteFromRoles(roleKeys, isSuperAdmin);
    
    // Check for creator/partner roles (override consumer default)
    if (roleKeys.includes("creator") || roleKeys.includes("partner")) {
      redirectPath = "/creators/dashboard";
    }

    // Only redirect if we're not already on the target path or a valid app route
    const isOnValidRoute =
      currentPath === "/" ||
      currentPath === redirectPath ||
      currentPath.startsWith("/admin") ||
      currentPath.startsWith("/creators/dashboard") ||
      currentPath.startsWith("/home") ||
      currentPath.startsWith("/explore") ||
      currentPath.startsWith("/waves") ||
      currentPath.startsWith("/echo") ||
      currentPath.startsWith("/events") ||
      currentPath.startsWith("/saved") ||
      currentPath.startsWith("/item/") ||
      currentPath.startsWith("/quiz/") ||
      currentPath === "/guide";

    if (!isOnValidRoute) {
      hasRedirected.current = true;
      navigate(redirectPath, { replace: true });
    }
  }, [sessionLoading, rolesLoading, isAuthed, roleKeys, isSuperAdmin, navigate, location.pathname]);

  // Reset redirect flag when session changes (user logs out)
  useEffect(() => {
    if (!isAuthed) {
      hasRedirected.current = false;
    }
  }, [isAuthed]);

  return null;
}

