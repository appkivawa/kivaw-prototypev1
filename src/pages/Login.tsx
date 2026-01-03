import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";

type LocState = { from?: string };

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocState;

  const from = useMemo(() => state.from || "/echo", [state.from]);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // If they already have a session, bounce them back where they came from
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

    setBusy(true);
    try {
      // Redirect back to /login so this page can detect the new session and route you back.
      const redirectTo = `${window.location.origin}/login`;

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
    <div className="page">
      <div className="center-wrap">
        <div className="quiz-shell">
          <div className="quiz-shell__top">
            <button className="btn-ghost" onClick={() => navigate(-1)} type="button">
              ← Back
            </button>
          </div>

          <h1 className="quiz-title">Continue</h1>
          <div className="quiz-subline">
            Save your Echoes with a magic link. No password. No chaos.
          </div>

          <Card className="quiz-card">
            {err ? (
              <div style={{ marginBottom: 12 }} className="echo-alert">
                {err}
              </div>
            ) : null}

            {!sent ? (
              <>
                <label className="muted" style={{ display: "block", marginBottom: 8 }}>
                  Email
                </label>
                <input
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

                <div style={{ height: 12 }} />

                <button className="btn btn-primary btn-wide" type="button" onClick={sendLink} disabled={busy}>
                  {busy ? "Sending…" : "Send magic link →"}
                </button>

                <div style={{ height: 12 }} />

                <button className="btn btn-ghost btn-wide" type="button" onClick={() => navigate(from)}>
                  Not now (browse as guest)
                </button>

                <p className="muted" style={{ marginTop: 14 }}>
                  Tip: check Promotions/Spam if your inbox plays hard to get.
                </p>
              </>
            ) : (
              <>
                <div className="echo-empty" style={{ marginBottom: 14 }}>
                  Link sent. Open your email and tap the button.
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
