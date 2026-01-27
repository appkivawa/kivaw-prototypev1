/**
 * Environment Variable Validation and Access
 * 
 * This module provides a single source of truth for environment variables
 * with runtime validation and clear error messages.
 * 
 * Rules:
 * - Client-side code MUST use `import.meta.env.VITE_*` (Vite convention)
 * - Never use `process.env` in client-side code
 * - All env vars are validated at module load time
 */

type EnvConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  devAdminEmails: string[];
  isDev: boolean;
  isProd: boolean;
};

/**
 * Validates and returns environment configuration
 * Throws clear error messages if required variables are missing
 */
function getEnvConfig(): EnvConfig {
  const isDev = import.meta.env.DEV;
  const isProd = import.meta.env.PROD;

  // ============================================
  // REQUIRED: Supabase Configuration
  // ============================================
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    const errorMsg = isDev
      ? `Missing VITE_SUPABASE_URL

How to fix:
1. Copy .env.example to .env: cp .env.example .env
2. Set VITE_SUPABASE_URL in .env file
3. For local dev: Use http://localhost:54321 (after running 'supabase start')
4. For production: Use your Supabase project URL from dashboard

Get your URL from: https://app.supabase.com/project/YOUR_PROJECT/settings/api`
      : `Missing VITE_SUPABASE_URL

How to fix:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add VITE_SUPABASE_URL with your Supabase project URL
3. Get your URL from: https://app.supabase.com/project/YOUR_PROJECT/settings/api
4. Redeploy after adding the variable

Current environment: Production`;
    
    console.error("[env] ❌", errorMsg);
    throw new Error(errorMsg);
  }

  if (!supabaseAnonKey) {
    const errorMsg = isDev
      ? `Missing VITE_SUPABASE_ANON_KEY

How to fix:
1. Copy .env.example to .env: cp .env.example .env
2. Set VITE_SUPABASE_ANON_KEY in .env file
3. For local dev: Get from 'supabase status' after running 'supabase start'
4. For production: Get from Supabase dashboard → Settings → API

Get your key from: https://app.supabase.com/project/YOUR_PROJECT/settings/api`
      : `Missing VITE_SUPABASE_ANON_KEY

How to fix:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add VITE_SUPABASE_ANON_KEY with your Supabase anon key
3. Get your key from: https://app.supabase.com/project/YOUR_PROJECT/settings/api
4. Redeploy after adding the variable

Current environment: Production`;
    
    console.error("[env] ❌", errorMsg);
    throw new Error(errorMsg);
  }

  // ============================================
  // OPTIONAL: Development Admin Emails
  // ============================================
  const devAdminEmailsRaw = import.meta.env.VITE_DEV_ADMIN_EMAILS;
  const devAdminEmails = devAdminEmailsRaw
    ? devAdminEmailsRaw
        .split(",")
        .map((email: string) => email.trim())
        .filter(Boolean)
    : [];

  // ============================================
  // Validation: URL format
  // ============================================
  try {
    new URL(supabaseUrl);
  } catch {
    const errorMsg = `Invalid VITE_SUPABASE_URL format: "${supabaseUrl}"

Expected format: https://YOUR_PROJECT_REF.supabase.co
Or for local: http://localhost:54321`;
    
    console.error("[env] ❌", errorMsg);
    throw new Error(errorMsg);
  }

  // ============================================
  // Validation: Anon key format (basic check)
  // ============================================
  if (supabaseAnonKey.length < 50) {
    console.warn(
      "[env] ⚠️  VITE_SUPABASE_ANON_KEY seems too short. Expected ~200+ characters."
    );
  }

  // ============================================
  // Log configuration (safe info only)
  // ============================================
  if (isDev) {
    console.log("[env] ✅ Configuration loaded:", {
      supabaseUrl,
      anonKeyLength: supabaseAnonKey.length,
      devAdminEmailsCount: devAdminEmails.length,
      isDev,
    });
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    devAdminEmails,
    isDev,
    isProd,
  };
}

// Export validated configuration
export const env = getEnvConfig();

// Export individual values for convenience
export const SUPABASE_URL = env.supabaseUrl;
export const SUPABASE_ANON_KEY = env.supabaseAnonKey;
export const DEV_ADMIN_EMAILS = env.devAdminEmails;
export const IS_DEV = env.isDev;
export const IS_PROD = env.isProd;

// Type exports
export type { EnvConfig };
