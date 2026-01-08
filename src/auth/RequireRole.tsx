import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * RequireRole
 * - Never calls navigate() during render
 * - Never sets state during render
 * - Waits for auth to initialize
 *
 * Assumptions:
 * - You store user role in a `profiles` table keyed by user_id (uuid)
 *   with a `role` column (e.g. "admin" | "employee" | "creator")
 * - If you don't have profiles yet, temporarily allow `adminEmails` fallback
 */
type Role = "admin" | "employee" | "creator";

const adminEmails = new Set<string>([
  // TEMP: put your admin email here if you need a quick win
  // "you@domain.com",
]);

export default function RequireRole({
  role,
  children,
  redirectTo = "/team",
}: {
  role: Role;
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const location = useLocation();

  const [loading, setLoading] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);
  const [hasRole, setHasRole] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        // 1) Get session
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!alive) return;

        const session = sessionData.session;
        if (sessionErr || !session) {
          setAuthed(false);
          setHasRole(false);
          setLoading(false);
          return;
        }

        setAuthed(true);

        // 2) Resolve role
        const email = session.user.email ?? "";
        if (role === "admin" && adminEmails.has(email)) {
          setHasRole(true);
          setLoading(false);
          return;
        }

        // Preferred: profiles table
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!alive) return;

        if (profErr) {
          console.error("[RequireRole] profile fetch error:", profErr);
          // If profile fetch fails, DO NOT redirect in a loop—fail closed.
          setHasRole(false);
          setLoading(false);
          return;
        }

        const userRole = (profile?.role ?? "employee") as Role;
        setHasRole(userRole === role);
        setLoading(false);
      } catch (e) {
        console.error("[RequireRole] unexpected error:", e);
        if (!alive) return;
        setAuthed(false);
        setHasRole(false);
        setLoading(false);
      }
    }

    load();

    // Keep state in sync if auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // re-run init on auth change
      setLoading(true);
      load();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // ✅ No redirects while loading
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

  // ✅ Safe redirects using <Navigate /> (no navigate() in render)
  if (!authed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!hasRole) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}
