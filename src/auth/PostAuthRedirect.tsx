// src/auth/PostAuthRedirect.tsx
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "./useSession";
import { isAdmin as isAdminDb } from "./adminAuth";

function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  let next = raw;

  try {
    next = decodeURIComponent(next);
  } catch {}

  // block absolute urls
  if (next.startsWith("http")) return null;

  if (!next.startsWith("/")) next = "/" + next;
  return next;
}

export default function PostAuthRedirect() {
  const nav = useNavigate();
  const loc = useLocation();
  const { isAuthed, loading } = useSession();

  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (loading) return;
    if (!isAuthed) return;

    // ✅ Only run on auth entry points.
    // If you run this on /feed, you'll keep teleporting back to /admin.
    const path = loc.pathname;
    const isEntry = path === "/login" || path === "/auth/callback";
    if (!isEntry) return;

    ran.current = true;

    const url = new URL(window.location.href);
    const next = sanitizeNext(url.searchParams.get("next"));

    (async () => {
      // If next was explicitly set (team/admin/feed), respect it.
      if (next) {
        nav(next, { replace: true });
        return;
      }

      // Otherwise:
      // - admins go to /admin
      // - everyone else goes to /feed
      try {
        const admin = await isAdminDb();
        nav(admin ? "/admin" : "/feed", { replace: true });
      } catch {
        nav("/feed", { replace: true });
      }
    })();
  }, [isAuthed, loading, loc.pathname, nav]);

  return null;
}



