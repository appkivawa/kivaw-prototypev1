/**
 * Admin Dashboard Permissions System
 * 
 * Role Tiers:
 * - super_admin: Full access to everything
 * - admin: Most things, but cannot see/modify super_admins, platform security, API secrets
 * - operations: Limited access - only Content, Operations (limited), Analytics (read-only)
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
  | "manage_experiments";

/**
 * Permission map: defines what each role tier can do
 */
const PERMISSIONS: Record<RoleTier, Permission[]> = {
  super_admin: [
    // Super admin sees everything
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
  ],
  admin: [
    // Admin sees most things, but NOT super_admins, security, or API secrets
    "view_overview",
    "view_users",
    "manage_users", // Can manage users, but not super_admins (filtered in UI)
    "view_content",
    "manage_content",
    "view_analytics",
    "manage_analytics",
    "view_operations",
    "manage_operations",
    "view_settings",
    "manage_settings", // Limited settings (no security/API secrets)
    "view_support",
    "manage_support",
    "view_health",
    "manage_health",
    "view_finance",
    "manage_finance",
    "view_experiments",
    "manage_experiments",
  ],
  operations: [
    // Operations: Limited access
    "view_content",
    "manage_content",
    "view_analytics", // Read-only
    "view_operations", // Limited operations
  ],
  ops: [
    // Ops: Limited access - cannot assign roles, access settings, or manage users
    "view_overview",
    "view_content",
    "manage_content",
    "view_analytics", // Read-only
    "view_operations", // Limited operations (view-only)
    "view_support", // Can view support tickets
    "view_health", // Can view system health
    // Explicitly NOT included:
    // - view_users, manage_users (cannot manage users)
    // - view_settings, manage_settings (cannot access settings)
    // - manage_analytics (read-only analytics)
    // - manage_operations (view-only operations)
  ],
  it: [
    // IT support: Similar to admin but focused on technical
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
    // Social media: Content and analytics focus
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
};

/**
 * Get user's role tier from their roles
 */
export function getUserRoleTier(
  roleKeys: string[],
  isSuperAdmin: boolean
): RoleTier | null {
  if (isSuperAdmin) return "super_admin";
  if (roleKeys.includes("admin")) return "admin";
  if (roleKeys.includes("operations")) return "operations";
  if (roleKeys.includes("ops")) return "ops";
  if (roleKeys.includes("it")) return "it";
  if (roleKeys.includes("social_media")) return "social_media";
  return null;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  roleKeys: string[],
  isSuperAdmin: boolean,
  permission: Permission
): boolean {
  const tier = getUserRoleTier(roleKeys, isSuperAdmin);
  if (!tier) return false;
  
  const userPermissions = PERMISSIONS[tier];
  return userPermissions.includes(permission);
}

/**
 * Check if user can view a specific tab
 */
export function canViewTab(
  roleKeys: string[],
  isSuperAdmin: boolean,
  tabName: string
): boolean {
  const tabPerms = TAB_PERMISSIONS[tabName];
  if (!tabPerms || tabPerms.length === 0) return false;
  
  // User needs at least one permission for the tab
  return tabPerms.some((perm) => hasPermission(roleKeys, isSuperAdmin, perm));
}

/**
 * Check if user can manage (not just view) a resource
 */
export function canManage(
  roleKeys: string[],
  isSuperAdmin: boolean,
  resource: "content" | "analytics" | "operations" | "settings" | "security" | "api_secrets" | "support" | "health" | "finance" | "experiments"
): boolean {
  const managePerm = `manage_${resource}` as Permission;
  return hasPermission(roleKeys, isSuperAdmin, managePerm);
}

/**
 * Check if user can see super admin users
 */
export function canViewSuperAdmins(
  roleKeys: string[],
  isSuperAdmin: boolean
): boolean {
  return hasPermission(roleKeys, isSuperAdmin, "view_super_admins");
}

/**
 * Check if user can see security settings
 */
export function canViewSecurity(
  roleKeys: string[],
  isSuperAdmin: boolean
): boolean {
  return hasPermission(roleKeys, isSuperAdmin, "view_security");
}

/**
 * Check if user can see API secrets
 */
export function canViewApiSecrets(
  roleKeys: string[],
  isSuperAdmin: boolean
): boolean {
  return hasPermission(roleKeys, isSuperAdmin, "view_api_secrets");
}

