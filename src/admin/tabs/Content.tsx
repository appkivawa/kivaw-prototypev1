import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminNotes from "../components/AdminNotes";

type ContentItem = {
  id: string;
  title: string;
  kind: string;
  created_at: string;
  effectiveness_score?: number;
  saves_count?: number;
  echoes_count?: number;
  waves_count?: number;
};

export default function Content() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [err, setErr] = useState("");
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [selectedContentTitle, setSelectedContentTitle] = useState<string | null>(null);

  function calculateEffectivenessScore(
    saves: number,
    echoes: number,
    waves: number,
    createdAt: string
  ): number {
    // Base score from engagement
    const engagementScore = saves * 2 + echoes * 3 + waves * 1.5;

    // Time decay: newer items get a boost (items older than 30 days decay)
    const daysSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = daysSinceCreation > 30 ? Math.max(0.5, 1 - (daysSinceCreation - 30) / 100) : 1.2;

    // Final score
    return Math.round(engagementScore * timeDecay * 10) / 10;
  }

  async function loadContent() {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, kind, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Calculate effectiveness scores for each item
      const itemsWithScores = await Promise.all(
        (data || []).map(async (item) => {
          // Get saves count
          const { count: savesCount } = await supabase
            .from("saves_v2")
            .select("*", { count: "exact", head: true })
            .eq("content_id", item.id);

          // Get echoes count
          const { count: echoesCount } = await supabase
            .from("echoes")
            .select("*", { count: "exact", head: true })
            .eq("content_id", item.id);

          // Get waves count (from waves_events or waves_summary)
          const { count: wavesCount } = await supabase
            .from("waves_events")
            .select("*", { count: "exact", head: true })
            .eq("content_id", item.id);

          const saves = savesCount || 0;
          const echoes = echoesCount || 0;
          const waves = wavesCount || 0;

          const effectivenessScore = calculateEffectivenessScore(
            saves,
            echoes,
            waves,
            item.created_at
          );

          return {
            ...item,
            effectiveness_score: effectivenessScore,
            saves_count: saves,
            echoes_count: echoes,
            waves_count: waves,
          };
        })
      );

      // Sort by effectiveness score
      itemsWithScores.sort((a, b) => (b.effectiveness_score || 0) - (a.effectiveness_score || 0));

      setContentItems(itemsWithScores as ContentItem[]);
    } catch (error: any) {
      console.error("Error loading content:", error);
      setErr("Could not load content items.");
    } finally {
      setLoadingContent(false);
    }
  }

  useEffect(() => {
    loadContent();
  }, []);

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Content Management</h3>
        <button className="btn btn-ghost" type="button" onClick={loadContent}>
          {loadingContent ? "Loading…" : "🔄 Refresh"}
        </button>
      </div>
      {loadingContent ? (
        <p className="muted">Loading content…</p>
      ) : err ? (
        <div className="echo-alert">{err}</div>
      ) : contentItems.length > 0 ? (
        <div className="admin-table-wrapper">
          <table className="admin-content-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Kind</th>
                <th>Effectiveness Score</th>
                <th>Engagement</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contentItems.map((item) => {
                const score = item.effectiveness_score || 0;
                const scoreColor =
                  score > 50 ? "#10b981" : score > 20 ? "#f59e0b" : "#6b7280";
                return (
                  <tr key={item.id}>
                    <td>{item.title || "Untitled"}</td>
                    <td>
                      <span className="admin-badge">{item.kind}</span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: scoreColor + "15",
                          color: scoreColor,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        <span>⭐</span>
                        <span>{score.toFixed(1)}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        <span>🔖 {item.saves_count || 0}</span>
                        {" • "}
                        <span>📖 {item.echoes_count || 0}</span>
                        {" • "}
                        <span>🌊 {item.waves_count || 0}</span>
                      </div>
                    </td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => {
                            window.open(`/item/${item.id}`, "_blank");
                          }}
                        >
                          View
                        </button>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => {
                            setSelectedContentId(item.id);
                            setSelectedContentTitle(item.title || "Untitled");
                          }}
                        >
                          📝 Notes
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No content items found.</p>
      )}

      {selectedContentId && (
        <div style={{ marginTop: 24 }}>
          <AdminNotes
            noteType="content_item"
            targetId={selectedContentId}
            targetName={selectedContentTitle || undefined}
            onClose={() => {
              setSelectedContentId(null);
              setSelectedContentTitle(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

