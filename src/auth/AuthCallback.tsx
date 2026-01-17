// src/auth/AuthCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { ensureProfile } from "../data/profileApi";

function sanitizeNext(raw: string | null): string {
  if (!raw) return "/feed";
  let next = raw;

  try {
    next = decodeURIComponent(next);
  } catch {}

  if (next.startsWith("http")) return "/feed";
  if (!next.startsWith("/")) next = "/" + next;

  // allow only known top-level routes you support
  const allowed = new Set([
    "/feed",
    "/team",
    "/admin",
    "/creators/dashboard",
    "/explore",
    "/saved",
    "/preferences",
  ]);

  // allow /admin/* and /item/:id etc if you want:
  if (next.startsWith("/admin")) return next;
  if (next.startsWith("/item/")) return next;

  return allowed.has(next) ? next : "/feed";
}

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) PKCE flow: exchange `code`
        const code = url.searchParams.get("code");
        if (code) {
          setMsg("Confirming code…");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // If JWT signature error, it's likely a stale token or instance mismatch
            if (error.message?.includes("JWT") || error.message?.includes("signature") || error.message?.includes("invalid")) {
              throw new Error(
                "Invalid magic link. This usually means:\n" +
                "1. The link expired or was already used\n" +
                "2. Supabase was restarted (get a new link)\n" +
                "3. Frontend is connected to a different Supabase instance\n\n" +
                "Please request a new magic link."
              );
            }
            throw error;
          }

          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }

        // 2) Implicit tokens in hash (older magic links)
        const hash = window.location.hash;
        const hasTokens = hash.includes("access_token=") && hash.includes("refresh_token=");
        if (hasTokens) {
          setMsg("Setting session…");
          const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (!access_token || !refresh_token) {
            throw new Error("Missing access_token or refresh_token in URL hash.");
          }

          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            // If JWT signature error, it's likely a stale token or instance mismatch
            if (error.message?.includes("JWT") || error.message?.includes("signature")) {
              throw new Error(
                "Invalid magic link. This usually means:\n" +
                "1. The link expired or was already used\n" +
                "2. Supabase was restarted (get a new link)\n" +
                "3. Frontend is connected to a different Supabase instance\n\n" +
                "Please request a new magic link."
              );
            }
            throw error;
          }

          url.hash = "";
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }

        // 3) Confirm session exists
        setMsg("Loading session…");
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          throw new Error("Session not created. Check Supabase Auth redirect URLs.");
        }

        // 4) Ensure profile exists (auto-create if needed)
        setMsg("Setting up profile…");
        try {
          await ensureProfile();
        } catch (e) {
          console.warn("[AuthCallback] Profile creation failed (non-fatal):", e);
        }

        // 5) Go where we were asked to go (or /feed)
        const rawNext = new URL(window.location.href).searchParams.get("next");
        const next = sanitizeNext(rawNext);

        if (!alive) return;
        nav(next, { replace: true });
      } catch (e: any) {
        console.error("[AuthCallback] error:", e);
        if (!alive) return;
        const message = e?.message || "Sign-in failed";
        nav(`/login?error=${encodeURIComponent(message)}`, { replace: true });
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












