import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ContentItem = {
  id: string;
  title: string;
  kind: string;
  created_at: string;
};

export default function Content() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [err, setErr] = useState("");

  async function loadContent() {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, kind, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setContentItems((data || []) as ContentItem[]);
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
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contentItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.title || "Untitled"}</td>
                  <td>
                    <span className="admin-badge">{item.kind}</span>
                  </td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => {
                        alert(`Content actions for ${item.id}`);
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
      ) : (
        <p className="muted">No content items found.</p>
      )}
    </div>
  );
}

