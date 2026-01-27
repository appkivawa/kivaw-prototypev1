import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listMyEchoes, deleteEcho, type EchoWithContent } from "../data/echoApi";
import { supabase } from "../lib/supabaseClient";
import { getLocalSaved, getLocalSavedIds, unsaveLocal } from "../data/savedLocal";
import { useSession } from "../auth/useSession";
import TimelineCalendar from "../components/timeline/TimelineCalendar";
import TimelineEmptyState from "../components/timeline/TimelineEmptyState";
import { ToastContainer } from "../components/ui/Toast";
import LoginModal from "../components/auth/LoginModal";
import Container from "../ui/Container";
import Card from "../ui/Card";
import Button from "../ui/Button";
import SectionHeader from "../ui/SectionHeader";
import EmptyState from "../ui/EmptyState";
import "../styles/studio.css";

// This file is being renamed to Collection.tsx
// Keeping this file temporarily for reference during migration

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
};

type ViewMode = "echo" | "saved";

function getStoredViewMode(location: { pathname: string }): ViewMode {
  // Check URL first
  if (location.pathname.includes("saved")) return "saved";
  // Check localStorage
  try {
    const stored = localStorage.getItem("kivaw_timeline_view_v1");
    if (stored === "echo" || stored === "saved") return stored;
  } catch {
    // ignore
  }
  return "echo"; // default
}

function setStoredViewMode(mode: ViewMode) {
  try {
    localStorage.setItem("kivaw_timeline_view_v1", mode);
  } catch {
    // ignore
  }
}

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


function TimelineContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode(location));
  const [searchQuery, setSearchQuery] = useState("");

  // Echo state
  const [echoes, setEchoes] = useState<EchoWithContent[]>([]);
  const [echoLoading, setEchoLoading] = useState(true);
  const [echoError, setEchoError] = useState<string | null>(null);

  // Saved state
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);


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
      }));

      setSavedItems([...contentItems, ...feedData] as SavedItem[]);
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

  useEffect(() => {
    if (viewMode === "echo") {
      loadEchoes();
    } else {
      loadSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);


  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setStoredViewMode(mode);
  }

  const loading = viewMode === "echo" ? echoLoading : savedLoading;
  const error = viewMode === "echo" ? echoError : savedError;
  const items = viewMode === "echo" ? echoes : savedItems;

  return (
    <div className="studio-page" data-theme="light">
      <Container maxWidth="xl" className="timeline-container" style={{ paddingTop: "96px", paddingBottom: "48px" }}>
        {/* Header with toggle */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", margin: 0 }}>Timeline</h1>
            <div className="timeline-mode-toggle" style={{ display: "flex", gap: "24px", alignItems: "baseline" }}>
              <button
                onClick={() => handleViewModeChange("echo")}
                className={`timeline-mode-btn ${viewMode === "echo" ? "active" : ""}`}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: viewMode === "echo" ? 600 : 400,
                  fontSize: "16px",
                  color: viewMode === "echo" ? "var(--studio-coral)" : "var(--studio-text-muted)",
                  textDecoration: viewMode === "echo" ? "underline" : "none",
                  textUnderlineOffset: "4px",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                Echo
              </button>
              <button
                onClick={() => handleViewModeChange("saved")}
                className={`timeline-mode-btn ${viewMode === "saved" ? "active" : ""}`}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: viewMode === "saved" ? 600 : 400,
                  fontSize: "16px",
                  color: viewMode === "saved" ? "var(--studio-coral)" : "var(--studio-text-muted)",
                  textDecoration: viewMode === "saved" ? "underline" : "none",
                  textUnderlineOffset: "4px",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                Saved
              </button>
            </div>
          </div>
        </div>

        {/* Search (Echoes only) */}
        {viewMode === "echo" && (
          <div style={{ marginBottom: "32px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Echoes..."
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "15px",
                border: "1px solid var(--studio-border)",
                borderRadius: "8px",
                background: "var(--studio-white)",
                color: "var(--studio-text)",
                fontFamily: "inherit",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--studio-coral)";
                e.target.style.outline = "none";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--studio-border)";
              }}
            />
          </div>
        )}

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
        ) : items.length === 0 ? (
          <TimelineEmptyState viewMode={viewMode} />
        ) : (
          <TimelineCalendar
            viewMode={viewMode}
            echoes={echoes}
            savedItems={savedItems}
            onDeleteEcho={handleDeleteEcho}
            onRemoveSaved={handleRemoveSaved}
            searchQuery={searchQuery}
          />
        )}
      </Container>
    </div>
  );
}

export default function Timeline() {
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
          Timeline
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
            Your reflection timeline
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
          title="Sign in to view Timeline"
          message="We'll send you a magic link to sign in."
        />
      </div>
    );
  }

  return <TimelineContent />;
}
