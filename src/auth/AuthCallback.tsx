import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // 1️⃣ Handle PKCE code flow (if present)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Clean URL
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname);
        }

        // 2️⃣ IMPORTANT: wait for session to actually exist
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        if (!data.session) {
          throw new Error("Sign-in did not complete. Please try again.");
        }

        // 3️⃣ Redirect only AFTER session is confirmed
        nav("/echo", { replace: true });
      } catch (e: any) {
        console.error("Auth callback error:", e);
        if (!alive) return;
        setMsg(e?.message || "Sign-in failed. Try again.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav]);

  return (
    <div className="page">
      <div className="center-wrap" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>{msg}</p>
      </div>
    </div>
  );
}

