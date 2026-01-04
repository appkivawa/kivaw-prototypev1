import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { getUserId } from "../../data/savesApi";
import { logAdminAction } from "../auditLog";
import AdminNotes from "../components/AdminNotes";

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  hypothesis: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "paused" | "completed" | "archived";
  result: string | null;
  created_at: string;
  updated_at: string;
};

export default function Experiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [newExperiment, setNewExperiment] = useState({
    name: "",
    description: "",
    hypothesis: "",
    end_date: "",
  });

  async function loadExperiments() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("experiments")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) {
        if (error.code === "42P01") {
          setError("Experiments table does not exist. Run create_experiments_table.sql");
          setExperiments([]);
          return;
        }
        throw error;
      }

      setExperiments((data || []) as Experiment[]);
    } catch (e: any) {
      console.error("Error loading experiments:", e);
      setError(e?.message || "Could not load experiments.");
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  }

  async function createExperiment() {
    if (!newExperiment.name.trim()) {
      alert("Please enter an experiment name");
      return;
    }

    try {
      const userId = await getUserId();
      const { error } = await supabase.from("experiments").insert({
        name: newExperiment.name.trim(),
        description: newExperiment.description.trim() || null,
        hypothesis: newExperiment.hypothesis.trim() || null,
        end_date: newExperiment.end_date || null,
        status: "active",
        created_by: userId,
      });

      if (error) throw error;

      await logAdminAction("experiment_create", null, {
        name: newExperiment.name,
      });

      setNewExperiment({ name: "", description: "", hypothesis: "", end_date: "" });
      setShowNewForm(false);
      await loadExperiments();
    } catch (e: any) {
      console.error("Error creating experiment:", e);
      alert("Error: " + (e?.message || "Could not create experiment."));
    }
  }

  async function updateExperimentStatus(id: string, newStatus: Experiment["status"], result?: string) {
    try {
      const { error } = await supabase
        .from("experiments")
        .update({
          status: newStatus,
          result: result || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      await logAdminAction("experiment_update", id, {
        status: newStatus,
      });

      await loadExperiments();
    } catch (e: any) {
      console.error("Error updating experiment:", e);
      alert("Error: " + (e?.message || "Could not update experiment."));
    }
  }

  useEffect(() => {
    loadExperiments();
  }, []);

  return (
    <div className="admin-experiments">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Experiment Tracker</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            type="button"
            onClick={() => setShowNewForm(!showNewForm)}
          >
            {showNewForm ? "✕ Cancel" : "➕ New Experiment"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={loadExperiments}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* New Experiment Form */}
      {showNewForm && (
        <div style={{ marginBottom: 24 }}>
          <Card className="admin-section-card">
          <h4 className="admin-subsection-title">
            <span className="admin-section-icon">➕</span>
            New Experiment
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <div>
              <label className="admin-filter-label">Experiment Name *</label>
              <input
                type="text"
                className="admin-filter-input"
                placeholder="e.g., New Home Page Layout"
                value={newExperiment.name}
                onChange={(e) => setNewExperiment({ ...newExperiment, name: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-filter-label">Description</label>
              <textarea
                className="admin-filter-input"
                placeholder="What are you testing?"
                value={newExperiment.description}
                onChange={(e) => setNewExperiment({ ...newExperiment, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="admin-filter-label">Hypothesis</label>
              <textarea
                className="admin-filter-input"
                placeholder="What do you expect to happen?"
                value={newExperiment.hypothesis}
                onChange={(e) => setNewExperiment({ ...newExperiment, hypothesis: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="admin-filter-label">End Date (optional)</label>
              <input
                type="date"
                className="admin-filter-input"
                value={newExperiment.end_date}
                onChange={(e) => setNewExperiment({ ...newExperiment, end_date: e.target.value })}
              />
            </div>
            <button className="btn" type="button" onClick={createExperiment}>
              💾 Create Experiment
            </button>
          </div>
          </Card>
        </div>
      )}

      {/* Experiments List */}
      {loading ? (
        <p className="muted">Loading experiments…</p>
      ) : experiments.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {experiments.map((exp) => (
            <Card key={exp.id} className="admin-section-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <h4 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: 0 }}>
                      {exp.name}
                    </h4>
                    <span
                      className="admin-badge"
                      style={{
                        background:
                          exp.status === "active"
                            ? "rgba(16, 185, 129, 0.15)"
                            : exp.status === "completed"
                              ? "rgba(59, 130, 246, 0.15)"
                              : "rgba(107, 114, 128, 0.15)",
                        color:
                          exp.status === "active"
                            ? "#10b981"
                            : exp.status === "completed"
                              ? "#3b82f6"
                              : "#6b7280",
                      }}
                    >
                      {exp.status}
                    </span>
                  </div>
                  {exp.description && (
                    <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
                      {exp.description}
                    </div>
                  )}
                  {exp.hypothesis && (
                    <div style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic", marginBottom: 8 }}>
                      <strong>Hypothesis:</strong> {exp.hypothesis}
                    </div>
                  )}
                  {exp.result && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        padding: 10,
                        background: "var(--white-75)",
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                    >
                      <strong>Result:</strong> {exp.result}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    Started: {new Date(exp.start_date).toLocaleDateString()}
                    {exp.end_date && ` • Ended: ${new Date(exp.end_date).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {exp.status === "active" && (
                    <>
                      <button
                        className="admin-action-btn"
                        type="button"
                        onClick={() => updateExperimentStatus(exp.id, "paused")}
                      >
                        ⏸️ Pause
                      </button>
                      <button
                        className="admin-action-btn"
                        type="button"
                        onClick={() => {
                          const result = prompt("Enter result:");
                          if (result) {
                            updateExperimentStatus(exp.id, "completed", result);
                          }
                        }}
                      >
                        ✅ Complete
                      </button>
                    </>
                  )}
                  {exp.status === "paused" && (
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => updateExperimentStatus(exp.id, "active")}
                    >
                      ▶️ Resume
                    </button>
                  )}
                  <button
                    className="admin-action-btn"
                    type="button"
                    onClick={() => setSelectedExperimentId(exp.id)}
                  >
                    📝 Notes
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          <div className="admin-empty-state-icon">🧪</div>
          <div className="admin-empty-state-title">No Experiments</div>
          <div className="admin-empty-state-desc">
            Track UI experiments, copy changes, and feature flags here to prevent "we tried that once" amnesia.
          </div>
        </div>
      )}

      {selectedExperimentId && (
        <div style={{ marginTop: 24 }}>
          <AdminNotes
            noteType="experiment"
            targetId={selectedExperimentId}
            onClose={() => setSelectedExperimentId(null)}
          />
        </div>
      )}
    </div>
  );
}

