import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "./useSession";
import { isAdmin as checkIsAdmin, isOps as checkIsOps, hasAnyRole, hasRole } from "./roleUtils";
import type { RoleKey } from "./roleUtils";

type Role = {
  id: string;
  key: string;
  name: string;
};

// In-memory cache for roles
let rolesCache: Map<string, Role[]> = new Map();
let rolesCacheTime: Map<string, number> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// DEVELOPMENT FAILSAFE: Temporary admin email list to prevent lockout
// TODO: Remove this after confirming admin access works correctly
const getDevAdminEmails = () => {
  if (!import.meta.env.DEV) return [];
  
  // Hardcoded fallback for emergency access (remove after fixing)
  const HARDCODED_DEV_EMAILS = ["kivawapp@proton.me"];
  
  const envVar = import.meta.env.VITE_DEV_ADMIN_EMAILS;
  if (envVar) {
    const emails = envVar.split(",").map((e: string) => e.trim()).filter(Boolean);
    if (emails.length > 0) {
      return emails;
    }
  }
  
  // Fallback to hardcoded list if env var not loaded
  if (import.meta.env.DEV) {
    console.warn(
      "[useRoles] VITE_DEV_ADMIN_EMAILS not loaded, using hardcoded fallback",
      HARDCODED_DEV_EMAILS
    );
  }
  
  return HARDCODED_DEV_EMAILS;
};

/**
 * Hook to fetch and manage current user's roles
 * 
 * Features:
 * - Fetches roles from user_roles join roles table using explicit FK join
 * - Caches roles in memory (5-minute TTL)
 * - Auto-refreshes on login/logout
 * - Exposes role checking utilities
 * - Safe fallbacks to prevent lockout
 * 
 * Note: Client-side checks are for UX only.
 * Security is enforced by RLS policies and Edge Functions.
 */
export function useRoles() {
  const { session } = useSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rpcAdminCheck, setRpcAdminCheck] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  const fetchRoles = useCallback(async (userId: string) => {
    // Check cache first
    const cached = rolesCache.get(userId);
    const cacheTime = rolesCacheTime.get(userId);
    const now = Date.now();

    if (cached && cacheTime && now - cacheTime < CACHE_DURATION) {
      if (import.meta.env.DEV) {
        console.log("[useRoles] Using cached roles for user:", userId);
        console.log("[useRoles] Cached role keys:", cached.map((r) => r.key));
      }
      setRoles(cached);
      setLoading(false);
      return cached;
    }

    // CRITICAL: AGGRESSIVE DEV FAILSAFE - Check email FIRST before any database queries
    // This prevents lockout when RLS policies have recursion issues
    if (import.meta.env.DEV && session?.user?.email) {
      const devEmails = getDevAdminEmails();
      const userEmail = session.user.email.toLowerCase();
      
      if (import.meta.env.DEV) {
        console.log("[useRoles] DEV failsafe pre-check:", { 
          userEmail, 
          envVar: import.meta.env.VITE_DEV_ADMIN_EMAILS,
          devEmails,
          willMatch: devEmails.some((email: string) => email.toLowerCase() === userEmail)
        });
      }
      
      if (devEmails.length > 0 && devEmails.some((email: string) => email.toLowerCase() === userEmail)) {
        console.warn(
          "⚠️ [useRoles] DEV FAILSAFE ACTIVATED (PRE-QUERY): Email matches - granting admin immediately",
          { userEmail, matchedEmails: devEmails }
        );
        const tempAdminRole: Role = {
          id: "dev-failsafe-immediate",
          key: "admin",
          name: "Administrator (Dev Failsafe)",
        };
        setRoles([tempAdminRole]);
        setLoading(false);
        rolesCache.set(userId, [tempAdminRole]);
        rolesCacheTime.set(userId, now);
        return [tempAdminRole];
      }
    }

    try {
      setError(null);
      setLoading(true);
      setRpcAdminCheck(null);

      if (import.meta.env.DEV) {
        console.log("[useRoles] Fetching roles for user:", userId);
        console.log("[useRoles] User email:", session?.user?.email);
      }

      // CORRECTED QUERY: Use explicit foreign key join
      // Query: "role_id, role:roles!user_roles_role_id_fkey(id, key, name)"
      const { data, error: fetchError } = await supabase
        .from("user_roles")
        .select("role_id, role:roles!user_roles_role_id_fkey(id, key, name)")
        .eq("user_id", userId);

      if (import.meta.env.DEV) {
        console.log("[useRoles] Query result:", { 
          data, 
          error: fetchError,
          dataLength: data?.length,
          firstItem: data?.[0]
        });
      }

      // Handle errors - log in DEV but don't throw on permission/RLS errors
      let queryFailed = false;
      if (fetchError) {
        queryFailed = true;
        // If user_roles table doesn't exist, return empty array
        if (fetchError.code === "42P01") {
          if (import.meta.env.DEV) {
            console.warn("[useRoles] user_roles table does not exist");
          }
        } else if (fetchError.code === "42501" || fetchError.message?.includes("permission denied")) {
          // RLS or permission error - log but don't throw, proceed to fallbacks
          if (import.meta.env.DEV) {
            console.error("[useRoles] Permission denied - RLS may be blocking role reads:", fetchError);
          }
        } else if (fetchError.code === "42P17" || fetchError.message?.includes("infinite recursion")) {
          // Infinite recursion in RLS policy - this is a database issue
          if (import.meta.env.DEV) {
            console.error("[useRoles] Infinite recursion detected in RLS policy - this is a database configuration issue:", fetchError);
          }
        } else {
          // Other errors - log but still try fallbacks
          if (import.meta.env.DEV) {
            console.error("[useRoles] Query error:", fetchError);
          }
        }
      }

      // Extract role objects from the joined data
      // Query returns: [{ role_id, role: { id, key, name } }, ...]
      // Map from ur.role (not ur.roles) because of the alias in the query
      let userRoles: Role[] = [];
      
      if (data && data.length > 0) {
        userRoles = data
          .map((ur: any) => {
            // The query uses "role:roles!..." so the property is "role" (singular)
            const role = ur.role as { id: string; key: string; name: string } | null;
            if (import.meta.env.DEV && role) {
              console.log("[useRoles] Extracted role:", role.key, role);
            }
            return role ? { id: role.id, key: role.key, name: role.name } : null;
          })
          .filter((r): r is Role => r !== null);
      }

      // Check admin status directly from query result
      const isAdminFromQuery = (data ?? []).some((r: any) => r.role?.key === "admin");

      if (import.meta.env.DEV) {
        console.log("[useRoles] Admin check from query result:", isAdminFromQuery);
        console.log("[useRoles] Extracted roles:", userRoles);
        console.log("[useRoles] Role keys:", userRoles.map((r) => r.key));
      }

      // FALLBACK 1: If join query failed or returned empty, try RPC function is_admin()
      // NOTE: RPC function expects 'check_uid' parameter, not 'uid'
      if (userRoles.length === 0 || queryFailed) {
        try {
          if (import.meta.env.DEV) {
            console.log("[useRoles] Attempting RPC is_admin fallback...");
          }

          // Check super admin status first (most powerful)
          const { data: isSuperAdminData, error: superAdminError } = await supabase.rpc("is_super_admin", {
            check_uid: userId,
          });

          if (!superAdminError && isSuperAdminData === true) {
            setIsSuperAdmin(true);
            if (import.meta.env.DEV) {
              console.log("[useRoles] User is SUPER ADMIN");
            }
            // Super admins are also admins - inject admin role
            if (!userRoles.some((r) => r.key === "admin")) {
              userRoles.push({
                id: "super-admin-injected",
                key: "admin",
                name: "Administrator (Super Admin)",
              });
            }
          } else {
            setIsSuperAdmin(false);
          }

          // RPC function expects 'check_uid' parameter (not 'uid')
          const { data: isAdminData, error: rpcError } = await supabase.rpc("is_admin", {
            check_uid: userId,
          });

          if (import.meta.env.DEV) {
            console.log("[useRoles] RPC is_admin result:", { isAdminData, rpcError });
            console.log("[useRoles] RPC is_super_admin result:", { isSuperAdminData, superAdminError });
          }

          if (!rpcError && isAdminData === true) {
            // User is admin via RPC but roles query failed/returned empty
            // This indicates RLS blocking the roles query or query issue
            if (import.meta.env.DEV) {
              console.warn(
                "[useRoles] RPC confirms admin but roles query failed/empty - injecting synthetic admin role"
              );
            }
            setRpcAdminCheck(true);
            // Inject synthetic admin role
            userRoles.push({
              id: "rpc-admin-fallback",
              key: "admin",
              name: "Administrator",
            });
          } else if (rpcError) {
            if (import.meta.env.DEV) {
              console.log("[useRoles] RPC is_admin error:", rpcError);
              // If parameter name is wrong, try with 'uid' as fallback
              if (rpcError.message?.includes("check_uid") || rpcError.message?.includes("no matches")) {
                console.log("[useRoles] Trying RPC with 'uid' parameter...");
                const { data: isAdminData2, error: rpcError2 } = await supabase.rpc("is_admin", {
                  uid: userId,
                });
                if (!rpcError2 && isAdminData2 === true) {
                  setRpcAdminCheck(true);
                  userRoles.push({
                    id: "rpc-admin-fallback-uid",
                    key: "admin",
                    name: "Administrator",
                  });
                }
              }
            }
            setRpcAdminCheck(false);
          } else {
            setRpcAdminCheck(false);
          }
        } catch (rpcErr) {
          // RPC function might not exist, ignore
          if (import.meta.env.DEV) {
            console.log("[useRoles] RPC is_admin exception:", rpcErr);
          }
          setRpcAdminCheck(false);
        }
      }

      // FALLBACK 2: DEVELOPMENT FAILSAFE (if query failed and RPC didn't work)
      // If roles query failed/empty AND user email matches DEV_ADMIN_EMAILS, grant admin access
      if (userRoles.length === 0 && session?.user?.email) {
        const devEmails = getDevAdminEmails();
        const userEmail = session.user.email?.toLowerCase() || "";
        if (devEmails.length > 0 && devEmails.some((email: string) => email.toLowerCase() === userEmail)) {
          console.warn(
            "⚠️ [useRoles] DEVELOPMENT FAILSAFE ACTIVATED: Granting admin access to",
            userEmail,
            "- This is temporary and should be removed after fixing role queries"
          );
          // Create a temporary admin role object
          const tempAdminRole: Role = {
            id: "temp-dev-admin",
            key: "admin",
            name: "Administrator (Dev Failsafe)",
          };
          userRoles.push(tempAdminRole);
        }
      }

      // Update cache
      rolesCache.set(userId, userRoles);
      rolesCacheTime.set(userId, now);

      setRoles(userRoles);
      setLoading(false);
      return userRoles;
    } catch (e: any) {
      // Catch any unexpected errors
      if (import.meta.env.DEV) {
        console.error("[useRoles] Unexpected error fetching roles:", e);
      }
      setError(e?.message || "Failed to fetch roles");

      // FALLBACK 3: On error, try RPC check
      if (session?.user?.id) {
        try {
          // Try with check_uid first
          const { data: isAdminData, error: rpcError } = await supabase.rpc("is_admin", {
            check_uid: userId,
          });

          if (!rpcError && isAdminData === true) {
            if (import.meta.env.DEV) {
              console.warn("[useRoles] Error occurred but RPC confirms admin - injecting synthetic admin role");
            }
            setRpcAdminCheck(true);
            const tempAdminRole: Role = {
              id: "rpc-admin-fallback-error",
              key: "admin",
              name: "Administrator",
            };
            setRoles([tempAdminRole]);
            setLoading(false);
            rolesCache.set(userId, [tempAdminRole]);
            rolesCacheTime.set(userId, Date.now());
            return [tempAdminRole];
          }
        } catch (rpcErr) {
          // Ignore RPC errors
        }
      }

      // FALLBACK 4: DEVELOPMENT FAILSAFE on error
      if (session?.user?.email) {
        const devEmails = getDevAdminEmails();
        const userEmail = session.user.email?.toLowerCase() || "";
        if (devEmails.length > 0 && devEmails.some((email: string) => email.toLowerCase() === userEmail)) {
          console.warn(
            "⚠️ [useRoles] DEVELOPMENT FAILSAFE ACTIVATED (on error): Granting admin access to",
            userEmail,
            "- This is temporary"
          );
          const tempAdminRole: Role = {
            id: "temp-dev-admin-error",
            key: "admin",
            name: "Administrator (Dev Failsafe)",
          };
          setRoles([tempAdminRole]);
          setLoading(false);
          rolesCache.set(userId, [tempAdminRole]);
          rolesCacheTime.set(userId, Date.now());
          return [tempAdminRole];
        }
      }

      setRoles([]);
      setLoading(false);
      return [];
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (!session?.user?.id) {
      setRoles([]);
      setLoading(false);
      setRpcAdminCheck(null);
      setIsSuperAdmin(false);
      return;
    }

    fetchRoles(session.user.id);
  }, [session?.user?.id, fetchRoles]);

  // Refresh roles when auth state changes (login/logout)
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_IN" && newSession?.user?.id) {
        // Clear cache and refetch on login
        rolesCache.delete(newSession.user.id);
        rolesCacheTime.delete(newSession.user.id);
        fetchRoles(newSession.user.id);
      } else if (event === "SIGNED_OUT") {
        // Clear cache on logout
        rolesCache.clear();
        rolesCacheTime.clear();
        setRoles([]);
        setLoading(false);
        setRpcAdminCheck(null);
        setIsSuperAdmin(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const refreshRoles = useCallback(() => {
    if (session?.user?.id) {
      rolesCache.delete(session.user.id);
      rolesCacheTime.delete(session.user.id);
      fetchRoles(session.user.id);
    }
  }, [session?.user?.id, fetchRoles]);

  // Memoized role keys array
  const roleKeys = useMemo(() => roles.map((r) => r.key), [roles]);

  // Memoized isAdmin check
  const isAdminValue = useMemo(() => {
    const result = checkIsAdmin(roleKeys);
    if (import.meta.env.DEV) {
      console.log("[useRoles] isAdmin check:", { roleKeys, result, rpcAdminCheck });
    }
    return result;
  }, [roleKeys, rpcAdminCheck]);

  // Memoized isOps check
  const isOpsValue = useMemo(() => {
    const result = checkIsOps(roleKeys);
    if (import.meta.env.DEV) {
      console.log("[useRoles] isOps check:", { roleKeys, result });
    }
    return result;
  }, [roleKeys]);

  // Memoized role checking functions
  const hasRoleFn = useCallback(
    (roleKey: RoleKey): boolean => hasRole(roleKeys, roleKey),
    [roleKeys]
  );

  const hasAnyRoleFn = useCallback(
    (allow: RoleKey[]): boolean => {
      const result = hasAnyRole(roleKeys, allow);
      if (import.meta.env.DEV) {
        console.log("[useRoles] hasAnyRole check:", { roleKeys, allow, result });
      }
      return result;
    },
    [roleKeys]
  );

  return {
    roles,
    roleKeys,
    isAdmin: isAdminValue || isSuperAdmin, // Super admins are also admins
    isSuperAdmin, // Expose super admin status
    isOps: isOpsValue, // Expose ops status
    loading,
    error,
    rpcAdminCheck, // Expose RPC check result for guard components
    hasRole: hasRoleFn,
    hasAnyRole: hasAnyRoleFn,
    refreshRoles,
  };
}
