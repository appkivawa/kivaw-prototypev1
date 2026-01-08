import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");
  const [authComplete, setAuthComplete] = useState(false);

  // Handle auth exchange (runs once on mount)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const fullUrl = window.location.href;
        console.log("[AuthCallback] window.location.href:", fullUrl);

        // Check for implicit flow tokens in hash (#access_token=...&refresh_token=...)
        const hash = window.location.hash;
        const hasImplicitTokens = hash.includes("access_token=") && hash.includes("refresh_token=");

        if (hasImplicitTokens) {
          // Implicit flow: parse tokens from hash
          console.log("[AuthCallback] Detected implicit flow tokens in hash");
          const hashParams = new URLSearchParams(hash.substring(1)); // Remove '#'
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (!accessToken || !refreshToken) {
            throw new Error("Missing access_token or refresh_token in hash");
          }

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[AuthCallback] setSession error:", error);
            if (alive) {
              nav("/login?error=" + encodeURIComponent(error.message), { replace: true });
            }
            return;
          }

          console.log("[AuthCallback] setSession success:", {
            hasSession: !!data.session,
            hasUser: !!data.user,
          });

          // Clean up URL hash
          const url = new URL(window.location.href);
          url.hash = "";
          window.history.replaceState({}, document.title, url.pathname + url.search);
        } else {
          // PKCE flow: try exchangeCodeForSession (fallback for compatibility)
          console.log("[AuthCallback] Attempting PKCE code exchange");
          const { data, error } = await supabase.auth.exchangeCodeForSession(fullUrl);
          
          if (error) {
            console.error("[AuthCallback] exchangeCodeForSession error:", error);
            if (alive) {
              nav("/login?error=" + encodeURIComponent(error.message), { replace: true });
            }
            return;
          }

          console.log("[AuthCallback] exchangeCodeForSession success:", {
            hasSession: !!data.session,
            hasUser: !!data.user,
          });

          // Clean up URL
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }

        // Wait for session to be persisted
        await new Promise((r) => setTimeout(r, 300));

        // Verify session exists
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[AuthCallback] Session after exchange:", {
          hasSession: !!sessionData.session,
          userId: sessionData.session?.user?.id,
          email: sessionData.session?.user?.email,
        });

        if (!sessionData.session) {
          throw new Error("Session not created");
        }

        if (alive) {
          setAuthComplete(true);
        }
      } catch (e: any) {
        console.error("[AuthCallback] Error:", e);
        if (!alive) return;
        nav("/login?error=" + encodeURIComponent(e?.message || "Sign-in failed"), { replace: true });
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav]);

  // Handle redirect after auth is complete
  useEffect(() => {
    if (!authComplete) return;

    (async () => {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get("next");
      let next = raw;

      // If explicit next param, use it (after decoding)
      if (next) {
        try {
          next = decodeURIComponent(next);
          // If still contains encoded sequences (%xx), decode again
          if (next.includes("%2F") || /%[0-9A-Fa-f]{2}/.test(next)) {
            next = decodeURIComponent(next);
          }
        } catch (e) {
          console.warn("[AuthCallback] Failed to decode next param:", raw);
          next = null; // Fall through to role-based redirect
        }

        // Normalize: ensure starts with "/"
        if (next && !next.startsWith("/")) {
          next = "/" + next;
        }

        // Prevent open redirects
        if (next && next.startsWith("http")) {
          next = null; // Fall through to role-based redirect
        }
      }

      // If no explicit next param, determine redirect based on user role
      if (!next) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            next = "/team"; // Default fallback
          } else {
            // Fetch user role from profiles table
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("user_id", session.user.id)
              .maybeSingle();

            const userRole = profile?.role || "employee";

            // Redirect based on role
            if (userRole === "admin" || userRole === "super_admin") {
              next = "/admin";
            } else if (userRole === "creator" || userRole === "partner") {
              next = "/creator";
            } else {
              // employee, ops, or default
              next = "/team";
            }

            console.log("[AuthCallback] Role-based redirect:", { userRole, next });
          }
        } catch (e) {
          console.error("[AuthCallback] Error determining role-based redirect:", e);
          next = "/team"; // Default fallback
        }
      }

      console.log("[AuthCallback] raw next:", raw, "final next:", next);
      nav(next, { replace: true });
    })();
  }, [authComplete, nav]);

  return (
    <div className="page">
      <div className="center-wrap" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>{msg}</p>
      </div>
    </div>
  );
}








