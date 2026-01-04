import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { logAdminAction } from "../auditLog";
import UserJourneyInspector from "../components/UserJourneyInspector";

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

export default function Operations() {
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [humanFlags, setHumanFlags] = useState<HumanFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);

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
        // If table doesn't exist, that's okay
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setReports([]);
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
            contentTitles = Object.fromEntries(
              contentData.map((item) => [item.id, item.title || "Untitled"])
            );
          }
        }
      }

      const reportsWithTitles = (data || []).map((report) => ({
        ...report,
        content_item_id: report.content_id || null,
        content_title: report.content_id ? contentTitles[report.content_id] : undefined,
      }));

      setReports(reportsWithTitles as UserReport[]);
    } catch (e: any) {
      console.error("Error loading reports:", e);
      // Don't set error for reports - it's optional
    } finally {
      setLoadingReports(false);
    }
  }

  async function markAsReviewed(contentId: string) {
    setUpdating(contentId);
    try {
      // Check if is_reviewed column exists, if not we'll handle the error
      const { error } = await supabase
        .from("content_items")
        .update({ is_reviewed: true })
        .eq("id", contentId);

      if (error) {
        // If column doesn't exist, we could create it, but for now just log
        console.warn("Could not mark as reviewed (column may not exist):", error);
        alert("Could not mark as reviewed. The is_reviewed column may need to be added to the content_items table.");
        return;
      }

      // Log the action
      await logAdminAction("content_mark_reviewed", contentId, {
        reviewed: true,
      });

      // Refresh the list
      await loadRecentContent();
    } catch (e: any) {
      console.error("Error marking as reviewed:", e);
      alert("Error: " + (e?.message || "Could not mark as reviewed."));
    } finally {
      setUpdating(null);
    }
  }

  async function toggleHidden(contentId: string, currentHidden: boolean) {
    setUpdating(contentId);
    try {
      const { error } = await supabase
        .from("content_items")
        .update({ is_hidden: !currentHidden })
        .eq("id", contentId);

      if (error) {
        // If column doesn't exist, try to add it via a migration note
        if (error.message?.includes("column") && error.message?.includes("is_hidden")) {
          alert(
            "The is_hidden column does not exist. Please run this SQL migration:\n\n" +
              "ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;"
          );
          return;
        }
        throw error;
      }

      // Log the action
      await logAdminAction("content_toggle_hidden", contentId, {
        hidden: !currentHidden,
      });

      // Refresh the list
      await loadRecentContent();
    } catch (e: any) {
      console.error("Error toggling hidden:", e);
      alert("Error: " + (e?.message || "Could not update visibility."));
    } finally {
      setUpdating(null);
    }
  }

  async function updateReportStatus(reportId: string, newStatus: string) {
    setUpdating(reportId);
    try {
      const { error } = await supabase
        .from("user_reports")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", reportId);

      if (error) throw error;

      // Refresh reports
      await loadReports();
    } catch (e: any) {
      console.error("Error updating report status:", e);
      alert("Error: " + (e?.message || "Could not update report status."));
    } finally {
      setUpdating(null);
    }
  }

  async function loadHumanFlags() {
    setLoadingFlags(true);
    try {
      const flags: HumanFlag[] = [];

      // Get all users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, last_state");

      if (!profiles) return;

      // Check for frequent "Destructive" use
      const destructiveUsers = profiles.filter((p) => p.last_state === "Destructive");
      for (const user of destructiveUsers) {
        // Check how many times they've used Destructive recently
        const { data: recentEchoes } = await supabase
          .from("echoes")
          .select("id, created_at")
          .eq("user_id", user.id)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        // Check if they've used Destructive multiple times in a short period
        const destructiveCount = recentEchoes?.length || 0;
        if (destructiveCount >= 5) {
          flags.push({
            user_id: user.id,
            user_email: user.email,
            flag_type: "frequent_destructive",
            severity: destructiveCount >= 10 ? "high" : destructiveCount >= 7 ? "medium" : "low",
            description: `User has used "Destructive" state ${destructiveCount} times in the last 7 days`,
            metadata: { count: destructiveCount, period: "7 days" },
          });
        }
      }

      // Check for extremely long echo sessions
      const { data: allEchoes } = await supabase
        .from("echoes")
        .select("id, user_id, created_at, reflection")
        .not("reflection", "is", null);

      if (allEchoes) {
        const userEchoGroups: Record<string, any[]> = {};
        allEchoes.forEach((echo) => {
          if (!userEchoGroups[echo.user_id]) {
            userEchoGroups[echo.user_id] = [];
          }
          userEchoGroups[echo.user_id].push(echo);
        });

        Object.entries(userEchoGroups).forEach(([userId, echoes]) => {
          // Check for very long reflections (over 2000 words)
          const longReflections = echoes.filter((e) => {
            if (!e.reflection) return false;
            const wordCount = e.reflection.split(/\s+/).filter((w: string) => w.length > 0).length;
            return wordCount > 2000;
          });

          if (longReflections.length > 0) {
            const user = profiles.find((p) => p.id === userId);
            flags.push({
              user_id: userId,
              user_email: user?.email || null,
              flag_type: "long_echo_session",
              severity: longReflections.length >= 3 ? "high" : "medium",
              description: `User has ${longReflections.length} very long reflection(s) (2000+ words)`,
              metadata: { count: longReflections.length },
            });
          }

          // Check for repeated patterns (same reflection text multiple times)
          const reflectionTexts = echoes.map((e) => e.reflection?.trim().toLowerCase()).filter(Boolean);
          const textCounts: Record<string, number> = {};
          reflectionTexts.forEach((text) => {
            textCounts[text] = (textCounts[text] || 0) + 1;
          });

          const repeated = Object.entries(textCounts).find(([_, count]) => count >= 3);
          if (repeated) {
            const user = profiles.find((p) => p.id === userId);
            if (!flags.find((f) => f.user_id === userId && f.flag_type === "repeated_pattern")) {
              flags.push({
                user_id: userId,
                user_email: user?.email || null,
                flag_type: "repeated_pattern",
                severity: "low",
                description: `User has repeated the same reflection text ${repeated[1]} times`,
                metadata: { count: repeated[1] },
              });
            }
          }
        });
      }

      setHumanFlags(flags);
    } catch (e: any) {
      console.error("Error loading human flags:", e);
    } finally {
      setLoadingFlags(false);
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
        <h3 className="admin-section-title">Moderation Queue</h3>
        <div>
          <button className="btn btn-ghost" type="button" onClick={loadRecentContent}>
            {loadingContent ? "Loading…" : "🔄 Refresh Content"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={loadReports}>
            {loadingReports ? "Loading…" : "🔄 Refresh Reports"}
          </button>
        </div>
      </div>

      {error && <div className="echo-alert" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Recently Created Content */}
      <Card className="admin-section-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">📝</span>
          Recently Created Content
        </h4>
        {loadingContent ? (
          <p className="muted">Loading content…</p>
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
                    <td>{item.title || "Untitled"}</td>
                    <td>
                      {item.kind && <span className="admin-badge">{item.kind}</span>}
                    </td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>
                      {item.is_hidden && (
                        <span className="admin-badge" style={{ background: "#ef4444", color: "white" }}>
                          Hidden
                        </span>
                      )}
                      {item.is_reviewed && (
                        <span className="admin-badge" style={{ background: "#10b981", color: "white", marginLeft: 4 }}>
                          Reviewed
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => markAsReviewed(item.id)}
                          disabled={updating === item.id || item.is_reviewed}
                          style={{ fontSize: 12, padding: "4px 8px" }}
                        >
                          {item.is_reviewed ? "✓ Reviewed" : "Mark Reviewed"}
                        </button>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => toggleHidden(item.id, item.is_hidden || false)}
                          disabled={updating === item.id}
                          style={{ fontSize: 12, padding: "4px 8px" }}
                        >
                          {item.is_hidden ? "👁️ Show" : "🙈 Hide"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No recent content items.</p>
        )}
      </Card>

      {/* User Reports */}
      {reports.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Card className="admin-section-card">
          <h4 className="admin-subsection-title">
            <span className="admin-section-icon">🚨</span>
            Recent Reports
          </h4>
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
                    <td>
                      <span className="admin-badge">{report.report_type}</span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {report.description}
                    </td>
                    <td>
                      {report.content_title ? (
                        <span>{report.content_title}</span>
                      ) : (
                        <span className="muted">N/A</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-badge admin-status-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>{new Date(report.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {report.status === "open" && (
                          <button
                            className="admin-action-btn"
                            type="button"
                            onClick={() => updateReportStatus(report.id, "in_progress")}
                            disabled={updating === report.id}
                            style={{ fontSize: 12, padding: "4px 8px" }}
                          >
                            Assign
                          </button>
                        )}
                        {report.status !== "resolved" && (
                          <button
                            className="admin-action-btn"
                            type="button"
                            onClick={() => updateReportStatus(report.id, "resolved")}
                            disabled={updating === report.id}
                            style={{ fontSize: 12, padding: "4px 8px" }}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Card>
        </div>
      )}

      {/* Soft Safeguards / Human Flags */}
      <div style={{ marginTop: 24 }}>
        <Card className="admin-section-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">🛡️</span>
          Soft Safeguards / Human Flags
        </h4>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16, lineHeight: 1.5 }}>
          Patterns detected for admin review. These are care flags, not moderation actions.
        </p>

        {loadingFlags ? (
          <p className="muted">Loading flags…</p>
        ) : humanFlags.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {humanFlags.map((flag, idx) => {
              const severityColor =
                flag.severity === "high"
                  ? "#ef4444"
                  : flag.severity === "medium"
                    ? "#f59e0b"
                    : "#6b7280";
              return (
                <div
                  key={`${flag.user_id}-${flag.flag_type}-${idx}`}
                  style={{
                    padding: 14,
                    background: "var(--white-90)",
                    borderRadius: 10,
                    border: `1px solid ${severityColor}40`,
                    borderLeft: `4px solid ${severityColor}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span
                          className="admin-badge"
                          style={{
                            background: severityColor + "15",
                            color: severityColor,
                            borderColor: severityColor + "30",
                          }}
                        >
                          {flag.severity.toUpperCase()}
                        </span>
                        <span
                          className="admin-badge"
                          style={{
                            background: "rgba(142,163,255,0.12)",
                            color: "var(--accentText)",
                          }}
                        >
                          {flag.flag_type === "frequent_destructive"
                            ? "⚠️ Frequent Destructive"
                            : flag.flag_type === "long_echo_session"
                              ? "📝 Long Sessions"
                              : "🔄 Repeated Pattern"}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                        {flag.user_email || flag.user_id.slice(0, 8) + "..."}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                        {flag.description}
                      </div>
                    </div>
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => {
                        setSelectedUserId(flag.user_id);
                        setSelectedUserEmail(flag.user_email);
                      }}
                    >
                      👤 View Journey
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">✅</div>
            <div className="admin-empty-state-title">No Flags Detected</div>
            <div className="admin-empty-state-desc">
              No concerning patterns detected. Flags will appear here if patterns are identified.
            </div>
          </div>
        )}
        </Card>
      </div>

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
