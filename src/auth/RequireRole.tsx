import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export type RoleKey = "admin" | "employee" | "creator" | "super_admin" | "ops" | "it" | "social_media";

const adminEmails = new Set<string>([
  // "kivawapp@proton.me", // optional fallback
]);

export default function RequireRole({
  allow,
  children,
  redirectTo = "/",
}: {
  allow: RoleKey[];
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const location = useLocation();

  const [loading, setLoading] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);
  const [hasAccess, setHasAccess] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);

        // 1) Get session
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!alive) return;

        const session = sessionData.session;
        if (sessionErr || !session) {
          setAuthed(false);
          setHasAccess(false);
          setLoading(false);
          return;
        }

        setAuthed(true);

        // 2) Email allowlist quick win
        const email = session.user.email ?? "";
        if (adminEmails.has(email) && allow.includes("admin")) {
          setHasAccess(true);
          setLoading(false);
          return;
        }

        // 3) Pull role keys from profiles (single role OR array)
        // Supports:
        // - profiles.role = "admin"
        // - profiles.role_keys = ["admin","ops"]
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("role, role_keys")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!alive) return;

        if (profErr) {
          console.error("[RequireRole] profile fetch error:", profErr);
          setHasAccess(false);
          setLoading(false);
          return;
        }

        const role = (profile as any)?.role as string | undefined;
        const roleKeys = ((profile as any)?.role_keys as string[] | undefined) ?? [];

        const userRoleKeys = new Set<string>([
          ...(role ? [role] : []),
          ...roleKeys,
        ]);

        // super_admin implies admin
        if (userRoleKeys.has("super_admin")) userRoleKeys.add("admin");

        const ok = allow.some((r) => userRoleKeys.has(r));
        setHasAccess(ok);
        setLoading(false);
      } catch (e) {
        console.error("[RequireRole] unexpected error:", e);
        if (!alive) return;
        setAuthed(false);
        setHasAccess(false);
        setLoading(false);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [allow]);

  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <div className="coral-card" style={{ padding: 32, textAlign: "center" }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!authed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!hasAccess) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}

