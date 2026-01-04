/**
 * Admin Email Allowlist
 * 
 * Fallback list of admin emails when profiles table doesn't exist or is_admin field is unavailable.
 * Only use this as a last resort - prefer using the profiles.is_admin field.
 */

export const ADMIN_EMAIL_ALLOWLIST: string[] = [
  "kivawapp@proton.me",
];

