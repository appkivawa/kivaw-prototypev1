import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { useRoles } from "../../auth/useRoles";
import { canViewApiSecrets } from "../permissions";

type AuditLogEntry = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_id: string | null;
  created_at: string;
  metadata: Record<string, any>;
  actor_email?: string | null;
};

type AuditLogFilters = {
  action: string;
  actor: string;
  dateFrom: string;
  dateTo: string;
};

export default function Security() {
  const { roleKeys, isSuperAdmin } = useRoles();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: "",
    actor: "",
    dateFrom: "",
    dateTo: "",
  });
  
  const canViewSecrets = canViewApiSecrets(roleKeys, isSuperAdmin || false);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("admin_audit_log")
        .select("id, actor_user_id, action, target_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(100);

      // Apply filters
      if (filters.action) {
        query = query.ilike("action", `%${filters.action}%`);
      }
      if (filters.actor) {
        // We'll filter by actor email after fetching
      }
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }

      const { data, error } = await query;

      if (error) {
        // If table doesn't exist, show helpful message
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setError(
            "The admin_audit_log table does not exist. Please run the SQL migration: supabase/migrations/create_admin_audit_log.sql"
          );
          setLogs([]);
          return;
        }
        throw error;
      }

      // Fetch actor emails
      const actorIds = (data || [])
        .map((log) => log.actor_user_id)
        .filter((id): id is string => id !== null && id !== undefined);

      let actorEmails: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", actorIds);

        if (profilesData) {
          actorEmails = Object.fromEntries(
            profilesData.map((p) => [p.id, p.email || "N/A"])
          );
        }
      }

      let logsWithEmails = (data || []).map((log) => ({
        ...log,
        actor_email: log.actor_user_id ? actorEmails[log.actor_user_id] : null,
      })) as AuditLogEntry[];

      // Filter by actor email if specified
      if (filters.actor) {
        logsWithEmails = logsWithEmails.filter(
          (log) =>
            log.actor_email?.toLowerCase().includes(filters.actor.toLowerCase()) ||
            log.actor_user_id?.toLowerCase().includes(filters.actor.toLowerCase())
        );
      }

      setLogs(logsWithEmails);
    } catch (e: any) {
      console.error("Error loading audit logs:", e);
      setError(e?.message || "Could not load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadLogs();
  }, [filters.action, filters.dateFrom, filters.dateTo]);

  // Reload when actor filter changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.actor]);

  function formatMetadata(metadata: Record<string, any>): string {
    if (!metadata || Object.keys(metadata).length === 0) return "—";
    return JSON.stringify(metadata, null, 2);
  }

  function getActionColor(action: string): string {
    if (action.includes("delete") || action.includes("remove")) return "#ef4444";
    if (action.includes("update") || action.includes("edit")) return "#3b82f6";
    if (action.includes("create") || action.includes("add")) return "#10b981";
    return "#6b7280";
  }

  if (loading && logs.length === 0) {
    return <p className="muted">Loading audit logs…</p>;
  }

  return (
    <div className="admin-security">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Security & Audit</h3>
        <button className="btn btn-ghost" type="button" onClick={loadLogs}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
          {error.includes("does not exist") && (
            <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
              <strong>Setup Required:</strong> Run the SQL migration in{" "}
              <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>
                supabase/migrations/create_admin_audit_log.sql
              </code>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="admin-filter-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">🔍</span>
          Filters
        </h4>
        <div className="admin-filter-grid">
          <div className="admin-filter-group">
            <label className="admin-filter-label">Action</label>
            <input
              type="text"
              className="admin-filter-input"
              placeholder="Filter by action..."
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            />
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label">Actor (Email/ID)</label>
            <input
              type="text"
              className="admin-filter-input"
              placeholder="Filter by actor..."
              value={filters.actor}
              onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
            />
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label">From Date</label>
            <input
              type="date"
              className="admin-filter-input"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label">To Date</label>
            <input
              type="date"
              className="admin-filter-input"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
        </div>
        <div className="admin-filter-actions">
          <button
            className="admin-action-btn"
            type="button"
            onClick={() =>
              setFilters({
                action: "",
                actor: "",
                dateFrom: "",
                dateTo: "",
              })
            }
          >
            🗑️ Clear Filters
          </button>
        </div>
      </Card>

      {/* Audit Logs */}
      <Card className="admin-section-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">📜</span>
          Audit Log ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})
        </h4>

        {logs.length > 0 ? (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target ID</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      {log.actor_email ? (
                        <div>
                          <div>{log.actor_email}</div>
                          {log.actor_user_id && (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              <code style={{ background: "var(--white-75)", padding: "2px 4px", borderRadius: 3 }}>
                                {log.actor_user_id.slice(0, 8)}...
                              </code>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="muted">System</span>
                      )}
                    </td>
                    <td>
                      <span
                        className="admin-badge"
                        style={{
                          background: getActionColor(log.action) + "20",
                          color: getActionColor(log.action),
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      {log.target_id ? (
                        <code
                          style={{
                            background: "var(--white-75)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {log.target_id.length > 20 ? log.target_id.slice(0, 20) + "..." : log.target_id}
                        </code>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <details style={{ cursor: "pointer" }}>
                        <summary style={{ fontSize: 12, color: "var(--text2)" }}>View</summary>
                        <pre
                          style={{
                            fontSize: 11,
                            padding: 8,
                            background: "var(--white-75)",
                            borderRadius: 4,
                            marginTop: 4,
                            maxWidth: 300,
                            overflow: "auto",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {formatMetadata(log.metadata)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">📋</div>
            <div className="admin-empty-state-title">No audit logs found</div>
            <div className="admin-empty-state-desc">
              {Object.values(filters).some((v) => v) 
                ? "Try adjusting your filters to see more results."
                : "Audit logs will appear here when admin actions are performed."}
            </div>
          </div>
        )}
      </Card>

      {/* API Secrets Section - Only visible to super admins */}
      {canViewSecrets && (
        <Card className="admin-section-card" style={{ marginTop: 24 }}>
          <h4 className="admin-subsection-title">
            <span className="admin-section-icon">🔑</span>
            API Secrets & Credentials
          </h4>
          <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: 8 }}>
            <p className="muted" style={{ marginBottom: 12 }}>
              Manage API keys, service tokens, and other sensitive credentials.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" disabled>
                View API Keys
              </button>
              <button className="btn btn-ghost" type="button" disabled>
                Rotate Secrets
              </button>
              <button className="btn btn-ghost" type="button" disabled>
                Service Tokens
              </button>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
              ⚠️ Only super admins can view and manage API secrets.
            </p>
          </div>
        </Card>
      )}

      {!canViewSecrets && (
        <Card className="admin-section-card" style={{ marginTop: 24, opacity: 0.6 }}>
          <div style={{ padding: 16, textAlign: "center" }}>
            <p className="muted">🔒 API Secrets section is only available to super admins.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
