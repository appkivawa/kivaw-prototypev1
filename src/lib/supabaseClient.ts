import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// Environment variables are validated in env.ts
// If we reach here, they are guaranteed to be set
const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

/* -----------------------------
   Supabase client (SINGLE SOURCE)
------------------------------ */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* -----------------------------
   DEV: Expose client on window for debugging
------------------------------ */
if (import.meta.env.DEV) {
  // Expose Supabase client on window for browser console access
  // Usage in DevTools:
  //   - Access client: window.supabase
  //   - Get access token: (await window.supabase.auth.getSession()).data.session?.access_token
  //   - Call Edge Function: window.supabase.functions.invoke('function-name', { body: {...} })
  (window as any).supabase = supabase;

  const isLocalhost =
    supabaseUrl.includes("localhost") ||
    supabaseUrl.includes("127.0.0.1");

  if (isLocalhost) {
    console.warn(
      "⚠️ [DEV] Using localhost Supabase URL.\n" +
        "Edge Functions require:\n" +
        "  1. `supabase start` for local Edge Functions, OR\n" +
        "  2. A hosted Supabase URL\n" +
        "Current URL: " +
        supabaseUrl
    );
  }
}

// Re-export for backward compatibility (prefer importing from env.ts)
export { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

if (import.meta.env.DEV) {
  console.log("[supabase] ✅ Connected to:", supabaseUrl);
}

