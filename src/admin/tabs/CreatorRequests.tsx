import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../ui/Card";
import RequireRole from "../../auth/RequireRole";
import { logAdminAction } from "../auditLog";

type CreatorRequest = {
  id: string;
  name: string;
  email: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function CreatorRequestsContent() {
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("creator_access_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setRequests(data || []);
    } catch (e: any) {
      console.error("Error loading creator requests:", e);
      setError(e?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateRequestStatus(
    requestId: string,
    newStatus: "approved" | "rejected"
  ) {
    setUpdating(requestId);
    try {
      // Get current user ID for reviewed_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("creator_access_requests")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // If approved, try to assign creator role
      if (newStatus === "approved") {
        await assignCreatorRole(requestId);
      }

      // Log admin action
      try {
        await logAdminAction(
          `creator_request_${newStatus}`,
          requestId,
          { status: newStatus }
        );
      } catch (logError) {
        console.log("Audit log not available, logging to console:", {
          action: `creator_request_${newStatus}`,
          requestId,
          status: newStatus,
        });
      }

      // Reload requests
      await loadRequests();
    } catch (e: any) {
      console.error("Error updating request:", e);
      alert(e?.message || "Failed to update request");
    } finally {
      setUpdating(null);
    }
  }

  async function assignCreatorRole(requestId: string) {
    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      // Check if user exists by email
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", request.email.toLowerCase())
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        // PGRST116 is "not found" which is fine
        console.warn("Error checking for user:", profileError);
      }

      if (profiles?.id) {
        // User exists - assign creator role
        const { data: creatorRole, error: roleError } = await supabase
          .from("roles")
          .select("id")
          .eq("key", "creator")
          .maybeSingle();

        if (roleError) {
          console.warn("Error fetching creator role:", roleError);
          return;
        }

        if (creatorRole) {
          // Check if user already has creator role
          const { data: existingRole, error: checkError } = await supabase
            .from("user_roles")
            .select("role_id")
            .eq("user_id", profiles.id)
            .eq("role_id", creatorRole.id)
            .maybeSingle();

          if (checkError && checkError.code !== "PGRST116") {
            console.warn("Error checking existing role:", checkError);
            return;
          }

          if (!existingRole) {
            // Assign creator role - use upsert to prevent duplicates
            const { error: assignError } = await supabase
              .from("user_roles")
              .upsert(
                [
                  {
                    user_id: profiles.id,
                    role_id: creatorRole.id,
                  },
                ],
                {
                  onConflict: "user_id,role_id",
                  ignoreDuplicates: true,
                }
              );

            if (assignError) {
              console.warn("Error assigning creator role:", assignError);
            } else {
              console.log("Creator role assigned to user:", profiles.id);
            }
          } else {
            console.log("User already has creator role");
          }
        }
      }
      // If user doesn't exist, we just mark as approved and they'll need to sign up
    } catch (e: any) {
      console.error("Error assigning creator role:", e);
      // Don't throw - approval should still succeed even if role assignment fails
    }
  }

  const filteredRequests = requests.filter((req) => {
    if (filter === "all") return true;
    return req.status === filter;
  });

  return (
    <div className="admin-creator-requests">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Creator Access Requests</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className="admin-filter-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{ padding: "6px 12px" }}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn btn-ghost" type="button" onClick={loadRequests}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <Card className="admin-section-card">
          <p className="muted">Loading requests…</p>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="admin-section-card">
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">📭</div>
            <div className="admin-empty-state-title">No requests found</div>
            <div className="admin-empty-state-desc">
              {filter === "pending"
                ? "No pending requests at the moment."
                : `No ${filter} requests found.`}
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredRequests.map((request) => (
              <Card key={request.id} className="admin-section-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                      <h4 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                        {request.name}
                      </h4>
                      <span
                        className="admin-badge"
                        style={{
                          background:
                            request.status === "approved"
                              ? "var(--success)"
                              : request.status === "rejected"
                              ? "var(--danger)"
                              : "var(--warning)",
                          color:
                            request.status === "approved"
                              ? "#86efac"
                              : request.status === "rejected"
                              ? "#fca5a5"
                              : "#fde047",
                        }}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 4 }}>
                      {request.email}
                    </p>
                    <p style={{ color: "var(--ink-tertiary)", fontSize: 12 }}>
                      Submitted {new Date(request.created_at).toLocaleDateString()} at{" "}
                      {new Date(request.created_at).toLocaleTimeString()}
                    </p>
                    {request.reviewed_at && (
                      <p style={{ color: "var(--ink-tertiary)", fontSize: 12, marginTop: 4 }}>
                        Reviewed {new Date(request.reviewed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {request.message && (
                  <div
                    style={{
                      padding: 12,
                      background: "var(--surface-2)",
                      borderRadius: 8,
                      marginBottom: 16,
                    }}
                  >
                    <p style={{ color: "var(--ink)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                      {request.message}
                    </p>
                  </div>
                )}

                {request.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => updateRequestStatus(request.id, "rejected")}
                      disabled={updating === request.id}
                      style={{
                        background: "var(--danger)",
                        color: "#fca5a5",
                        borderColor: "var(--danger)",
                      }}
                    >
                      {updating === request.id ? "…" : "Reject"}
                    </button>
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => updateRequestStatus(request.id, "approved")}
                      disabled={updating === request.id}
                      style={{
                        background: "var(--success)",
                        color: "#86efac",
                        borderColor: "var(--success)",
                      }}
                    >
                      {updating === request.id ? "…" : "Approve"}
                    </button>
                  </div>
                )}

                {request.status === "approved" && (
                  <div
                    style={{
                      padding: 12,
                      background: "var(--surface-2)",
                      borderRadius: 8,
                      marginTop: 12,
                    }}
                  >
                    <p style={{ color: "var(--ink-muted)", fontSize: 13, margin: 0 }}>
                      ✅ Approved. If user exists, creator role has been assigned. If not, user must sign up with{" "}
                      <strong>{request.email}</strong> to activate access.
                    </p>
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

export default function CreatorRequests() {
  return (
    <RequireRole allow={["admin", "ops"]}>
      <CreatorRequestsContent />
    </RequireRole>
  );
}

