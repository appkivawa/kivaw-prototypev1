// src/auth/useSession.ts
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

/**
 * Stable session hook.
 *
 * Fixes a common Supabase auth race:
 * - onAuthStateChange fires "INITIAL_SESSION" (sometimes with null) before getSession resolves
 * - guards see isAuthed=false and redirect (esp. on /admin nested routes)
 *
 * Strategy:
 * - Keep loading=true until getSession resolves at least once
 * - Ignore INITIAL_SESSION events until bootstrapped
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrappedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // 1) Bootstrap from getSession (single source of truth for initial load)
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (error) {
          console.warn("[useSession] getSession error:", error.message);
        }

        setSession(data.session ?? null);
      } finally {
        if (!mountedRef.current) return;
        bootstrappedRef.current = true;
        setLoading(false);
      }
    })();

    // 2) Subscribe to auth changes, but ignore all events until bootstrapped
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mountedRef.current) return;

      // Ignore all events until bootstrap completes (prevents flicker/redirects)
      if (!bootstrappedRef.current) {
        return;
      }

      // After bootstrap, process all auth state changes normally
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    loading,
    isAuthed: !!session?.user,
    user: session?.user ?? null,
  };
}


