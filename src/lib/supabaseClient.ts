import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* -----------------------------
   Hard env checks (GOOD PRACTICE)
------------------------------ */
if (!supabaseUrl) {
  console.error("[supabaseClient] VITE_SUPABASE_URL is undefined");
  throw new Error("Missing VITE_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  console.error("[supabaseClient] VITE_SUPABASE_ANON_KEY is undefined");
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable");
}

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

/* -----------------------------
   Optional exports (DEV tools)
------------------------------ */
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

console.log("[supabase] connected:", supabaseUrl);

