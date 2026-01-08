import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isValidEmail } from "../utils/security";

export default function Login() {
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  
  // Track whether user selected admin login
  const [isAdminLogin, setIsAdminLogin] = useState(false);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Check for error from callback redirect
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErr(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

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
      // Determine redirect path: explicit next param > admin toggle > default team
      const isAdmin = nextParam === "/admin" || isAdminLogin;
      const nextPath = nextParam || (isAdmin ? "/admin" : "/team");
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${nextPath}`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo },
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
    <div className="coral-page-content">
      <div className="coral-section" style={{ maxWidth: "480px", margin: "0 auto", padding: "80px 20px" }}>
        <div className="coral-card" style={{ padding: "48px 32px" }}>
          {err ? (
            <div style={{
              padding: "12px 16px",
              background: "rgba(255, 0, 0, 0.1)",
              border: "1px solid rgba(255, 0, 0, 0.3)",
              borderRadius: "8px",
              color: "var(--coral-text-primary)",
              marginBottom: "24px",
              fontSize: "14px",
            }}>
              {err}
            </div>
          ) : null}

          {!sent ? (
            <>
              <h1 className="page-title" style={{
                fontSize: "28px",
                margin: "0 0 8px",
                textAlign: "center",
              }}>
                Sign in to continue
              </h1>
              <p style={{
                fontSize: "16px",
                color: "var(--coral-text-muted)",
                margin: "0 0 32px",
                textAlign: "center",
              }}>
                We'll send you a magic link to sign in.
              </p>
              
              <div style={{ marginBottom: "16px" }}>
                <input
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "var(--coral-surface)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid var(--coral-border)",
                    borderRadius: "8px",
                    color: "var(--coral-text-primary)",
                    fontSize: "16px",
                    fontFamily: "inherit",
                  }}
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  type="email"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) {
                      sendLink();
                    }
                  }}
                />
              </div>

              {/* Admin login toggle */}
              {!nextParam && (
                <div style={{ marginBottom: "24px" }}>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--coral-text-muted)",
                  }}>
                    <input
                      type="checkbox"
                      checked={isAdminLogin}
                      onChange={(e) => setIsAdminLogin(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>Admin login</span>
                  </label>
                </div>
              )}

              <button
                className="coral-btn"
                type="button"
                onClick={sendLink}
                disabled={busy}
                style={{ width: "100%" }}
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <h1 className="page-title" style={{
                  fontSize: "28px",
                  margin: "0 0 8px",
                }}>
                  Check your email
                </h1>
                <p style={{
                  fontSize: "16px",
                  color: "var(--coral-text-muted)",
                  margin: 0,
                }}>
                  We sent a magic link to <strong style={{ color: "var(--coral-text-primary)" }}>{email}</strong>. Click it to sign in.
                </p>
              </div>
              <button
                className="coral-btn-secondary"
                type="button"
                onClick={() => setSent(false)}
                style={{ width: "100%" }}
              >
                Use a different email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

