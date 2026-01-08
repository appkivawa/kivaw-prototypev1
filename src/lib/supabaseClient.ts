import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("[supabaseClient] VITE_SUPABASE_URL is undefined");
  throw new Error("Missing VITE_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  console.error("[supabaseClient] VITE_SUPABASE_ANON_KEY is undefined");
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable");
}

// DEV ONLY: Check if using localhost (local Supabase mode)
// Edge Functions require either `supabase start` OR hosted Supabase URL
if (import.meta.env.DEV) {
  const isLocalhost = supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1");
  if (isLocalhost) {
    console.warn(
      "⚠️ [DEV] Using localhost Supabase URL. Edge Functions require:\n" +
      "  1. Run `supabase start` to start local Supabase with Edge Functions, OR\n" +
      "  2. Switch to hosted Supabase URL in .env.local\n" +
      "  Current URL: " + supabaseUrl
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use implicit flow for magic links (no PKCE verifier required)
  },
});

// Export URL and key for direct fetch (DEV only - bypasses supabase.functions.invoke)
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

console.log("[supabase]", supabaseUrl);
