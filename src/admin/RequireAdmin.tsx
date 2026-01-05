import RequireRole from "../auth/RequireRole";
import { useSession } from "../auth/useSession";

/**
 * RequireAdmin - Wrapper component that requires "admin" role
 * Uses the new role-based access system (RequireRole)
 * 
 * TEMPORARY EMERGENCY BYPASS: Active in dev mode for specific email
 * ⚠️ REMOVE AFTER REGAINING ACCESS AND FIXING RLS
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  
  // TEMPORARY EMERGENCY BYPASS - Active in dev mode
  // ⚠️ REMOVE THIS AFTER REGAINING ACCESS AND FIXING RLS RECURSION
  if (import.meta.env.DEV && session?.user?.email === 'kivawapp@proton.me') {
    console.warn('⚠️ EMERGENCY BYPASS ACTIVE - Remove after fixing admin access and RLS recursion');
    return <>{children}</>;
  }
  
  return (
    <RequireRole allow={["admin"]}>
      {children}
    </RequireRole>
  );
}
