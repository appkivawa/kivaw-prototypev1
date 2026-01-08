import RequireRole from "../auth/RequireRole";
import { useSession } from "../auth/useSession";
import { useRoles } from "../auth/useRoles";

/**
 * RequireAdmin - Wrapper component that requires "admin" or "super_admin" role
 * Uses the new role-based access system (RequireRole)
 * 
 * Redirects:
 * - Not authenticated -> /login (handled by RequireRole)
 * - Authenticated but not admin -> /team (via redirectTo prop)
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, isAuthed } = useSession();
  const { isSuperAdmin, roleKeys, isAdmin } = useRoles();
  
  if (import.meta.env.DEV) {
    console.log("[RequireAdmin] Role check:", {
      isSuperAdmin,
      roleKeys,
      isAdmin,
      userEmail: session?.user?.email,
      isAuthed,
    });
  }
  
  // TEMPORARY EMERGENCY BYPASS - Active in dev mode
  // ⚠️ REMOVE THIS AFTER REGAINING ACCESS AND FIXING RLS RECURSION
  if (import.meta.env.DEV && session?.user?.email === 'kivawapp@proton.me') {
    console.warn('⚠️ EMERGENCY BYPASS ACTIVE - Remove after fixing admin access and RLS recursion');
    return <>{children}</>;
  }
  
  // Allow super_admin or admin
  // RequireRole will check isAdmin which includes super_admin
  // redirectTo="/team" means: if authenticated but not admin, redirect to /team
  return (
    <RequireRole allow={["admin"]} redirectTo="/team">
      {children}
    </RequireRole>
  );
}
