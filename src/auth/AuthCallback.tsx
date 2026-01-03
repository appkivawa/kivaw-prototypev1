import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    let alive = true;

    async function waitForSession(maxMs = 2500) {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
        await new Promise((r) => setTimeout(r, 200));
      }
      return null;
    }

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // PKCE: exchange ?code= for session
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        }

        // Give auth a moment to settle (hash flow + storage timing)
        await new Promise((r) => setTimeout(r, 400));

        const session = await waitForSession(2500);
        if (!session) {
          throw new Error("Sign-in didn’t finish. Please try again.");
        }

        const backTo = localStorage.getItem("kivaw_post_auth_path") || "/echo";
        localStorage.removeItem("kivaw_post_auth_path");

        if (!alive) return;
        nav(backTo, { replace: true });
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



