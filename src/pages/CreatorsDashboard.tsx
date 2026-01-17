import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";
import { supabase } from "../lib/supabaseClient";
import { getUserId } from "../data/savesApi";

interface CreatorPost {
  id: string;
  creator_user_id: string;
  title: string;
  body: string;
  media_url: string | null;
  tags: string[];
  status: "draft" | "pending" | "published" | "rejected";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

type PostStatus = "draft" | "pending" | "published" | "rejected";

export default function CreatorsDashboard() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    media_url: "",
    tags: "",
    status: "draft" as PostStatus,
  });

  // Load posts on mount
  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    setError(null);

    try {
      const userId = await getUserId();
      if (!userId) {
        setError("Not authenticated");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("creator_posts")
        .select("*")
        .eq("creator_user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        if (fetchError.code === "42P01") {
          setError("Creator posts table does not exist. Run migration 20250122000002_create_creator_posts.sql");
          setPosts([]);
          return;
        }
        throw fetchError;
      }

      setPosts((data || []) as CreatorPost[]);
    } catch (e: any) {
      console.error("Error loading posts:", e);
      setError(e?.message || "Failed to load posts");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      body: "",
      media_url: "",
      tags: "",
      status: "draft",
    });
    setEditingPostId(null);
    setShowCreateForm(false);
  }

  function startEdit(post: CreatorPost) {
    setFormData({
      title: post.title,
      body: post.body,
      media_url: post.media_url || "",
      tags: post.tags.join(", "),
      status: post.status,
    });
    setEditingPostId(post.id);
    setShowCreateForm(true);
  }

  async function handleSave() {
    if (!formData.title.trim() || !formData.body.trim()) {
      alert("Title and body are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const userId = await getUserId();
      if (!userId) {
        setError("Not authenticated");
        return;
      }

      // Parse tags (comma-separated)
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      if (editingPostId) {
        // Update existing post
        const { error: updateError } = await supabase
          .from("creator_posts")
          .update({
            title: formData.title.trim(),
            body: formData.body.trim(),
            media_url: formData.media_url.trim() || null,
            tags,
            status: formData.status,
          })
          .eq("id", editingPostId)
          .eq("creator_user_id", userId);

        if (updateError) throw updateError;
      } else {
        // Create new post
        const { error: insertError } = await supabase
          .from("creator_posts")
          .insert({
            creator_user_id: userId,
            title: formData.title.trim(),
            body: formData.body.trim(),
            media_url: formData.media_url.trim() || null,
            tags,
            status: formData.status,
          });

        if (insertError) throw insertError;
      }

      resetForm();
      await loadPosts();
    } catch (e: any) {
      console.error("Error saving post:", e);
      setError(e?.message || "Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from("creator_posts")
        .delete()
        .eq("id", postId)
        .eq("creator_user_id", userId);

      if (error) throw error;

      await loadPosts();
    } catch (e: any) {
      console.error("Error deleting post:", e);
      alert(e?.message || "Failed to delete post");
    }
  }

  function getStatusColor(status: PostStatus): string {
    switch (status) {
      case "published":
        return "#10B981"; // green
      case "pending":
        return "#F59E0B"; // yellow
      case "rejected":
        return "#EF4444"; // red
      case "draft":
      default:
        return "#6B7280"; // gray
    }
  }

  function getStatusLabel(status: PostStatus): string {
    switch (status) {
      case "published":
        return "Published";
      case "pending":
        return "Pending Review";
      case "rejected":
        return "Rejected";
      case "draft":
      default:
        return "Draft";
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad" style={{ maxWidth: "1000px", marginTop: "40px" }}>
          <PageHeader
            title="Creator Dashboard"
            subtitle="Manage your content and track your impact"
            align="left"
          />

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "#FEE2E2",
                color: "#DC2626",
                borderRadius: "8px",
                marginBottom: "24px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card
              style={{
                padding: "24px",
                marginBottom: "24px",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>
                {editingPostId ? "Edit Post" : "Create Post"}
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Post title"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                    Body *
                  </label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Post content..."
                    rows={6}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                    Media URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.media_url}
                    onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="tech, design, ai"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PostStatus })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Submit for Review</option>
                    <option value="published">Publish Directly</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    style={{
                      padding: "8px 16px",
                      background: "white",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "8px 16px",
                      background: saving ? "#9CA3AF" : "#10B981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Saving..." : editingPostId ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Create Post Button */}
          {!showCreateForm && (
            <div style={{ marginBottom: "24px" }}>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(true);
                }}
                style={{
                  padding: "10px 20px",
                  background: "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                ➕ Create Post
              </button>
            </div>
          )}

          {/* Posts List */}
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
              Loading posts...
            </div>
          ) : posts.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
              No posts yet. Create your first post to get started!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {posts.map((post) => (
                <Card
                  key={post.id}
                  style={{
                    padding: "20px",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                        {post.title}
                      </h3>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            background: getStatusColor(post.status),
                            color: "white",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          {getStatusLabel(post.status)}
                        </span>
                        {post.published_at && (
                          <span style={{ fontSize: "12px", color: "#6B7280" }}>
                            Published {new Date(post.published_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => startEdit(post)}
                        style={{
                          padding: "6px 12px",
                          background: "white",
                          border: "1px solid #D1D5DB",
                          borderRadius: "4px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#EF4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {post.media_url && (
                    <div style={{ marginBottom: "12px" }}>
                      <img
                        src={post.media_url}
                        alt={post.title}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "200px",
                          borderRadius: "6px",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  <p
                    style={{
                      fontSize: "14px",
                      color: "#374151",
                      lineHeight: 1.6,
                      marginBottom: "12px",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {post.body}
                  </p>

                  {post.tags && post.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: "4px 8px",
                            background: "#E5E7EB",
                            color: "#374151",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
