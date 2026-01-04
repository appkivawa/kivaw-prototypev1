import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import { ADMIN_EMAIL_ALLOWLIST } from "./adminAllowlist";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        // Check if user is signed in via Supabase auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          if (!alive) return;
          // Redirect to /login if it exists, otherwise /
          navigate("/login", { replace: true });
          return;
        }

        if (!alive) return;
        const userId = session.user.id;
        const userEmail = session.user.email;

        // Try to check admin status via profiles.is_admin field
        let isAdmin = false;
        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", userId)
            .maybeSingle();

          if (!profileError && profile) {
            // profiles table exists and has is_admin field
            isAdmin = profile.is_admin === true;
          } else if (profileError && (profileError.code === "42P01" || profileError.message?.includes("does not exist"))) {
            // profiles table doesn't exist - use email allowlist fallback
            console.warn("profiles table does not exist, using email allowlist fallback");
            if (userEmail && ADMIN_EMAIL_ALLOWLIST.length > 0) {
              isAdmin = ADMIN_EMAIL_ALLOWLIST.includes(userEmail.toLowerCase());
            }
          } else if (profileError && profileError.message?.includes("column") && profileError.message?.includes("is_admin")) {
            // profiles table exists but is_admin column doesn't - use email allowlist fallback
            console.warn("profiles.is_admin column does not exist, using email allowlist fallback");
            if (userEmail && ADMIN_EMAIL_ALLOWLIST.length > 0) {
              isAdmin = ADMIN_EMAIL_ALLOWLIST.includes(userEmail.toLowerCase());
            }
          } else {
            // Other error - try email allowlist as fallback
            console.warn("Error checking profiles table, using email allowlist fallback:", profileError);
            if (userEmail && ADMIN_EMAIL_ALLOWLIST.length > 0) {
              isAdmin = ADMIN_EMAIL_ALLOWLIST.includes(userEmail.toLowerCase());
            }
          }
        } catch (e: any) {
          // Error accessing profiles table - use email allowlist fallback
          console.warn("Exception checking profiles table, using email allowlist fallback:", e);
          if (userEmail && ADMIN_EMAIL_ALLOWLIST.length > 0) {
            isAdmin = ADMIN_EMAIL_ALLOWLIST.includes(userEmail.toLowerCase());
          }
        }

        if (!alive) return;

        if (!isAdmin) {
          setErr(
            "You do not have admin access. " +
            (userEmail ? `Your email: ${userEmail}. ` : "") +
            "Contact an administrator to grant access."
          );
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        if (!alive) return;
        setIsAuthorized(true);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Admin check failed.");
        setIsAuthorized(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <p className="muted">Loading admin dashboard…</p>
          </Card>
        </div>
      </div>
    );
  }

  if (err || !isAuthorized) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <div className="admin-error">
              <div className="echo-alert">
                {err}
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
                  <strong>Admin Access Required:</strong> To grant admin access, either:
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li>Set <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>is_admin = true</code> in the profiles table for your user, or</li>
                    <li>Add your email to <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>src/admin/adminAllowlist.ts</code></li>
                  </ul>
                </div>
              </div>
              <div className="admin-actions">
                <button className="btn" type="button" onClick={() => navigate("/")}>
                  Go home →
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

