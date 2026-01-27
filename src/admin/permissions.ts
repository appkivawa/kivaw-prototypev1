/**
 * Admin Dashboard Permissions System
 *
 * Role Tiers:
 * - super_admin: Full access to everything
 * - admin: Most things, but cannot see/modify super_admins, platform security, API secrets
 * - operations / ops / it / social_media: scoped access
 *
 * IMPORTANT:
 * This module must be resilient to partial/late-loading roleKeys.
 * If backend says isSuperAdmin=true, we must behave like super_admin no matter what.
 */

export type RoleTier = "super_admin" | "admin" | "operations" | "ops" | "it" | "social_media";

export type Permission =
  | "view_overview"
  | "view_users"
  | "view_super_admins"
  | "manage_users"
  | "view_content"
  | "manage_content"
  | "view_analytics"
  | "manage_analytics"
  | "view_operations"
  | "manage_operations"
  | "view_settings"
  | "manage_settings"
  | "view_security"
  | "manage_security"
  | "view_api_secrets"
  | "manage_api_secrets"
  | "view_support"
  | "manage_support"
  | "view_health"
  | "manage_health"
  | "view_finance"
  | "manage_finance"
  | "view_experiments"
  | "manage_experiments"
  | "view_integrations"
  | "manage_integrations"
  | "view_recommendations_preview";

/**
 * Permission map: defines what each role tier can do
 */
const PERMISSIONS: Record<RoleTier, Permission[]> = {
  super_admin: [
    "view_overview",
    "view_users",
    "view_super_admins",
    "manage_users",
    "view_content",
    "manage_content",
    "view_analytics",
    "manage_analytics",
    "view_operations",
    "manage_operations",
    "view_settings",
    "manage_settings",
    "view_security",
    "manage_security",
    "view_api_secrets",
    "manage_api_secrets",
    "view_support",
    "manage_support",
    "view_health",
    "manage_health",
    "view_finance",
    "manage_finance",
    "view_experiments",
    "manage_experiments",
    "view_integrations",
    "manage_integrations",
    "view_recommendations_preview",
  ],
  admin: [
    "view_overview",
    "view_users",
    "manage_users",
    "view_content",
    "manage_content",
    "view_analytics",
    "manage_analytics",
    "view_operations",
    "manage_operations",
    "view_settings",
    "manage_settings",
    "view_support",
    "manage_support",
    "view_health",
    "manage_health",
    "view_finance",
    "manage_finance",
    "view_experiments",
    "manage_experiments",
    "view_integrations",
    "manage_integrations",
    "view_recommendations_preview",
  ],
  operations: [
    "view_content",
    "manage_content",
    "view_analytics",
    "view_operations",
  ],
  ops: [
    "view_overview",
    "view_content",
    "manage_content",
    "view_analytics",
    "view_operations",
    "view_support",
    "view_health",
  ],
  it: [
    "view_overview",
    "view_users",
    "manage_users",
    "view_content",
    "manage_content",
    "view_analytics",
    "manage_analytics",
    "view_operations",
    "manage_operations",
    "view_settings",
    "manage_settings",
    "view_support",
    "manage_support",
    "view_health",
    "manage_health",
  ],
  social_media: [
    "view_overview",
    "view_content",
    "manage_content",
    "view_analytics",
    "manage_analytics",
  ],
};

/**
 * Tab visibility map: defines which tabs each role can see
 */
export const TAB_PERMISSIONS: Record<string, Permission[]> = {
  overview: ["view_overview"],
  users: ["view_users"],
  content: ["view_content"],
  analytics: ["view_analytics"],
  operations: ["view_operations"],
  settings: ["view_settings"],
  support: ["view_support"],
  health: ["view_health"],
  security: ["view_security"],
  finance: ["view_finance"],
  experiments: ["view_experiments"],
  creator_requests: ["view_content"],
  integrations: ["view_integrations"],
  recommendations_preview: ["view_recommendations_preview"],
  publish_to_explore: ["manage_content"], // manage implies view+write intent
};

/**
 * Normalize roles to avoid silly casing/whitespace mismatches.
 */
function normalizeRoleKeys(roleKeys: string[]): string[] {
  return (roleKeys || []).map((r) => String(r).trim().toLowerCase()).filter(Boolean);
}

/**
 * Get user's role tier from their roles.
 *
 * Accepts BOTH:
 * - boolean isSuperAdmin (from RPC)
 * - roleKeys containing "super_admin" (in case you later model it as a role key too)
 */
export function getUserRoleTier(roleKeys: string[], isSuperAdmin: boolean): RoleTier | null {
  const keys = normalizeRoleKeys(roleKeys);

  // Absolute top: RPC says super admin => you are super admin
  if (isSuperAdmin) return "super_admin";

  // Also treat explicit role key "super_admin" as super admin
  if (keys.includes("super_admin")) return "super_admin";

  // Admin tier
  if (keys.includes("admin")) return "admin";

  // Other tiers
  if (keys.includes("operations")) return "operations";
  if (keys.includes("ops")) return "ops";
  if (keys.includes("it")) return "it";
  if (keys.includes("social_media")) return "social_media";

  return null;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(roleKeys: string[], isSuperAdmin: boolean, permission: Permission): boolean {
  const tier = getUserRoleTier(roleKeys, isSuperAdmin);
  if (!tier) return false;

  // super admin: allow everything that exists in this system
  if (tier === "super_admin") return true;

  return PERMISSIONS[tier].includes(permission);
}

/**
 * Check if user can view a specific tab
 */
export function canViewTab(roleKeys: string[], isSuperAdmin: boolean, tabName: string): boolean {
  const tier = getUserRoleTier(roleKeys, isSuperAdmin);
  if (!tier) return false;

  // super admin sees all tabs defined here
  if (tier === "super_admin") return true;

  const tabPerms = TAB_PERMISSIONS[tabName];
  if (!tabPerms || tabPerms.length === 0) return false;

  // Must have at least one required permission
  return tabPerms.some((perm) => hasPermission(roleKeys, isSuperAdmin, perm));
}

/**
 * Check if user can manage (not just view) a resource
 */
export function canManage(
  roleKeys: string[],
  isSuperAdmin: boolean,
  resource:
    | "content"
    | "analytics"
    | "operations"
    | "settings"
    | "security"
    | "api_secrets"
    | "support"
    | "health"
    | "finance"
    | "experiments"
): boolean {
  const managePerm = `manage_${resource}` as Permission;
  return hasPermission(roleKeys, isSuperAdmin, managePerm);
}

/**
 * Check if user can see super admin users
 */
export function canViewSuperAdmins(roleKeys: string[], isSuperAdmin: boolean): boolean {
  return hasPermission(roleKeys, isSuperAdmin, "view_super_admins");
}

/**
 * Check if user can see security settings
 */
export function canViewSecurity(roleKeys: string[], isSuperAdmin: boolean): boolean {
  return hasPermission(roleKeys, isSuperAdmin, "view_security");
}

/**
 * Check if user can see API secrets
 */
export function canViewApiSecrets(roleKeys: string[], isSuperAdmin: boolean): boolean {
  return hasPermission(roleKeys, isSuperAdmin, "view_api_secrets");
}


