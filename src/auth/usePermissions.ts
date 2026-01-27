import React from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "./useSession";

type Perms = {
  is_authenticated: boolean;
  user_id?: string;
  is_admin: boolean;
  is_super_admin: boolean;
  role_keys: string[];
};

type UsePermissionsResult = {
  loading: boolean;
  error: string | null;
  perms: Perms | null;
  roleKeys: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAuthed: boolean;
  refresh: () => void;
};

const CACHE_TTL_MS = 30_000;

let cacheUserId: string | null = null;
let cacheAt = 0;
let cacheValue: Perms | null = null;

export function usePermissions(): UsePermissionsResult {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user?.id || null;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [perms, setPerms] = React.useState<Perms | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      // Not authed
      if (!userId) {
        cacheUserId = null;
        cacheValue = null;
        cacheAt = 0;

        if (!cancelled) {
          setPerms(null);
          setLoading(false);
        }
        return;
      }

      // Cache
      const now = Date.now();
      if (cacheUserId === userId && cacheValue && now - cacheAt < CACHE_TTL_MS) {
        if (!cancelled) {
          setPerms(cacheValue);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error: rpcError } = await supabase.rpc("get_user_permissions");

      if (cancelled) return;

      if (rpcError) {
        setError(rpcError.message || "Failed to load permissions");
        setPerms(null);
        setLoading(false);
        return;
      }

      // Map RPC response to Perms format
      const val: Perms | null = data
        ? {
            is_authenticated: true,
            user_id: data.user_id,
            is_admin: data.is_admin || false,
            is_super_admin: data.is_super_admin || false,
            role_keys: data.role_keys || [],
          }
        : null;

      cacheUserId = userId;
      cacheValue = val;
      cacheAt = now;

      setPerms(val);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshTrigger]);

  const roleKeys = perms?.role_keys || [];
  const isSuperAdmin = !!perms?.is_super_admin;
  const isAdmin = !!perms?.is_admin || isSuperAdmin;
  const isAuthed = !!perms?.is_authenticated;

  // Refresh function to clear cache and reload
  const refresh = React.useCallback(() => {
    if (cacheUserId === userId) {
      cacheUserId = null;
      cacheValue = null;
      cacheAt = 0;
      setRefreshTrigger((prev) => prev + 1);
    }
  }, [userId]);

  return {
    loading: sessionLoading || loading,
    error,
    perms,
    roleKeys,
    isAdmin,
    isSuperAdmin,
    isAuthed,
    refresh,
  };
}


