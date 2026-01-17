// src/pages/Saved.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import ItemCard from "../ui/ItemCard";
import SectionHeader from "../ui/SectionHeader";
import Container from "../ui/Container";
import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import { supabase } from "../lib/supabaseClient";
import "../styles/saved.css";

import type { ContentItem } from "../data/contentApi";
import { isPublicDiscoverableContentItem } from "../utils/contentFilters";
import { requireAuth } from "../auth/authUtils";

import {
  clearLocalSaved,
  getLocalSaved,
  getLocalSavedIds,
  saveLocal,
  unsaveLocal,
} from "../data/savedLocal";

type ViewMode = "grid" | "list";
type SortBy = "recent" | "category" | "title";

type SavedSource = "local" | "account";

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
  const [lastLoadedSource, setLastLoadedSource] = useState<SavedSource>("local");

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
      setLastLoadedSource(authed ? "account" : "local");

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

  function resetLocal() {
    if (!confirm("Reset local saved items? This only affects this browser.")) return;
    clearLocalSaved();
    setLocalIds([]);
    // keep account items intact
    loadSaved();
  }

  async function clearAccount() {
    const uid = await requireAuth(navigate, "/saved");
    if (!uid) return;

    if (!confirm("Clear ALL account saves? This is permanent (for your account).")) return;

    try {
      const { error } = await supabase.from("saved_items").delete().eq("user_id", uid);
      if (error) throw error;
      setAccountIds([]);
      alert("Cleared account saves.");
      await loadSaved();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Couldn’t clear account saves.");
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((it) => isPublicDiscoverableContentItem(it));
  }, [items]);

  const internalCount = useMemo(() => items.length - visibleItems.length, [items.length, visibleItems.length]);

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

  const localCount = localIds.length;
  const accountCount = accountIds.length;

  const canSync = isAuthed && localIds.some((id) => !accountIds.includes(id));

  return (
    <div className="saved-page">
      <Container maxWidth="xl" className="saved-container">
        <SectionHeader
          title="Saved"
          subtitle='Your stash of "this matters".'
          level={1}
        />

        {/* Top actions */}
        <Card className="saved-actions">
          <div className="saved-actions-content">
            <div className="saved-stats-info">
              <span className="saved-stat-label">
                Local: <strong>{localCount}</strong>
              </span>
              <span className="saved-stat-label">
                Account: <strong>{isAuthed ? accountCount : "—"}</strong>
              </span>
              <span className="saved-stat-label saved-stat-muted">
                Source: {lastLoadedSource}
              </span>
            </div>

            <div className="saved-actions-buttons">
              {!isAuthed ? (
                <Button
                  type="button"
                  onClick={() => navigate("/login", { state: { from: "/saved" } })}
                  variant="primary"
                  size="sm"
                >
                  Sign in to sync →
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={syncLocalToAccount}
                    disabled={!canSync}
                    variant="secondary"
                    size="sm"
                  >
                    {canSync ? "Sync local → account" : "Synced"}
                  </Button>
                  <Button
                    type="button"
                    onClick={clearAccount}
                    variant="secondary"
                    size="sm"
                  >
                    Clear account
                  </Button>
                </>
              )}

              <Button
                type="button"
                onClick={resetLocal}
                variant="secondary"
                size="sm"
              >
                Reset local
              </Button>

              <Button
                type="button"
                onClick={loadSaved}
                variant="secondary"
                size="sm"
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="saved-loading">Loading…</div>
        ) : err ? (
          <Card variant="danger" className="saved-error">
            {err}
          </Card>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            message="Save anything you like — it'll live here (even if you're not signed in)."
            action={{
              label: "Explore →",
              onClick: () => navigate("/explore"),
            }}
          />
        ) : (
          <>
            {/* Stats */}
            <div className="saved-stats">
              <Card className="saved-stat-card saved-stat-red">
                <div className="saved-stat-icon">♥</div>
                <div className="saved-stat-content">
                  <div className="saved-stat-value">{visibleItems.length}</div>
                  <div className="saved-stat-label">Saved items</div>
                </div>
              </Card>

              <Card className="saved-stat-card saved-stat-blue">
                <div className="saved-stat-icon">🏷️</div>
                <div className="saved-stat-content">
                  <div className="saved-stat-value">{mostCommonCategory || "—"}</div>
                  <div className="saved-stat-label">Top category</div>
                </div>
              </Card>

              <Card className="saved-stat-card saved-stat-green">
                <div className="saved-stat-icon">🧠</div>
                <div className="saved-stat-content">
                  <div className="saved-stat-value">{isAuthed ? "Syncable" : "Local-first"}</div>
                  <div className="saved-stat-label">{isAuthed ? "Account connected" : "Sign in to sync"}</div>
                </div>
              </Card>
            </div>

            {/* Toolbar */}
            <Card className="saved-toolbar">
              <div className="saved-toolbar-left">
                <Button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  variant={viewMode === "grid" ? "primary" : "secondary"}
                  size="sm"
                  aria-label="Grid view"
                >
                  ⬜
                </Button>
                <Button
                  type="button"
                  onClick={() => setViewMode("list")}
                  variant={viewMode === "list" ? "primary" : "secondary"}
                  size="sm"
                  aria-label="List view"
                >
                  ☰
                </Button>
              </div>

              <div className="saved-toolbar-right">
                <span className="saved-sort-label">Sort by:</span>
                <select
                  className="saved-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                >
                  <option value="recent">Recently saved</option>
                  <option value="category">Category</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </Card>

            {/* Items */}
            <Card>
              {internalCount > 0 ? (
                <div className="saved-internal-notice">
                  Hidden internal items: {internalCount}
                </div>
              ) : null}

              <div className={viewMode === "grid" ? "saved-grid" : "saved-list-view"}>
                {sortedItems.map((it) => {
                  const isBusy = busyId === it.id;

                  return (
                    <div key={it.id} className="saved-item-wrapper">
                      <ItemCard
                        item={it}
                        onOpen={() => navigate(`/item/${it.id}`)}
                        topMeta={
                          <>
                            <span className="kivaw-meta-pill">{it.kind || "Item"}</span>
                            {it.byline ? (
                              <>
                                <span className="kivaw-meta-dot">•</span>
                                <span className="kivaw-meta-soft">{it.byline}</span>
                              </>
                            ) : null}
                          </>
                        }
                        action={
                          <button
                            className="kivaw-heart"
                            type="button"
                            aria-label="Remove"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeSaved(it.id);
                            }}
                          >
                            {isBusy ? "…" : "♥"}
                          </button>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </Container>
    </div>
  );
}

