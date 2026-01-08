import type { RoleKey } from "./roleUtils";

/**
 * Determines the landing route after login based on user roles
 * 
 * Rules:
 * - super_admin OR admin -> "/admin"
 * - ops -> "/admin" (since /ops route doesn't exist yet)
 * - creator/partner -> "/creator"
 * - everyone else -> "/team"
 * 
 * @param roleKeys - Array of role keys the user has
 * @param isSuperAdmin - Whether user is super admin
 * @returns Landing route path
 */
export function getLandingRouteFromRoles(
  roleKeys: RoleKey[],
  isSuperAdmin: boolean
): "/admin" | "/creator" | "/team" {
  // Super admin or admin -> /admin
  if (isSuperAdmin || roleKeys.includes("admin")) {
    return "/admin";
  }
  
  // Ops -> /admin (since /ops route doesn't exist)
  if (roleKeys.includes("ops")) {
    return "/admin";
  }
  
  // Creator/partner -> /creator
  if (roleKeys.includes("creator") || roleKeys.includes("partner")) {
    return "/creator";
  }
  
  // Default: team
  return "/team";
}


