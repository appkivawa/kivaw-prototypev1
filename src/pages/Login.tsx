// src/pages/Login.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isValidEmail } from "../utils/security";
import Container from "../ui/Container";
import Card from "../ui/Card";
import Button from "../ui/Button";
import SectionHeader from "../ui/SectionHeader";
import "../styles/login.css";

function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  let next = raw;

  try {
    next = decodeURIComponent(next);
  } catch {}

  if (next.startsWith("http")) return null;
  if (!next.startsWith("/")) next = "/" + next;
  return next;
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const nextParamRaw = searchParams.get("next");
  const nextParam = useMemo(() => sanitizeNext(nextParamRaw), [nextParamRaw]);

  const [isAdminLogin, setIsAdminLogin] = useState(false);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) setErr(decodeURIComponent(errorParam));
  }, [searchParams]);

  async function sendLink() {
    setErr("");
    const clean = email.trim();
    if (!clean) return setErr("Add your email first.");
    if (!isValidEmail(clean)) return setErr("Please enter a valid email address.");

    setBusy(true);
    try {
      // Priority:
      // 1) explicit ?next=...
      // 2) admin checkbox => /admin
      // 3) default => /feed
      const nextPath = nextParam || (isAdminLogin ? "/admin" : "/feed");

      const emailRedirectTo =
        `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

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
    <div className="login-page">
      <Container maxWidth="sm" className="login-container">
        <Card className="login-card">
          {err && (
            <Card variant="danger" className="login-error">
              {err}
            </Card>
          )}

          {!sent ? (
            <>
              <SectionHeader
                title="Sign in to continue"
                subtitle="We'll send you a magic link to sign in."
                level={1}
                className="login-header"
              />

              <div className="login-form">
                <input
                  className="login-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  type="email"
                  onKeyDown={(e) => e.key === "Enter" && !busy && sendLink()}
                />

                {/* Only show admin toggle when not explicitly directed (next=...) */}
                {!nextParam && (
                  <label className="login-admin-toggle">
                    <input
                      type="checkbox"
                      checked={isAdminLogin}
                      onChange={(e) => setIsAdminLogin(e.target.checked)}
                    />
                    <span>Admin login</span>
                  </label>
                )}

                <Button
                  type="button"
                  onClick={sendLink}
                  disabled={busy}
                  variant="primary"
                  size="lg"
                  fullWidth
                >
                  {busy ? "Sending…" : "Send magic link"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <SectionHeader
                title="Check your email"
                subtitle={
                  <>
                    We sent a magic link to <strong>{email}</strong>. Click it to sign in.
                  </>
                }
                level={1}
                className="login-header"
              />

              <Button
                type="button"
                onClick={() => setSent(false)}
                variant="secondary"
                size="lg"
                fullWidth
              >
                Use a different email
              </Button>
            </>
          )}
        </Card>
      </Container>
    </div>
  );
}
