// src/pages/Saved.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Container from "../ui/Container";
import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import ErrorBoundary from "../ui/ErrorBoundary";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { supabase } from "../lib/supabaseClient";
import "../styles/studio.css";

import type { ContentItem } from "../data/contentApi";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";
import { requireAuth } from "../auth/authUtils";

import {
  getLocalSaved,
  getLocalSavedIds,
  unsaveLocal,
} from "../data/savedLocal";

type ViewMode = "grid" | "list";
type SortBy = "recent" | "category" | "title";


type SavedIdRow = { content_id: string; created_at: string };
type SaveInsert = { user_id: string; content_id: string };

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export default function Saved() {
  const navigate = useNavigate();

  const [isAuthed, setIsAuthed] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  const [localIds, setLocalIds] = useState<string[]>(getLocalSavedIds());
  const [accountIds, setAccountIds] = useState<string[]>([]);

  async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async function fetchAccountSavedIds(uid: string): Promise<string[]> {
    // Assumes table "saved_items" with columns: user_id, content_id, created_at
    // If your table name differs, change it here.
    const { data, error } = await supabase
      .from("saved_items")
      .select("content_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as SavedIdRow[];
    return rows.map((r) => r.content_id);
  }

  async function loadSaved() {
    setErr("");
    setLoading(true);

    try {
      const uid = await getUserId();
      const authed = !!uid;
      setIsAuthed(authed);

      // 1) local first
      const local = getLocalSaved();
      const localOnlyIds = local.map((x) => x.id);
      setLocalIds(localOnlyIds);

      // 2) remote (optional)
      let remoteIds: string[] = [];
      if (authed && uid) {
        remoteIds = await fetchAccountSavedIds(uid);
        setAccountIds(remoteIds);
      } else {
        setAccountIds([]);
      }

      // 3) merge: account first (newest), then local newest-first
      const merged = authed ? uniq([...remoteIds, ...localOnlyIds]) : localOnlyIds;

      if (merged.length === 0) {
        setItems([]);
        return;
      }

      // 4) fetch content items
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
        )
        .in("id", merged);

      if (error) throw error;

      // preserve merged order
      const map = new Map<string, ContentItem>();
      for (const it of (data || []) as ContentItem[]) map.set(it.id, it);

      const ordered = merged.map((id) => map.get(id)).filter(Boolean) as ContentItem[];
      setItems(ordered);
    } catch (e: any) {
      setErr(e?.message || "Couldn't load your saved items right now. Try refreshing?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeSaved(contentId: string) {
    if (busyId) return;
    setBusyId(contentId);

    // optimistic UI
    setItems((prev) => prev.filter((x) => x.id !== contentId));

    try {
      // always remove locally (Option B behavior)
      unsaveLocal(contentId);
      setLocalIds(getLocalSavedIds());

      // if authed, also remove from account
      const uid = await getUserId();
      if (uid) {
        // Assumes table "saved_items"
        await supabase.from("saved_items").delete().eq("user_id", uid).eq("content_id", contentId);
        setAccountIds((prev) => prev.filter((id) => id !== contentId));
      }
    } catch (e) {
      console.error(e);
      await loadSaved();
      alert("Couldn’t update saved right now.");
    } finally {
      setBusyId(null);
    }
  }

  async function syncLocalToAccount() {
    const uid = await requireAuth(navigate, "/saved");
    if (!uid) return;

    const local = getLocalSavedIds();
    if (!local.length) return;

    try {
      // get latest remote
      const remote = await fetchAccountSavedIds(uid);
      const missing = local.filter((id) => !remote.includes(id));
      if (!missing.length) {
        alert("Nothing to sync — your account already has these saves.");
        return;
      }

      const payload: SaveInsert[] = missing.map((id) => ({ user_id: uid, content_id: id }));

      // Assumes you have a unique constraint on (user_id, content_id) OR you want duplicates avoided.
      // If you DO have a unique constraint, use upsert.
      const { error } = await supabase.from("saved_items").upsert(payload, {
        onConflict: "user_id,content_id",
      });

      if (error) throw error;

      alert(`Synced ${missing.length} saves to your account ✅`);
      await loadSaved();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Couldn’t sync right now.");
    }
  }


  const visibleItems = useMemo(() => {
    return items.filter((it) => isPublicDiscoverableContentItem(it));
  }, [items]);

  const sortedItems = useMemo(() => {
    const sorted = [...visibleItems];
    if (sortBy === "category") sorted.sort((a, b) => (a.kind || "").localeCompare(b.kind || ""));
    else if (sortBy === "title") sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return sorted;
  }, [visibleItems, sortBy]);

  const mostCommonCategory = useMemo(() => {
    if (visibleItems.length === 0) return null;
    const counts = new Map<string, number>();
    visibleItems.forEach((item) => {
      const cat = item.kind || "Other";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    let maxCount = 0;
    let maxCat = "";
    counts.forEach((count, cat) => {
      if (count > maxCount) {
        maxCount = count;
        maxCat = cat;
      }
    });
    return maxCat;
  }, [visibleItems]);

  const canSync = isAuthed && localIds.some((id) => !accountIds.includes(id));

  return (
    <ErrorBoundary>
      <div className="studio-page" data-theme="light">
        <Container maxWidth="xl" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
          {/* Header */}
          <div style={{ marginBottom: "32px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", margin: "0 0 8px 0" }}>
              Saved
            </h1>
            <p style={{ fontSize: "15px", color: "var(--studio-text-secondary)", margin: 0 }}>
              Your stash of content that matters
            </p>
          </div>

          {/* Error State */}
          {err && (
            <Card style={{
              padding: "24px",
              marginBottom: "24px",
              background: "#FEE2E2",
              border: "1px solid #DC2626",
              borderRadius: "8px",
            }}>
              <div style={{ color: "#DC2626", fontWeight: 500, marginBottom: "8px" }}>Error</div>
              <div style={{ color: "#991B1B", fontSize: "14px" }}>{err}</div>
            </Card>
          )}

          {/* Loading State */}
          {loading && <LoadingSkeleton count={6} type="grid" />}

          {/* Content */}
          {!loading && !err && (
            <>
              {/* Consolidated Header Bar with Stats and Controls */}
              {visibleItems.length > 0 && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "24px",
                  flexWrap: "wrap",
                  gap: "16px",
                  padding: "16px 20px",
                  background: "var(--studio-white)",
                  border: "1px solid var(--studio-border)",
                  borderRadius: "12px",
                }}>
                  {/* Stats */}
                  <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "14px", color: "var(--studio-text-secondary)" }}>
                      <strong style={{ color: "var(--studio-text)", display: "block", fontSize: "20px", marginBottom: "2px" }}>
                        {visibleItems.length}
                      </strong>
                      Saved items
                    </div>
                    {mostCommonCategory && (
                      <div style={{ fontSize: "14px", color: "var(--studio-text-secondary)" }}>
                        <strong style={{ color: "var(--studio-text)", display: "block", fontSize: "20px", marginBottom: "2px" }}>
                          {mostCommonCategory}
                        </strong>
                        Top category
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    {/* View Toggle */}
                    <div style={{
                      display: "flex",
                      gap: "4px",
                      padding: "4px",
                      borderRadius: "8px",
                      background: "var(--studio-gray-100)",
                    }}>
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: viewMode === "grid" ? "var(--studio-white)" : "transparent",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: viewMode === "grid" ? 600 : 400,
                          color: viewMode === "grid" ? "var(--studio-text)" : "var(--studio-text-secondary)",
                          fontFamily: "inherit",
                          boxShadow: viewMode === "grid" ? "var(--studio-shadow-sm)" : "none",
                        }}
                        aria-label="Grid view"
                      >
                        ⬜
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: viewMode === "list" ? "var(--studio-white)" : "transparent",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: viewMode === "list" ? 600 : 400,
                          color: viewMode === "list" ? "var(--studio-text)" : "var(--studio-text-secondary)",
                          fontFamily: "inherit",
                          boxShadow: viewMode === "list" ? "var(--studio-shadow-sm)" : "none",
                        }}
                        aria-label="List view"
                      >
                        ☰
                      </button>
                    </div>

                    {/* Sort */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--studio-border)",
                        background: "var(--studio-white)",
                        color: "var(--studio-text)",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      <option value="recent">Recently saved</option>
                      <option value="category">Category</option>
                      <option value="title">Title</option>
                    </select>

                    {/* Sync Action (if needed) */}
                    {!isAuthed && (
                      <Button
                        type="button"
                        onClick={() => navigate("/login", { state: { from: "/saved" } })}
                        variant="primary"
                        size="sm"
                        style={{
                          backgroundColor: "var(--studio-coral)",
                          color: "white",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Sign in to sync
                      </Button>
                    )}
                    {isAuthed && canSync && (
                      <Button
                        type="button"
                        onClick={syncLocalToAccount}
                        variant="secondary"
                        size="sm"
                        style={{
                          backgroundColor: "var(--studio-white)",
                          color: "var(--studio-text)",
                          border: "1px solid var(--studio-border)",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Sync
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {visibleItems.length === 0 && !loading && (
                <EmptyState
                  title="Nothing saved yet"
                  message="Save anything you like — it'll live here (even if you're not signed in)."
                  action={{
                    label: "Explore →",
                    onClick: () => navigate("/studio/explore"),
                  }}
                />
              )}

              {/* Items Grid/List */}
              {visibleItems.length > 0 && (
                <div style={{
                  display: viewMode === "grid" ? "grid" : "flex",
                  gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr",
                  flexDirection: viewMode === "list" ? "column" : "row",
                  gap: "20px",
                }}>
                  {sortedItems.map((it) => {
                    const isBusy = busyId === it.id;

                    return (
                      <Card
                        key={it.id}
                        style={{
                          padding: 0,
                          borderRadius: "12px",
                          border: "1px solid var(--studio-border)",
                          backgroundColor: "var(--studio-white)",
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "transform 0.2s ease, box-shadow 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        onClick={() => navigate(`/item/${it.id}`)}
                      >
                        {it.image_url && (
                          <div style={{
                            width: "100%",
                            height: viewMode === "grid" ? "200px" : "120px",
                            backgroundImage: `url(${it.image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundColor: "var(--studio-gray-100)",
                          }} />
                        )}
                        <div style={{ padding: "16px" }}>
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--studio-coral)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginBottom: "4px",
                              }}>
                                {it.kind || "Item"}
                              </div>
                              <h3 style={{
                                fontSize: "16px",
                                fontWeight: 600,
                                color: "var(--studio-text)",
                                margin: "0 0 4px 0",
                                lineHeight: 1.4,
                              }}>
                                {it.title}
                              </h3>
                              {it.byline && (
                                <div style={{
                                  fontSize: "13px",
                                  color: "var(--studio-text-secondary)",
                                  marginBottom: "8px",
                                }}>
                                  {it.byline}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label="Remove"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeSaved(it.id);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: isBusy ? "not-allowed" : "pointer",
                                fontSize: "18px",
                                padding: "4px",
                                color: "var(--studio-coral)",
                                opacity: isBusy ? 0.5 : 1,
                                flexShrink: 0,
                                marginLeft: "8px",
                              }}
                            >
                              {isBusy ? "…" : "♥"}
                            </button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Container>
      </div>
    </ErrorBoundary>
  );
}

