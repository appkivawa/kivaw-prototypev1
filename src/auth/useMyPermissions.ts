import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "./useSession";

export type MyPermissions = {
  is_authenticated: boolean;
  user_id?: string;
  email?: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  role_keys: string[];
};

const EMPTY: MyPermissions = {
  is_authenticated: false,
  is_admin: false,
  is_super_admin: false,
  role_keys: [],
};

export function useMyPermissions() {
  const { session, loading: sessionLoading, isAuthed } = useSession();

  const [loading, setLoading] = useState(true);
  const [perms, setPerms] = useState<MyPermissions>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);

      // Wait for session to bootstrap (prevents flicker)
      if (sessionLoading) {
        setLoading(true);
        return;
      }

      // Not logged in
      if (!isAuthed || !session?.user) {
        if (!alive) return;
        setPerms(EMPTY);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Call get_user_permissions RPC (single source of truth)
      const { data, error: rpcError } = await supabase.rpc("get_user_permissions");

      if (!alive) return;

      if (rpcError) {
        setError(rpcError.message || "Failed to load permissions");
        setPerms({
          is_authenticated: true, // logged in but permissions lookup failed
          user_id: session.user.id,
          email: session.user.email,
          is_admin: false,
          is_super_admin: false,
          role_keys: [],
        });
        setLoading(false);
        return;
      }

      // Map RPC response to MyPermissions format
      if (data) {
        setPerms({
          is_authenticated: true,
          user_id: data.user_id,
          email: data.email,
          is_admin: data.is_admin || false,
          is_super_admin: data.is_super_admin || false,
          role_keys: data.role_keys || [],
        });
      } else {
        setPerms(EMPTY);
      }
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [sessionLoading, isAuthed, session?.user?.id]);

  return { loading, perms, error };
}
