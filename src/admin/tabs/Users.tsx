import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import RequireRole from "../../auth/RequireRole";
import { formatRoles } from "../../auth/roleUtils";
import { useRoles } from "../../auth/useRoles";
import { useSession } from "../../auth/useSession";
import { canViewSuperAdmins, hasPermission } from "../permissions";

type UserWithRoles = {
  id: string;
  email: string | null;
  created_at: string;
  roles: string[];
};

type Role = {
  id: string;
  key: string;
  name: string;
};

function UsersContent() {
  const { roleKeys, isSuperAdmin } = useRoles();
  const { session } = useSession();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [superAdminUserIds, setSuperAdminUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditRolesModal, setShowEditRolesModal] = useState<UserWithRoles | null>(null);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  
  const canViewSuperAdminsFlag = canViewSuperAdmins(roleKeys, isSuperAdmin || false);
  const currentUserId = session?.user?.id;

  // Load available roles
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("roles").select("id, key, name").order("key");
        
        if (error) {
          console.error("[Users] Error loading roles:", error);
          setError(`Failed to load roles: ${error.message} (Code: ${error.code})`);
          return;
        }
        
        if (!data || data.length === 0) {
          console.warn("[Users] No roles found in database.");
          setError("No roles found. Please run the RBAC migration to seed roles.");
          return;
        }
        
        setAvailableRoles(data.map((r: { id: string; key: string; name: string }) => ({
          id: String(r.id),
          key: String(r.key),
          name: String(r.name),
        })));
        setError(""); // Clear any previous errors
      } catch (e: any) {
        console.error("[Users] Exception loading roles:", e);
        setError(`Error loading roles: ${e?.message || "Unknown error"}`);
      }
    })();
  }, []);

  // Load users using direct database queries (no Edge Functions)
  async function loadUsers() {
    setLoading(true);
    setError("");
    
    try {
      // Get super admin user IDs and data (to filter them out for regular admins and check safeguards)
      const superAdminIds = new Set<string>();
      const superAdminDataMap = new Map<string, { isSuperAdmin: boolean }>();
      
      const { data: superAdminData } = await supabase
        .from("admin_allowlist")
        .select("user_id, super_admin")
        .eq("super_admin", true);
      
      if (superAdminData) {
        superAdminData.forEach((row) => {
          superAdminIds.add(row.user_id);
          superAdminDataMap.set(row.user_id, { isSuperAdmin: true });
        });
      }
      
      // Also mark non-super-admins for completeness
      const { data: allAdminData } = await supabase
        .from("admin_allowlist")
        .select("user_id, super_admin");
      
      if (allAdminData) {
        allAdminData.forEach((row) => {
          if (!superAdminDataMap.has(row.user_id)) {
            superAdminDataMap.set(row.user_id, { isSuperAdmin: false });
          }
        });
      }
      
      setSuperAdminUserIds(superAdminIds);

      // Get all profiles (users) - RLS allows admins to read all
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all user roles in one query
      const { data: userRolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role:roles!user_roles_role_id_fkey(id, key, name)");

      if (rolesError) {
        console.warn("Error fetching user roles:", rolesError);
        // Continue without roles if query fails
      }

      // Build a map of user_id -> role keys
      const rolesMap = new Map<string, string[]>();
      if (userRolesData) {
        for (const ur of userRolesData) {
          const uid = ur.user_id as string;
          const role = ur.role as unknown as { id: any; key: any; name: any } | null;
          if (role?.key) {
            if (!rolesMap.has(uid)) {
              rolesMap.set(uid, []);
            }
            rolesMap.get(uid)!.push(String(role.key));
          }
        }
      }

      // Combine profiles with roles
      let usersWithRoles: UserWithRoles[] = (profilesData || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        created_at: profile.created_at || new Date().toISOString(),
        roles: rolesMap.get(profile.id) || [],
      }));

      // Filter out super admins if user cannot view them
      if (!canViewSuperAdminsFlag) {
        usersWithRoles = usersWithRoles.filter((user) => !superAdminIds.has(user.id));
      }

      setUsers(usersWithRoles);
    } catch (e: any) {
      console.error("Error loading users:", e);
      setError(e?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    let result = users;
    
    // Filter out super admins if user cannot view them
    if (!canViewSuperAdminsFlag) {
      result = result.filter((user) => !superAdminUserIds.has(user.id));
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((user) => user.email?.toLowerCase().includes(query));
    }
    
    return result;
  }, [users, searchQuery, canViewSuperAdminsFlag, superAdminUserIds]);

  return (
    <div className="admin-users">
      <div className="admin-section-header">
        <div>
          <h3 className="admin-section-title">Users</h3>
          {users.length > 0 && (
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              {users.length} {users.length === 1 ? "user" : "users"}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Only super_admin and admin can assign roles (not ops) */}
          {(isSuperAdmin || hasPermission(roleKeys, isSuperAdmin || false, "manage_users")) && (
            <button className="btn" type="button" onClick={() => setShowInviteModal(true)}>
              ➕ Assign roles
            </button>
          )}
          <button className="btn btn-ghost" type="button" onClick={loadUsers} disabled={loading}>
            {loading ? "Loading…" : "🔄 Refresh"}
        </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
          <div>{error}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            Check browser console (F12) for details. Look for messages starting with [Users].
          </div>
        </div>
      )}
      
      {/* Roles Loading Warning (only show if there's an error) */}
      {availableRoles.length === 0 && error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No roles available</div>
          <div>{error}</div>
        </div>
      )}

      {/* Search Bar */}
      {users.length > 0 && (
        <div className="admin-search-wrapper" style={{ marginBottom: 16 }}>
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Loading State */}
      {loading && users.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <p className="muted">Loading users…</p>
              </div>
      )}

      {/* Users Table */}
      {!loading && filteredUsers.length > 0 && (
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
                  <th>Email</th>
                  <th>Created</th>
                  <th>Roles</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500, color: "var(--ink)" }}>
                      {user.email || "N/A"}
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {user.roles.length > 0 ? (
                          user.roles.map((roleKey) => (
                            <span key={roleKey} className="admin-badge">
                              {formatRoles([roleKey])}
                            </span>
                          ))
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            No roles
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {/* Only super_admin and admin can edit roles (not ops) */}
                      {(isSuperAdmin || hasPermission(roleKeys, isSuperAdmin || false, "manage_users")) ? (
                      <button
                        className="admin-action-btn"
                        type="button"
                          onClick={() => setShowEditRolesModal(user)}
                      >
                          Edit roles
                      </button>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>No access</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && filteredUsers.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <p className="muted">
            {searchQuery ? `No users found matching "${searchQuery}"` : "No users found."}
          </p>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          availableRoles={availableRoles}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadUsers();
          }}
        />
      )}

      {/* Edit Roles Modal */}
      {showEditRolesModal && (
        <EditRolesModal
          user={showEditRolesModal}
          availableRoles={availableRoles}
          onClose={() => setShowEditRolesModal(null)}
          onSuccess={() => {
            setShowEditRolesModal(null);
            loadUsers();
          }}
          currentUserId={currentUserId}
          isCurrentUserSuperAdmin={isSuperAdmin || false}
        />
      )}
    </div>
  );
}

// Invite User Modal Component
function InviteUserModal({
  availableRoles,
  onClose,
  onSuccess,
}: {
  availableRoles: Role[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim()) {
        setError("Email is required");
        setLoading(false);
        return;
      }

      // Note: Inviting users requires service role (admin API)
      // For now, we'll only assign roles to existing users
      // Find existing user by email
      const { data: profilesData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profilesData?.id) {
        throw new Error(
          "User not found. Please invite the user manually first, or they need to sign up before you can assign roles."
        );
      }

      // Assign roles to existing user
      await assignRolesToUser(profilesData.id, selectedRoles);

      onSuccess();
    } catch (e: any) {
      console.error("Error inviting user:", e);
      setError(e?.message || "Failed to invite user");
    } finally {
      setLoading(false);
    }
  }

  // Helper function to assign roles to a user
  async function assignRolesToUser(userId: string, roleKeys: string[]): Promise<void> {
    if (roleKeys.length === 0) return;

    // Get role IDs for the provided role keys
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("id, key")
      .in("key", roleKeys);

    if (rolesError) throw rolesError;
    if (!roles || roles.length === 0) {
      throw new Error(`No roles found for keys: ${roleKeys.join(", ")}`);
    }

    // Delete existing roles for this user
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.warn("Error deleting existing roles:", deleteError);
      // Continue anyway - might be first time assigning roles
    }

    // Insert new roles
    const roleAssignments = roles.map((role) => ({
      user_id: userId,
      role_id: role.id,
    }));

    const { error: insertError } = await supabase.from("user_roles").insert(roleAssignments);

    if (insertError) {
      throw new Error(`Failed to assign roles: ${insertError.message}`);
    }
  }

  function toggleRole(roleKey: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  }

  return (
    <div className="echo-modal-backdrop" onClick={onClose}>
      <div className="echo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="echo-modal-head">
          <div>
            <div className="echo-modal-title">Assign Roles to User</div>
            <div className="echo-modal-sub">
              Enter an existing user's email to assign roles. User must already be registered.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "var(--ink-muted)",
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="echo-modal-body">
            {error && (
              <div className="echo-alert" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
                <div>{error}</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label className="admin-filter-label">Email *</label>
              <input
                type="email"
                className="admin-filter-input"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="admin-filter-label">Roles</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {availableRoles.map((role) => (
                  <label
                    key={role.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: selectedRoles.includes(role.key)
                        ? "var(--accent)"
                        : "var(--surface-2)",
                      border: `1px solid ${
                        selectedRoles.includes(role.key) ? "var(--accent-2)" : "var(--border)"
                      }`,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.key)}
                      onChange={() => toggleRole(role.key)}
                      disabled={loading}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                    <span style={{ color: "var(--ink)", fontWeight: 500, flex: 1 }}>
                      {role.name}
                    </span>
                    <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                      ({role.key})
                    </span>
                  </label>
                ))}
                {availableRoles.length === 0 && (
                  <p className="muted" style={{ fontSize: 14, padding: "8px 0" }}>
                    No roles available
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="echo-modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Assigning…" : "Assign Roles"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Roles Modal Component
function EditRolesModal({
  user,
  availableRoles,
  onClose,
  onSuccess,
  currentUserId,
  isCurrentUserSuperAdmin,
}: {
  user: UserWithRoles;
  availableRoles: Role[];
  onClose: () => void;
  onSuccess: () => void;
  currentUserId?: string;
  isCurrentUserSuperAdmin: boolean;
}) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isUserSuperAdmin, setIsUserSuperAdmin] = useState(false);
  const [superAdminCount, setSuperAdminCount] = useState(0);

  // Check super admin status and count on mount
  useEffect(() => {
    (async () => {
      // Check if user is super admin
      const { data: userAdminData } = await supabase
        .from("admin_allowlist")
        .select("super_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      
      setIsUserSuperAdmin(userAdminData?.super_admin === true);
      
      // Count total super admins
      const { count } = await supabase
        .from("admin_allowlist")
        .select("*", { count: "exact", head: true })
        .eq("super_admin", true);
      
      setSuperAdminCount(count || 0);
    })();
  }, [user.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    // Check if removing super_admin status
    const wasSuperAdmin = isUserSuperAdmin;
    
    // Check safeguards using RPC function
    if (wasSuperAdmin) {
      const { data: safeguardCheck, error: safeguardError } = await supabase.rpc(
        "check_super_admin_safeguards",
        {
          target_user_id: user.id,
          will_have_super_admin: false, // This is about super_admin flag, not roles
        }
      );
      
      if (!safeguardError && safeguardCheck && !safeguardCheck.allowed) {
        // Show warning modal
        setWarningMessage(safeguardCheck.reason || "Cannot remove super_admin status.");
        setShowWarningModal(true);
        return;
      }
    }
    
    // Check if trying to remove own super_admin (via roles - this is a different check)
    // Note: super_admin is in admin_allowlist, not user_roles, but we check for consistency
    if (currentUserId === user.id && isCurrentUserSuperAdmin && wasSuperAdmin) {
      setWarningMessage("You cannot remove your own super_admin role.");
      setShowWarningModal(true);
      return;
    }
    
    // Check if this is the last super admin
    if (wasSuperAdmin && superAdminCount === 1) {
      setWarningMessage("Cannot remove super_admin: This is the last super admin in the system. At least one super admin must always exist.");
      setShowWarningModal(true);
      return;
    }
    
    // Proceed with role update
    await performRoleUpdate();
  }

  async function performRoleUpdate() {
    setLoading(true);

    try {
      // Get role IDs for the provided role keys
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("id, key")
        .in("key", selectedRoles);

      if (rolesError) throw rolesError;

      // If roles provided, verify they exist
      if (selectedRoles.length > 0) {
        if (!rolesData || rolesData.length === 0) {
          throw new Error(`No roles found for keys: ${selectedRoles.join(", ")}`);
        }

        // Check if all requested roles were found
        const foundRoleKeys = new Set(rolesData.map((r) => r.key));
        const missingRoles = selectedRoles.filter((key) => !foundRoleKeys.has(key));
        if (missingRoles.length > 0) {
          throw new Error(`Roles not found: ${missingRoles.join(", ")}`);
        }
      }

      // Delete existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        throw new Error(`Failed to remove existing roles: ${deleteError.message}`);
      }

      // Insert new roles (if any)
      if (rolesData && rolesData.length > 0) {
        const roleAssignments = rolesData.map((role) => ({
          user_id: user.id,
          role_id: role.id,
        }));

        const { error: insertError } = await supabase.from("user_roles").insert(roleAssignments);

        if (insertError) {
          throw new Error(`Failed to assign roles: ${insertError.message}`);
        }
      }

      onSuccess();
    } catch (e: any) {
      console.error("Error updating roles:", e);
      setError(e?.message || "Failed to update roles");
    } finally {
      setLoading(false);
    }
  }

  function toggleRole(roleKey: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  }

  return (
    <div className="echo-modal-backdrop" onClick={onClose}>
      <div className="echo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="echo-modal-head">
          <div>
            <div className="echo-modal-title">Edit Roles</div>
            <div className="echo-modal-sub" style={{ color: "var(--ink-muted)" }}>
              {user.email || user.id}
              {isUserSuperAdmin && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--accent)" }}>
                  ⭐ Super Admin
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "var(--ink-muted)",
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="echo-modal-body">
            {error && (
              <div className="echo-alert" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
                <div>{error}</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label className="admin-filter-label">Roles</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {availableRoles.map((role) => (
                  <label
                    key={role.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: selectedRoles.includes(role.key)
                        ? "var(--accent)"
                        : "var(--surface-2)",
                      border: `1px solid ${
                        selectedRoles.includes(role.key) ? "var(--accent-2)" : "var(--border)"
                      }`,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.key)}
                      onChange={() => toggleRole(role.key)}
                      disabled={loading}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                    <span style={{ color: "var(--ink)", fontWeight: 500, flex: 1 }}>
                      {role.name}
                    </span>
                    <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                      ({role.key})
                    </span>
                  </label>
                ))}
                {availableRoles.length === 0 && (
                  <p className="muted" style={{ fontSize: 14, padding: "8px 0" }}>
                    No roles available
                  </p>
                )}
              </div>
            </div>
            
            {/* Super Admin Status Management (only for super admins) */}
            {isCurrentUserSuperAdmin && (
              <div style={{ marginTop: 24, padding: 16, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <label className="admin-filter-label" style={{ marginBottom: 12 }}>
                  Super Admin Status
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={isUserSuperAdmin}
                    onChange={async (e) => {
                      const willBeSuperAdmin = e.target.checked;
                      
                      // Check safeguards
                      if (!willBeSuperAdmin && isUserSuperAdmin) {
                        // Trying to remove super_admin
                        const { data: safeguardCheck, error: safeguardError } = await supabase.rpc(
                          "check_super_admin_safeguards",
                          {
                            target_user_id: user.id,
                            will_have_super_admin: false,
                          }
                        );
                        
                        if (!safeguardError && safeguardCheck && !safeguardCheck.allowed) {
                          setWarningMessage(safeguardCheck.reason || "Cannot remove super_admin status.");
                          setShowWarningModal(true);
                          return;
                        }
                        
                        // Additional frontend checks
                        if (currentUserId === user.id) {
                          setWarningMessage("You cannot remove your own super_admin role.");
                          setShowWarningModal(true);
                          return;
                        }
                        
                        if (superAdminCount === 1) {
                          setWarningMessage("Cannot remove super_admin: This is the last super admin in the system. At least one super admin must always exist.");
                          setShowWarningModal(true);
                          return;
                        }
                      }
                      
                      // Update super_admin status
                      if (willBeSuperAdmin) {
                        // Add to admin_allowlist with super_admin = true
                        const { error: upsertError } = await supabase
                          .from("admin_allowlist")
                          .upsert({ user_id: user.id, super_admin: true }, { onConflict: "user_id" });
                        
                        if (upsertError) {
                          setError(`Failed to set super_admin: ${upsertError.message}`);
                          return;
                        }
                        setIsUserSuperAdmin(true);
                      } else {
                        // Remove super_admin (but keep in allowlist as regular admin)
                        const { error: updateError } = await supabase
                          .from("admin_allowlist")
                          .update({ super_admin: false })
                          .eq("user_id", user.id);
                        
                        if (updateError) {
                          setError(`Failed to remove super_admin: ${updateError.message}`);
                          return;
                        }
                        setIsUserSuperAdmin(false);
                      }
                      
                      // Refresh super admin count
                      const { count } = await supabase
                        .from("admin_allowlist")
                        .select("*", { count: "exact", head: true })
                        .eq("super_admin", true);
                      setSuperAdminCount(count || 0);
                    }}
                    disabled={loading || (currentUserId === user.id && isUserSuperAdmin)}
                    style={{ cursor: currentUserId === user.id && isUserSuperAdmin ? "not-allowed" : "pointer", width: 18, height: 18 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "var(--ink)", fontWeight: 500 }}>
                      Super Admin
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                      {currentUserId === user.id && isUserSuperAdmin
                        ? "You cannot remove your own super_admin status"
                        : isUserSuperAdmin
                        ? "User has ultimate admin powers"
                        : "Grant ultimate admin powers"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="echo-modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
        
        {/* Warning Modal */}
        {showWarningModal && (
          <div className="echo-modal-backdrop" style={{ zIndex: 1001 }} onClick={() => setShowWarningModal(false)}>
            <div className="echo-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div className="echo-modal-head">
                <div>
                  <div className="echo-modal-title" style={{ color: "var(--warning)" }}>
                    ⚠️ Action Restricted
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWarningModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "var(--ink-muted)",
                    padding: 0,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
              <div className="echo-modal-body">
                <p style={{ color: "var(--ink)", lineHeight: 1.6, marginBottom: 16 }}>
                  {warningMessage}
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
                  This safeguard ensures the system always has at least one super admin and prevents accidental lockout.
                </p>
              </div>
              <div className="echo-modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowWarningModal(false)}
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export with role-based access control
// Allow super_admin and admin (not ops)
export default function Users() {
  return (
    <RequireRole allow={["admin"]}>
      <UsersContent />
    </RequireRole>
  );
}
