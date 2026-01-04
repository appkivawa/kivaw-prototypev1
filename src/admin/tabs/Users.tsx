import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";

type User = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>(""); // Store detailed error for debugging
  const [searchQuery, setSearchQuery] = useState("");

  async function loadUsers() {
    setLoadingUsers(true);
    setUsersError("");
    setErrorDetails("");
    
    try {
      // Direct query to profiles table - RLS will handle admin-only access
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, created_at, last_sign_in_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        
        // Check if it's an RLS/permission error
        if (profilesError.code === "42501" || profilesError.message?.includes("permission denied")) {
          setUsersError("Permission denied. Please ensure you have admin access (is_admin=true in profiles table).");
        } else if (profilesError.code === "42P01" || profilesError.message?.includes("does not exist")) {
          setUsersError("Profiles table does not exist. Please run the migration: supabase/migrations/create_profiles_table.sql");
        } else {
          setUsersError(`Could not load users: ${profilesError.message || profilesError.code || "Unknown error"}`);
        }
        
        setUsers([]);
        setTotal(0);
        return;
      }

      // Get total count
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const total = count || 0;
      const users = (profiles || []).map((p) => ({
        id: p.id,
        email: p.email || null,
        created_at: p.created_at,
        last_sign_in_at: p.last_sign_in_at || null,
      }));

      setUsers(users);
      setTotal(total);
    } catch (error: any) {
      console.error("Error loading users:", error);
      const errorMsg = error?.message || "Unknown error";
      setUsersError(`Could not load users: ${errorMsg}`);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="admin-users">
      <div className="admin-section-header">
        <div>
          <h3 className="admin-section-title">User Management</h3>
          {total > 0 && (
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              Total: {total.toLocaleString()} users
            </p>
          )}
        </div>
        <button className="btn btn-ghost" type="button" onClick={loadUsers}>
          {loadingUsers ? "Loading…" : "🔄 Refresh"}
        </button>
      </div>

      {/* Search Bar */}
      {users.length > 0 && (
        <div className="admin-search-wrapper" style={{ marginBottom: 16 }}>
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by email or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

        {loadingUsers ? (
          <p className="muted">Loading users…</p>
        ) : usersError ? (
          <div className="admin-error">
            <div className="echo-alert">
              <div style={{ marginBottom: 8 }}>
                <strong>Error loading users:</strong>
              </div>
              <div style={{ marginBottom: 12 }}>{usersError}</div>
              {errorDetails && (
                <details style={{ marginTop: 12, marginBottom: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
                    Show error details (for debugging)
                  </summary>
                  <pre style={{ 
                    marginTop: 8, 
                    padding: 12, 
                    background: "var(--white-75)", 
                    borderRadius: 4, 
                    fontSize: 11, 
                    overflow: "auto",
                    maxHeight: "300px"
                  }}>
                    {errorDetails}
                  </pre>
                </details>
              )}
              <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
                <strong>Troubleshooting:</strong>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Check Supabase Dashboard → Edge Functions → admin-users → Logs for detailed error messages</li>
                  <li>Ensure the <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>
                    admin-users
                  </code> edge function is deployed</li>
                  <li>Verify your email is in the allowlist or <code>is_admin=true</code> in profiles table</li>
                  <li>If you see "profiles table does not exist", run the migration: <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>
                    supabase/migrations/create_profiles_table.sql
                  </code></li>
                </ul>
              </div>
            </div>
          </div>
        ) : filteredUsers.length > 0 ? (
        <>
          {searchQuery && (
            <p className="muted" style={{ marginBottom: 12 }}>
              Showing {filteredUsers.length} of {users.length} users
            </p>
          )}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Email</th>
                  <th>Created</th>
                  <th>Last Sign-in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <code className="admin-code">{user.id.slice(0, 8)}...</code>
                    </td>
                    <td>{user.email || "N/A"}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : "Never"}</td>
                    <td>
                      <button
                        className="admin-action-btn"
                        type="button"
                        onClick={() => {
                          alert(`User actions for ${user.id}`);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : searchQuery ? (
        <p className="muted">No users found matching "{searchQuery}"</p>
      ) : (
        <p className="muted">No users found.</p>
      )}
    </div>
  );
}


