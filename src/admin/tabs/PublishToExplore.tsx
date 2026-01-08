import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import RequireRole from "../../auth/RequireRole";

type CachedItem = {
  id: string;
  provider: string;
  provider_id: string;
  type: "watch" | "read";
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  fetched_at: string;
};

type PublishedItem = {
  id: string;
  title: string;
  type: "watch" | "read";
  source: string;
  url: string | null;
  image_url: string | null;
  description: string | null;
  mood_tags: string[] | null;
  focus_tags: string[] | null;
  rank: number;
  published_at: string;
};


function PublishToExploreContent() {
  const [cachedItems, setCachedItems] = useState<CachedItem[]>([]);
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedType, setSelectedType] = useState<"watch" | "read" | "all">("all");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  // Load cached items from external_content_cache
  async function loadCachedItems() {
    setLoading(true);
    setErr("");
    try {
      let query = supabase
        .from("external_content_cache")
        .select("id, provider, provider_id, type, title, description, image_url, url, fetched_at")
        .neq("provider", "google_books")
        .order("fetched_at", { ascending: false })
        .limit(100);

      if (selectedType !== "all") {
        query = query.eq("type", selectedType);
      }
      if (selectedProvider !== "all") {
        query = query.eq("provider", selectedProvider);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCachedItems((data || []) as CachedItem[]);
    } catch (error: any) {
      console.error("Error loading cached items:", error);
      setErr(error?.message || "Failed to load cached items");
    } finally {
      setLoading(false);
    }
  }

  // Load published items from public_recommendations
  async function loadPublishedItems() {
    try {
      const { data, error } = await supabase
        .from("public_recommendations")
        .select("id, title, type, source, url, image_url, description, mood_tags, focus_tags, rank, published_at")
        .order("rank", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setPublishedItems((data || []) as PublishedItem[]);
    } catch (error: any) {
      console.error("Error loading published items:", error);
    }
  }

  useEffect(() => {
    loadCachedItems();
    loadPublishedItems();
  }, [selectedType, selectedProvider]);

  async function publishItem(item: CachedItem) {
    setPublishing(item.id);
    setErr("");
    setSuccess("");

    try {
      // Get tags from content_tags if available
      const { data: tagData } = await supabase
        .from("content_tags")
        .select("mode, focus")
        .eq("cache_id", item.id);

      const moodTags: string[] = [];
      const focusTags: string[] = [];

      if (tagData) {
        tagData.forEach((tag) => {
          if (tag.mode && !moodTags.includes(tag.mode)) {
            moodTags.push(tag.mode);
          }
          if (tag.focus && !focusTags.includes(tag.focus)) {
            focusTags.push(tag.focus);
          }
        });
      }

      // Default focus tag based on type
      if (focusTags.length === 0) {
        focusTags.push(item.type);
      }

      const { error: insertError } = await supabase
        .from("public_recommendations")
        .insert({
          title: item.title,
          type: item.type,
          source: item.provider,
          url: item.url,
          image_url: item.image_url,
          description: item.description,
          mood_tags: moodTags.length > 0 ? moodTags : null,
          focus_tags: focusTags,
          rank: 0,
        });

      if (insertError) throw insertError;

      setSuccess(`Published "${item.title}" to Explore`);
      await loadPublishedItems();
    } catch (error: any) {
      console.error("Error publishing item:", error);
      setErr(error?.message || "Failed to publish item");
    } finally {
      setPublishing(null);
    }
  }

  async function updateRank(itemId: string, newRank: number) {
    try {
      const { error } = await supabase
        .from("public_recommendations")
        .update({ rank: newRank })
        .eq("id", itemId);

      if (error) throw error;
      await loadPublishedItems();
    } catch (error: any) {
      console.error("Error updating rank:", error);
      setErr(error?.message || "Failed to update rank");
    }
  }


  async function unpublishItem(itemId: string) {
    try {
      const { error } = await supabase
        .from("public_recommendations")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      await loadPublishedItems();
    } catch (error: any) {
      console.error("Error unpublishing item:", error);
      setErr(error?.message || "Failed to unpublish item");
    }
  }

  const uniqueProviders = Array.from(new Set(cachedItems.map((i) => i.provider)));

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Publish to Explore</h3>
        <button className="btn btn-ghost" type="button" onClick={() => { loadCachedItems(); loadPublishedItems(); }}>
          🔄 Refresh
        </button>
      </div>

      {err && <div className="echo-alert" style={{ marginBottom: 16 }}>{err}</div>}
      {success && (
        <div style={{ marginBottom: 16, padding: 12, background: "var(--success-bg)", color: "var(--success)", borderRadius: 8 }}>
          {success}
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as "watch" | "read" | "all")}
          style={{ padding: "6px 12px", borderRadius: 6 }}
        >
          <option value="all">All Types</option>
          <option value="watch">Watch</option>
          <option value="read">Read</option>
        </select>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 6 }}
        >
          <option value="all">All Providers</option>
          {uniqueProviders.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Published Items */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ marginBottom: 12 }}>Published to Explore ({publishedItems.length})</h4>
        {publishedItems.length > 0 ? (
          <div className="admin-table-wrapper">
            <table className="admin-content-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Mood Tags</th>
                  <th>Focus Tags</th>
                  <th>Rank</th>
                  <th>Published</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {publishedItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td><span className="admin-badge">{item.type}</span></td>
                    <td>{item.source}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(item.mood_tags || []).map((tag) => (
                          <span key={tag} className="admin-badge" style={{ fontSize: 11 }}>{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(item.focus_tags || []).map((tag) => (
                          <span key={tag} className="admin-badge" style={{ fontSize: 11 }}>{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.rank}
                        onChange={(e) => updateRank(item.id, parseInt(e.target.value) || 0)}
                        style={{ width: 60, padding: "4px 8px", borderRadius: 4 }}
                      />
                    </td>
                    <td>{new Date(item.published_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="admin-action-btn"
                        type="button"
                        onClick={() => unpublishItem(item.id)}
                        style={{ fontSize: 12 }}
                      >
                        Unpublish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No items published yet.</p>
        )}
      </div>

      {/* Available Items from Cache */}
      <div>
        <h4 style={{ marginBottom: 12 }}>Available from Cache ({cachedItems.length})</h4>
        {loading ? (
          <p className="muted">Loading cached items…</p>
        ) : cachedItems.length > 0 ? (
          <div className="admin-table-wrapper">
            <table className="admin-content-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Provider</th>
                  <th>Description</th>
                  <th>Fetched</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cachedItems.map((item) => {
                  const isPublished = publishedItems.some((p) => p.source === item.provider && p.title === item.title && p.type === item.type);
                  return (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td><span className="admin-badge">{item.type}</span></td>
                      <td>{item.provider}</td>
                      <td style={{ maxWidth: 300, fontSize: 12, color: "var(--text2)" }}>
                        {item.description ? (item.description.length > 100 ? `${item.description.substring(0, 100)}...` : item.description) : "—"}
                      </td>
                      <td>{new Date(item.fetched_at).toLocaleDateString()}</td>
                      <td>
                        {isPublished ? (
                          <span style={{ fontSize: 12, color: "var(--text2)" }}>✓ Published</span>
                        ) : (
                          <button
                            className="admin-action-btn"
                            type="button"
                            onClick={() => publishItem(item)}
                            disabled={publishing === item.id}
                            style={{ fontSize: 12 }}
                          >
                            {publishing === item.id ? "Publishing…" : "Publish"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No cached items found.</p>
        )}
      </div>
    </div>
  );
}

export default function PublishToExplore() {
  return (
    <RequireRole allow={["admin", "super_admin"]}>
      <PublishToExploreContent />
    </RequireRole>
  );
}

