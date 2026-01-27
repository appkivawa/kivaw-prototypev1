import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listMyEchoes, deleteEcho, type EchoWithContent } from "../data/echoApi";
import { supabase } from "../lib/supabaseClient";
import { getLocalSaved, getLocalSavedIds, unsaveLocal } from "../data/savedLocal";
import { useSession } from "../auth/useSession";
import { ToastContainer } from "../components/ui/Toast";
import LoginModal from "../components/auth/LoginModal";
import Container from "../ui/Container";
import Card from "../ui/Card";
import CollectionSidebar from "../components/collection/CollectionSidebar";
import SavedItemCard from "../components/collection/SavedItemCard";
import EchoCard from "../components/collection/EchoCard";
import TimelineEchoPost from "../components/timeline/TimelineEchoPost";
import AddItemModal from "../components/collection/AddItemModal";
import ViewOptionsModal, { type ViewDensity, type ViewMode } from "../components/collection/ViewOptionsModal";
import {
  computeLibraryCounts,
  computeEchoCounts,
  filterSavedItems,
  type LibraryFilter,
  type SavedFilter,
} from "../utils/collectionHelpers";
import "../styles/studio.css";

// Unified saved item type that can be either content_item or feed_item
export type SavedItem = {
  id: string;
  kind?: string | null;
  title: string;
  byline?: string | null;
  meta?: string | null;
  image_url?: string | null;
  url?: string | null;
  source?: string | null;
  created_at?: string | null;
  // Feed item specific
  summary?: string | null;
  author?: string | null;
  published_at?: string | null;
  // Status fields for filtering
  status?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  board?: string;
};

// Removed old ViewMode - now using sidebar filters instead

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) {
    return "Today";
  }
  if (itemDate.getTime() === today.getTime() - 86400000) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getDateKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Start from the first day of the week that contains the first day of the month
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // End on the last day of the week that contains the last day of the month
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}


function CollectionContent() {
  const navigate = useNavigate();
  
  // Filter states
  const [activeLibraryFilter, setActiveLibraryFilter] = useState<LibraryFilter | null>(null);
  const [activeJournalFilter, setActiveJournalFilter] = useState<"echoes" | "history" | null>(null);
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [activeSavedFilter, setActiveSavedFilter] = useState<SavedFilter>("all");
  
  // View options
  const [viewDensity, setViewDensity] = useState<ViewDensity>("comfortable");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  // Echo state
  const [echoes, setEchoes] = useState<EchoWithContent[]>([]);
  const [echoLoading, setEchoLoading] = useState(true);
  const [echoError, setEchoError] = useState<string | null>(null);

  // Saved state
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  
  // Boards state (in-memory for now)
  const [boards, setBoards] = useState<Array<{ key: string; label: string; count?: number }>>([
    { key: "favorites", label: "Favorites" },
    { key: "travel-inspiration", label: "Travel Inspiration" },
  ]);

  // Calculate board counts
  const boardsWithCounts = useMemo(() => {
    return boards.map((board) => {
      if (board.key === "favorites") {
        const count = savedItems.filter((item) => (item as any).isFavorite === true || (item as any).board === "favorites").length;
        return { ...board, count: count > 0 ? count : undefined };
      }
      // For other boards, count items with matching board key
      const count = savedItems.filter((item) => (item as any).board === board.key).length;
      return { ...board, count: count > 0 ? count : undefined };
    });
  }, [boards, savedItems]);


  async function loadEchoes() {
    setEchoLoading(true);
    setEchoError(null);
    try {
      const data = await listMyEchoes(500);
      setEchoes(data || []);
    } catch (e: any) {
      setEchoError(e?.message || "Failed to load Echoes");
    } finally {
      setEchoLoading(false);
    }
  }

  async function loadSaved() {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const local = getLocalSaved();
      const localIds = getLocalSavedIds();

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;

      let allIds = localIds;
      if (uid) {
        const { data: accountData } = await supabase
          .from("saved_items")
          .select("content_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        const accountIds = (accountData || []).map((r: any) => r.content_id);
        allIds = Array.from(new Set([...accountIds, ...localIds]));
      }

      if (allIds.length === 0) {
        setSavedItems([]);
        return;
      }

      // Try to load from content_items first
      const { data: contentData, error: contentError } = await supabase
        .from("content_items")
        .select("id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at")
        .in("id", allIds);

      const foundContentIds = new Set((contentData || []).map((item: any) => item.id));
      const missingIds = allIds.filter((id) => !foundContentIds.has(id));

      // Try to load missing IDs from feed_items
      let feedData: any[] = [];
      if (missingIds.length > 0) {
        const { data: feedItemsData, error: feedError } = await supabase
          .from("feed_items")
          .select("id,title,summary,author,image_url,url,source,published_at,created_at")
          .in("id", missingIds);

        if (!feedError && feedItemsData) {
          // Transform feed_items to match SavedItem format
          feedData = feedItemsData.map((item: any) => ({
            id: item.id,
            kind: item.source || null,
            title: item.title,
            byline: item.author || null,
            meta: null,
            image_url: item.image_url || null,
            url: item.url || null,
            source: item.source || null,
            created_at: item.published_at || item.created_at || null,
            summary: item.summary || null,
            author: item.author || null,
            published_at: item.published_at || null,
          }));
        }
      }

      // Also check saved_items for manual items (items with metadata)
      let manualData: any[] = [];
      if (uid && missingIds.length > 0) {
        const { data: savedItemsData } = await supabase
          .from("saved_items")
          .select("content_id, metadata, created_at")
          .eq("user_id", uid)
          .in("content_id", missingIds);

        if (savedItemsData) {
          manualData = savedItemsData
            .filter((item: any) => item.metadata && typeof item.metadata === "object" && item.metadata.title)
            .map((item: any) => ({
              id: item.content_id,
              kind: item.metadata.kind || "manual",
              title: item.metadata.title,
              byline: null,
              meta: item.metadata.url ? { url: item.metadata.url } : null,
              image_url: null,
              url: item.metadata.url || null,
              source: item.metadata.source || "manual",
              created_at: item.metadata.created_at || item.created_at || null,
              status: "unfinished",
              isFavorite: false,
              isArchived: false,
            }));
        }
      }

      // Also check local storage for manual items
      try {
        const manualItemsKey = "kivaw_manual_items_v1";
        const localManual = JSON.parse(localStorage.getItem(manualItemsKey) || "[]");
        const localManualIds = localManual.map((item: any) => item.id);
        const localManualInMissing = localManual.filter((item: any) => missingIds.includes(item.id));
        
        localManualInMissing.forEach((item: any) => {
          manualData.push({
            id: item.id,
            kind: item.kind || "manual",
            title: item.title,
            byline: null,
            meta: item.url ? { url: item.url } : null,
            image_url: null,
            url: item.url || null,
            source: item.source || "manual",
            created_at: item.created_at || null,
            status: "unfinished",
            isFavorite: false,
            isArchived: false,
          });
        });
      } catch (e) {
        // Ignore local storage errors
      }

      // Combine content_items and feed_items
      const contentItems = (contentData || []).map((item: any) => ({
        id: item.id,
        kind: item.kind || null,
        title: item.title,
        byline: item.byline || null,
        meta: item.meta || null,
        image_url: item.image_url || null,
        url: item.url || null,
        source: item.source || null,
        created_at: item.created_at || null,
        // Default status to "unfinished" for new items
        status: (item as any).status || "unfinished",
        isFavorite: (item as any).isFavorite || false,
        isArchived: (item as any).isArchived || false,
        board: (item as any).board || null,
      }));

      const combined = [...contentItems, ...feedData, ...manualData] as SavedItem[];
      // Ensure all items have default status
      combined.forEach((item) => {
        if (!item.status) item.status = "unfinished";
        if (item.isFavorite === undefined) item.isFavorite = false;
        if (item.isArchived === undefined) item.isArchived = false;
      });

      setSavedItems(combined);
    } catch (e: any) {
      setSavedError(e?.message || "Failed to load saved items");
    } finally {
      setSavedLoading(false);
    }
  }

  async function handleDeleteEcho(id: string) {
    try {
      await deleteEcho(id);
      await loadEchoes();
    } catch (e: any) {
      alert(e?.message || "Failed to delete Echo");
    }
  }

  async function handleRemoveSaved(id: string) {
    // Optimistic update
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
    
    // Remove from localStorage
    unsaveLocal(id);
    
    // Remove from account if logged in
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (uid) {
      await supabase
        .from("saved_items")
        .delete()
        .eq("user_id", uid)
        .eq("content_id", id)
        .then(null, () => {
          // Ignore errors - item might not be in saved_items
        });
    }
  }

  // Load both echoes and saved items on mount
  useEffect(() => {
    loadEchoes();
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute counts
  const libraryCounts = useMemo(() => computeLibraryCounts(savedItems), [savedItems]);
  const echoCounts = useMemo(() => computeEchoCounts(echoes), [echoes]);

  // Build library items for sidebar
  const libraryItems = useMemo(
    () => [
      { key: "all" as LibraryFilter, label: "All Items", count: libraryCounts.all },
      { key: "books" as LibraryFilter, label: "Books", count: libraryCounts.books },
      { key: "movies_tv" as LibraryFilter, label: "Movies & TV", count: libraryCounts.movies_tv },
      { key: "music" as LibraryFilter, label: "Music", count: libraryCounts.music },
    ],
    [libraryCounts]
  );

  // Build journal items for sidebar
  const journalItems = useMemo(
    () => [
      { key: "echoes" as const, label: "Echoes", count: echoCounts.echoes },
      { key: "history" as const, label: "History", count: echoCounts.history },
    ],
    [echoCounts]
  );

  // Filter saved items based on active filters
  const filteredSavedItems = useMemo(
    () => filterSavedItems(savedItems, activeSavedFilter, activeLibraryFilter),
    [savedItems, activeSavedFilter, activeLibraryFilter]
  );

  // Get recent echoes (limit 2)
  const recentEchoes = useMemo(() => echoes.slice(0, 2), [echoes]);

  function handleLibraryClick(filter: LibraryFilter) {
    if (filter === "all") {
      setActiveLibraryFilter(null);
    } else {
      setActiveLibraryFilter(filter);
    }
    setActiveJournalFilter(null);
    setActiveBoard(null);
  }

  function handleJournalClick(filter: "echoes" | "history") {
    setActiveJournalFilter(filter);
    setActiveLibraryFilter(null);
    setActiveBoard(null);
    // Navigate to echoes view or history
    if (filter === "echoes") {
      navigate("/collection?tab=echoes");
    }
  }

  function handleBoardClick(boardKey: string) {
    setActiveBoard(boardKey);
    setActiveLibraryFilter(null);
    setActiveJournalFilter(null);
    // Filter by board
    setActiveSavedFilter("favorites"); // For favorites board
  }

  function handleNewBoardClick() {
    const newBoardKey = `board-${Date.now()}`;
    const newBoard = { key: newBoardKey, label: "New Board" };
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoard(newBoardKey);
    // TODO: Persist board if persistence exists
  }

  async function handleAddItem() {
    setShowAddItem(true);
  }

  function handleItemAdded() {
    loadSaved();
    setShowAddItem(false);
  }

  const loading = savedLoading || echoLoading;
  const error = savedError || echoError;

  // Determine what to show based on active filters
  const showEchoes = activeJournalFilter === "echoes";
  const showSavedItems = !activeJournalFilter || activeJournalFilter === null;

  return (
    <div className="studio-page" data-theme="light">
      <div style={{ paddingTop: "96px", paddingBottom: "48px" }}>
        <Container maxWidth="xl" className="collection-container">
          {/* 2-column layout: Sidebar + Main */}
          <div style={{ display: "flex", gap: "32px" }} className="collection-layout">
            {/* LEFT SIDEBAR */}
            <div className="collection-sidebar-wrapper">
              <CollectionSidebar
              activeLibraryFilter={activeLibraryFilter}
              activeJournalFilter={activeJournalFilter}
              activeBoard={activeBoard}
              libraryItems={libraryItems}
              journalItems={journalItems}
              boards={boardsWithCounts}
              onLibraryClick={handleLibraryClick}
              onJournalClick={handleJournalClick}
              onBoardClick={handleBoardClick}
              onNewBoardClick={handleNewBoardClick}
              />
            </div>

            {/* MAIN CONTENT */}
            <main style={{ flex: 1, minWidth: 0 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "32px" }}>
                <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", margin: 0 }}>
                  Collection
                </h1>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowViewOptions(true)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid var(--studio-border)",
                      background: "var(--studio-white)",
                      color: "var(--studio-text-secondary)",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    View Options
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--studio-coral)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {error && (
                <Card
                  style={{
                    padding: "24px",
                    marginBottom: "24px",
                    background: "#FEE2E2",
                    border: "1px solid #DC2626",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ color: "#DC2626", fontWeight: 500 }}>{error}</div>
                </Card>
              )}

              {loading ? (
                <div style={{ padding: "80px 20px", textAlign: "center", color: "var(--studio-text-muted)" }}>
                  Loading...
                </div>
              ) : (
                <>
                  {/* Recent Echoes Section */}
                  {showSavedItems && recentEchoes.length > 0 && (
                    <div style={{ marginBottom: "48px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--studio-text)", margin: 0 }}>
                          Recent Echoes
                        </h2>
                        <button
                          type="button"
                          onClick={() => navigate("/collection?tab=echoes")}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--studio-coral)",
                            fontSize: "14px",
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            padding: 0,
                          }}
                        >
                          View all journal entries →
                        </button>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: "20px",
                        }}
                        className="recent-echoes-grid"
                      >
                        {recentEchoes.map((echo) => (
                          <EchoCard key={echo.id} echo={echo} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Items Section */}
                  {showSavedItems && (
                    <div>
                      <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "16px" }}>
                        Saved Items
                      </h2>

                      {/* Filter Pills */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                        {(["all", "unfinished", "favorites", "archive"] as SavedFilter[]).map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setActiveSavedFilter(filter)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "20px",
                              border: "1px solid var(--studio-border)",
                              background: activeSavedFilter === filter ? "var(--studio-text)" : "var(--studio-white)",
                              color: activeSavedFilter === filter ? "var(--studio-white)" : "var(--studio-text-secondary)",
                              fontSize: "13px",
                              fontWeight: 500,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textTransform: "capitalize",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (activeSavedFilter !== filter) {
                                e.currentTarget.style.borderColor = "var(--studio-gray-300)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (activeSavedFilter !== filter) {
                                e.currentTarget.style.borderColor = "var(--studio-border)";
                              }
                            }}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>

                      {/* Saved Items Grid */}
                      {filteredSavedItems.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              viewMode === "grid"
                                ? "repeat(auto-fill, minmax(180px, 1fr))"
                                : "1fr",
                            gap: viewDensity === "compact" ? "12px" : viewDensity === "comfortable" ? "16px" : "24px",
                            marginBottom: "24px",
                          }}
                          className="collection-grid"
                        >
                          {filteredSavedItems.map((item) => (
                            <SavedItemCard key={item.id} item={item} onRemove={handleRemoveSaved} />
                          ))}
                          
                          {/* "Save something new" add card */}
                          <div
                            onClick={handleAddItem}
                            style={{
                              background: "var(--studio-white)",
                              border: "2px dashed var(--studio-border)",
                              borderRadius: "12px",
                              padding: "40px 20px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              minHeight: viewMode === "grid" ? "200px" : "auto",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "var(--studio-coral)";
                              e.currentTarget.style.background = "var(--studio-coral-light)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--studio-border)";
                              e.currentTarget.style.background = "var(--studio-white)";
                            }}
                          >
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "var(--studio-text-secondary)",
                                textAlign: "center",
                              }}
                            >
                              Save something new
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: "80px 20px",
                            textAlign: "center",
                            color: "var(--studio-text-muted)",
                          }}
                        >
                          <p style={{ fontSize: "16px", marginBottom: "16px" }}>No saved items found.</p>
                          <button
                            type="button"
                            onClick={handleAddItem}
                            style={{
                              padding: "12px 24px",
                              borderRadius: "8px",
                              border: "none",
                              background: "var(--studio-coral)",
                              color: "white",
                              fontSize: "14px",
                              fontWeight: 500,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Add your first item
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Echoes List View (when Journal > Echoes is clicked) */}
                  {showEchoes && (
                    <div>
                      <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "24px" }}>
                        Echoes
                      </h2>
                      {echoes.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                          {echoes.map((echo) => (
                            <TimelineEchoPost key={echo.id} echo={echo} onDelete={handleDeleteEcho} />
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: "80px 20px",
                            textAlign: "center",
                            color: "var(--studio-text-muted)",
                          }}
                        >
                          <p style={{ fontSize: "16px", marginBottom: "16px" }}>No echoes yet.</p>
                          <p style={{ fontSize: "14px" }}>Create your first Echo to start building your journal.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </Container>
      </div>

      {/* Modals */}
      <AddItemModal isOpen={showAddItem} onClose={() => setShowAddItem(false)} onItemAdded={handleItemAdded} />
      <ViewOptionsModal
        isOpen={showViewOptions}
        onClose={() => setShowViewOptions(false)}
        density={viewDensity}
        viewMode={viewMode}
        onDensityChange={setViewDensity}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}

export default function Collection() {
  const { isAuthed, loading } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (loading) {
    return (
      <div className="studio-page" data-theme="light" style={{ paddingTop: "96px", paddingBottom: "40px", paddingLeft: "20px", paddingRight: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--studio-text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="studio-page" data-theme="light" style={{ paddingTop: "96px", paddingBottom: "40px", paddingLeft: "20px", paddingRight: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "16px", color: "var(--studio-text)" }}>
          Collection
        </h1>
        <div
          style={{
            padding: "40px 24px",
            borderRadius: "12px",
            border: "1px solid var(--studio-border)",
            backgroundColor: "var(--studio-white)",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px", color: "var(--studio-text)" }}>
            Your collection
          </h2>
          <p style={{ fontSize: "15px", color: "var(--studio-text-secondary)", marginBottom: "24px" }}>
            Sign in to see your Echoes and saved items organized by date.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--studio-coral)",
              color: "white",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--studio-coral-dark)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--studio-coral)";
            }}
          >
            Sign In
          </button>
        </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Sign in to view Collection"
          message="We'll send you a magic link to sign in."
        />
      </div>
    );
  }

  return <CollectionContent />;
}


