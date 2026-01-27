import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../ui/Card";
import { useRoles } from "../auth/useRoles";
import { useSession } from "../auth/useSession";
import { DEV_ADMIN_EMAILS } from "../lib/env";

/**
 * Admin Debug Page - Diagnostic tool to help debug admin access issues
 * Access this at /admin-debug (add route temporarily)
 */
export default function AdminDebug() {
  const { session } = useSession();
  const { roles, roleKeys, isAdmin, loading, error, rpcAdminCheck } = useRoles();
  const [directQuery, setDirectQuery] = useState<any>(null);
  const [rpcResult, setRpcResult] = useState<any>(null);
  const [adminAllowlistCheck, setAdminAllowlistCheck] = useState<any>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // Test direct query
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role_id, role:roles!user_roles_role_id_fkey(id, key, name)")
          .eq("user_id", userId);
        setDirectQuery({ data, error });
      } catch (e: any) {
        setDirectQuery({ error: e.message });
      }
    })();

    // Test RPC - try both parameter names
    (async () => {
      try {
        // Try with check_uid first (correct parameter name)
        const { data, error } = await supabase.rpc("is_admin", { check_uid: userId });
        if (error && error.message?.includes("check_uid")) {
          // Fallback to uid if check_uid doesn't work
          const { data: data2, error: error2 } = await supabase.rpc("is_admin", { uid: userId });
          setRpcResult({ data: data2, error: error2 });
        } else {
          setRpcResult({ data, error });
        }
      } catch (e: any) {
        setRpcResult({ error: e.message });
      }
    })();

    // Test admin_allowlist
    (async () => {
      try {
        const { data, error } = await supabase
          .from("admin_allowlist")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        setAdminAllowlistCheck({ data, error });
      } catch (e: any) {
        setAdminAllowlistCheck({ error: e.message });
      }
    })();
  }, [session?.user?.id]);

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad" style={{ maxWidth: "800px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginBottom: 24 }}>
            Admin Access Debug
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* User Info */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                User Info
              </h2>
              <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: "var(--ink)", margin: 0 }}>
                  {JSON.stringify(
                    {
                      userId: session?.user?.id,
                      email: session?.user?.email,
                      authenticated: !!session,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </section>

            {/* useRoles Hook Results */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                useRoles Hook Results
              </h2>
              <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: "var(--ink)", margin: 0 }}>
                  {JSON.stringify(
                    {
                      loading,
                      error,
                      roles,
                      roleKeys,
                      isAdmin,
                      rpcAdminCheck,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </section>

            {/* Direct Query Test */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                Direct Query Test
              </h2>
              <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: "var(--ink)", margin: 0 }}>
                  {JSON.stringify(directQuery, null, 2)}
                </pre>
              </div>
            </section>

            {/* RPC Test */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                RPC is_admin() Test
              </h2>
              <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: "var(--ink)", margin: 0 }}>
                  {JSON.stringify(rpcResult, null, 2)}
                </pre>
              </div>
            </section>

            {/* Admin Allowlist Test */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                admin_allowlist Test
              </h2>
              <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: "var(--ink)", margin: 0 }}>
                  {JSON.stringify(adminAllowlistCheck, null, 2)}
                </pre>
              </div>
            </section>

            {/* Environment Variables */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                Environment Variables
              </h2>
              <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: "var(--ink)", margin: 0 }}>
                  {JSON.stringify(
                    {
                      DEV: import.meta.env.DEV,
                      VITE_DEV_ADMIN_EMAILS: DEV_ADMIN_EMAILS.join(","),
                      parsedEmails: DEV_ADMIN_EMAILS,
                      userEmail: session?.user?.email,
                      emailMatches: DEV_ADMIN_EMAILS.some((email: string) => email.toLowerCase() === session?.user?.email?.toLowerCase()),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}

