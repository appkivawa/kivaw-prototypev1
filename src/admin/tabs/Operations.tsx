import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { logAdminAction } from "../auditLog";
import UserJourneyInspector from "../components/UserJourneyInspector";
import RequireRole from "../../auth/RequireRole";
import { useRoles } from "../../auth/useRoles";
import { canManage } from "../permissions";

type ContentItem = {
  id: string;
  title: string;
  kind: string | null;
  created_at: string;
  is_hidden?: boolean;
  is_reviewed?: boolean;
};

type UserReport = {
  id: string;
  user_id: string;
  content_id: string | null;
  content_item_id?: string | null; // For compatibility
  report_type: string;
  description: string;
  status: string;
  created_at: string;
  content_title?: string;
};

type HumanFlag = {
  user_id: string;
  user_email: string | null;
  flag_type: "frequent_destructive" | "long_echo_session" | "repeated_pattern";
  severity: "low" | "medium" | "high";
  description: string;
  metadata: Record<string, any>;
};

function OperationsContent() {
  const { roleKeys, isSuperAdmin } = useRoles();
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [humanFlags, setHumanFlags] = useState<HumanFlag[]>([]);
  const [, setLoadingFlags] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  
  // Operations role has limited access - can view but not manage
  const canManageOperations = canManage(roleKeys, isSuperAdmin || false, "operations");
  const isOperationsOnly = roleKeys.includes("operations") && !roleKeys.includes("admin") && !isSuperAdmin;

  async function loadRecentContent() {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, kind, created_at, is_hidden, is_reviewed")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentContent((data || []) as ContentItem[]);
    } catch (e: any) {
      console.error("Error loading recent content:", e);
      setError(e?.message || "Could not load recent content.");
    } finally {
      setLoadingContent(false);
    }
  }

  async function loadReports() {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from("user_reports")
        .select("id, user_id, report_type, content_id, description, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        // If table doesn't exist, that's okay - show empty state
        if (error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("schema cache")) {
          setReports([]);
          setError(null);
          return;
        }
        throw error;
      }

      // Fetch content titles for reports that reference content items
      // Note: content_id is TEXT in user_reports, may be UUID or other identifier
      const contentIds = (data || [])
        .map((r) => r.content_id)
        .filter((id): id is string => id !== null && id !== undefined);

      let contentTitles: Record<string, string> = {};
      if (contentIds.length > 0) {
        // Try to match as UUIDs first
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUuids = contentIds.filter((id) => uuidPattern.test(id));

        if (validUuids.length > 0) {
          const { data: contentData } = await supabase
            .from("content_items")
            .select("id, title")
            .in("id", validUuids);

          if (contentData) {
            contentData.forEach((item) => {
              contentTitles[item.id] = item.title;
            });
          }
        }
      }

      const reportsWithTitles = (data || []).map((r) => ({
        ...r,
        content_title: r.content_id ? contentTitles[r.content_id] || null : null,
      }));

      setReports(reportsWithTitles as UserReport[]);
    } catch (e: any) {
      console.error("Error loading reports:", e);
      setError(e?.message || "Could not load reports.");
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadHumanFlags() {
    setLoadingFlags(true);
    try {
      // This would query a human_flags table if it exists
      // For now, return empty array
      setHumanFlags([]);
    } catch (e: any) {
      console.error("Error loading human flags:", e);
    } finally {
      setLoadingFlags(false);
    }
  }

  async function updateContentVisibility(id: string, isHidden: boolean) {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from("content_items")
        .update({ is_hidden: isHidden })
        .eq("id", id);

      if (error) throw error;

      await logAdminAction("content_visibility", id, { is_hidden: isHidden });
      await loadRecentContent();
    } catch (e: any) {
      console.error("Error updating content visibility:", e);
      alert("Could not update content visibility: " + (e?.message || "Unknown error"));
    } finally {
      setUpdating(null);
    }
  }

  async function updateReportStatus(id: string, newStatus: string) {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from("user_reports")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) {
        // If table doesn't exist, that's okay
        if (error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("schema cache")) {
          alert("The user_reports table is not available. This feature requires the table to be created in the database.");
          return;
        }
        throw error;
      }

      await logAdminAction("report_status", id, { status: newStatus });
      await loadReports();
    } catch (e: any) {
      console.error("Error updating report status:", e);
      alert("Could not update report status: " + (e?.message || "Unknown error"));
    } finally {
      setUpdating(null);
    }
  }

  useEffect(() => {
    loadRecentContent();
    loadReports();
    loadHumanFlags();
  }, []);

  return (
    <div className="admin-operations">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Operations</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isOperationsOnly && (
            <div style={{ padding: 8, background: "var(--surface-2)", borderRadius: 8 }}>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                📖 Limited access: View-only mode
              </p>
            </div>
          )}
          <button className="btn btn-ghost" type="button" onClick={() => {
            loadRecentContent();
            loadReports();
            loadHumanFlags();
          }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Recent Content */}
      <Card className="admin-section-card" style={{ marginBottom: 24 }}>
        <h4 className="admin-subsection-title">Recent Content</h4>
        {loadingContent ? (
          <p className="muted">Loading…</p>
        ) : recentContent.length > 0 ? (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Kind</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentContent.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.kind || "—"}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>
                      {item.is_hidden ? (
                        <span className="admin-badge" style={{ background: "var(--danger)", color: "var(--ink)" }}>
                          Hidden
                        </span>
                      ) : (
                        <span className="admin-badge">Visible</span>
                      )}
                    </td>
                    <td>
                      {canManageOperations ? (
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => updateContentVisibility(item.id, !item.is_hidden)}
                          disabled={updating === item.id}
                        >
                          {updating === item.id ? "…" : item.is_hidden ? "Show" : "Hide"}
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No recent content.</p>
        )}
      </Card>

      {/* User Reports */}
      <Card className="admin-section-card" style={{ marginBottom: 24 }}>
        <h4 className="admin-subsection-title">User Reports</h4>
        {loadingReports ? (
          <p className="muted">Loading…</p>
        ) : reports.length > 0 ? (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Content</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.report_type}</td>
                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {report.description}
                    </td>
                    <td>{report.content_title || report.content_id || "—"}</td>
                    <td>
                      <span className="admin-badge">{report.status}</span>
                    </td>
                    <td>{new Date(report.created_at).toLocaleDateString()}</td>
                    <td>
                      {canManageOperations ? (
                        <select
                          className="admin-action-btn"
                          value={report.status}
                          onChange={(e) => updateReportStatus(report.id, e.target.value)}
                          disabled={updating === report.id}
                          style={{ padding: "6px 12px" }}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      ) : (
                        <span className="admin-badge">{report.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No user reports.</p>
        )}
      </Card>

      {/* Human Flags */}
      {humanFlags.length > 0 && (
        <Card className="admin-section-card">
          <h4 className="admin-subsection-title">Human Flags</h4>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Flag Type</th>
                  <th>Severity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {humanFlags.map((flag, idx) => (
                  <tr key={idx}>
                    <td>
                      <button
                        className="admin-action-btn"
                        type="button"
                        onClick={() => {
                          setSelectedUserId(flag.user_id);
                          setSelectedUserEmail(flag.user_email);
                        }}
                      >
                        {flag.user_email || flag.user_id.slice(0, 8)}
                      </button>
                    </td>
                    <td>{flag.flag_type}</td>
                    <td>
                      <span className="admin-badge">{flag.severity}</span>
                    </td>
                    <td>{flag.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedUserId && (
        <UserJourneyInspector
          userId={selectedUserId}
          userEmail={selectedUserEmail}
          onClose={() => {
            setSelectedUserId(null);
            setSelectedUserEmail(null);
          }}
        />
      )}
    </div>
  );
}

// Export with role-based access control
export default function Operations() {
  return (
    <RequireRole allow={["admin", "it"]}>
      <OperationsContent />
    </RequireRole>
  );
}




