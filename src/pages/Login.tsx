import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import { isValidEmail } from "../utils/security";

type LocState = { from?: string };

function buildAuthRedirect() {
  const site =
    (import.meta as any).env?.VITE_PUBLIC_SITE_URL?.trim?.() || window.location.origin;

  const usesHashRouter =
    window.location.href.includes("/#/") || window.location.hash.startsWith("#/");

  return usesHashRouter ? `${site}/#/auth/callback` : `${site}/auth/callback`;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocState;

  // Support both state.from and returnTo query parameter
  const from = useMemo(() => {
    if (state.from) return state.from;
    const params = new URLSearchParams(location.search);
    const returnTo = params.get("returnTo");
    if (returnTo) return decodeURIComponent(returnTo);
    return "/echo";
  }, [state.from, location.search]);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(from, { replace: true });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate(from, { replace: true });
    });

    return () => sub?.subscription?.unsubscribe();
  }, [from, navigate]);

  async function sendLink() {
    setErr("");
    const clean = email.trim();
    if (!clean) return setErr("Add your email first.");

    // Validate email format
    if (!isValidEmail(clean)) {
      return setErr("Please enter a valid email address.");
    }

    setBusy(true);
    try {
      // ✅ Remember where they were trying to go
      localStorage.setItem("kivaw_post_auth_path", from);

      // ✅ Redirect to the correct callback route (hash-safe)
      const redirectTo = buildAuthRedirect();

      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Could not send magic link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page login-page">
      <div className="center-wrap">
        <div className="login-shell">
          <Card className="login-card">
            {err ? (
              <div className="login-error">
                {err}
              </div>
            ) : null}

            {!sent ? (
              <>
                <h1 className="login-header">Sign in to continue</h1>
                <p className="login-description">We'll send you a magic link to sign in.</p>
                
                <div className="login-email-wrapper">
                  <input
                    className="login-email-input"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    type="email"
                  />
                </div>

                <button
                  className="login-magic-btn"
                  type="button"
                  onClick={sendLink}
                  disabled={busy}
                >
                  {busy ? "Sending…" : "Send magic link"}
                </button>
              </>
            ) : (
              <>
                <div className="login-success">
                  <h1 className="login-header">Check your email</h1>
                  <p className="login-description">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
                </div>
                <button className="btn btn-ghost btn-wide" type="button" onClick={() => setSent(false)}>
                  Use a different email
                </button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

