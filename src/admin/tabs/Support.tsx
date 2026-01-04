import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

type SupportTicket = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  subject: string;
  message: string;
  status: "open" | "closed";
  user_email?: string | null;
};

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  async function loadTickets() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, created_at, updated_at, user_id, subject, message, status")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // If table doesn't exist, show helpful message
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setError(
            "The support_tickets table does not exist. Please run the SQL migration: supabase/migrations/create_support_tickets.sql"
          );
          setTickets([]);
          return;
        }
        throw error;
      }

      // Fetch user emails for tickets
      const userIds = (data || [])
        .map((t) => t.user_id)
        .filter((id): id is string => id !== null && id !== undefined);

      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);

        if (profilesData) {
          userEmails = Object.fromEntries(
            profilesData.map((p) => [p.id, p.email || "N/A"])
          );
        }
      }

      const ticketsWithEmails = (data || []).map((ticket) => ({
        ...ticket,
        user_email: ticket.user_id ? userEmails[ticket.user_id] : null,
      }));

      setTickets(ticketsWithEmails as SupportTicket[]);
    } catch (e: any) {
      console.error("Error loading tickets:", e);
      setError(e?.message || "Could not load support tickets.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(ticketId: string, newStatus: "open" | "closed") {
    setUpdating(ticketId);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;

      // Update local state
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );

      // Update selected ticket if it's the one being updated
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (e: any) {
      console.error("Error updating ticket status:", e);
      alert("Error: " + (e?.message || "Could not update ticket status."));
    } finally {
      setUpdating(null);
    }
  }

  function handleViewTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
  }

  function handleClosePanel() {
    setSelectedTicket(null);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  if (loading) {
    return <p className="muted">Loading support tickets…</p>;
  }

  return (
    <div className="admin-support">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Support Tickets</h3>
        <button className="btn btn-ghost" type="button" onClick={loadTickets}>
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
                supabase/migrations/create_support_tickets.sql
              </code>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Tickets List */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card className="admin-section-card">
            <h4 className="admin-subsection-title">
              <span className="admin-section-icon">🎧</span>
              All Tickets ({tickets.length})
            </h4>

            {tickets.length > 0 ? (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>User</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <div
                            style={{
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={ticket.subject}
                          >
                            {ticket.subject}
                          </div>
                        </td>
                        <td>
                          {ticket.user_email ? (
                            <span>{ticket.user_email}</span>
                          ) : (
                            <span className="muted">N/A</span>
                          )}
                        </td>
                        <td>
                          <span className={`admin-badge admin-status-${ticket.status}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="admin-action-btn"
                              type="button"
                              onClick={() => handleViewTicket(ticket)}
                              style={{ fontSize: 12, padding: "4px 8px" }}
                            >
                              View
                            </button>
                            {ticket.status === "open" ? (
                              <button
                                className="admin-action-btn"
                                type="button"
                                onClick={() => updateTicketStatus(ticket.id, "closed")}
                                disabled={updating === ticket.id}
                                style={{ fontSize: 12, padding: "4px 8px" }}
                              >
                                {updating === ticket.id ? "..." : "Close"}
                              </button>
                            ) : (
                              <button
                                className="admin-action-btn"
                                type="button"
                                onClick={() => updateTicketStatus(ticket.id, "open")}
                                disabled={updating === ticket.id}
                                style={{ fontSize: 12, padding: "4px 8px" }}
                              >
                                {updating === ticket.id ? "..." : "Reopen"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No support tickets found.</p>
            )}
          </Card>
        </div>

        {/* View Ticket Panel */}
        {selectedTicket && (
          <div style={{ width: 400, flexShrink: 0 }}>
            <Card className="admin-section-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h4 className="admin-subsection-title" style={{ margin: 0 }}>
                  Ticket Details
                </h4>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={handleClosePanel}
                  style={{ fontSize: 20, padding: "4px 8px", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Subject</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                    {selectedTicket.subject}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Status</div>
                  <span className={`admin-badge admin-status-${selectedTicket.status}`}>
                    {selectedTicket.status}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>User</div>
                  <div style={{ fontSize: 14, color: "var(--text)" }}>
                    {selectedTicket.user_email || "N/A"}
                  </div>
                  {selectedTicket.user_id && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      ID: <code style={{ background: "var(--white-75)", padding: "2px 4px", borderRadius: 3 }}>
                        {selectedTicket.user_id.slice(0, 8)}...
                      </code>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Created</div>
                  <div style={{ fontSize: 14, color: "var(--text)" }}>
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Message</div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      padding: 12,
                      background: "var(--white-75)",
                      borderRadius: 8,
                      maxHeight: 400,
                      overflowY: "auto",
                    }}
                  >
                    {selectedTicket.message}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {selectedTicket.status === "open" ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => updateTicketStatus(selectedTicket.id, "closed")}
                      disabled={updating === selectedTicket.id}
                      style={{ flex: 1 }}
                    >
                      {updating === selectedTicket.id ? "Closing..." : "Close Ticket"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => updateTicketStatus(selectedTicket.id, "open")}
                      disabled={updating === selectedTicket.id}
                      style={{ flex: 1 }}
                    >
                      {updating === selectedTicket.id ? "Reopening..." : "Reopen Ticket"}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
