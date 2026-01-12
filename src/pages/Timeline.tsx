import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { listMyEchoes, deleteEcho, type EchoWithContent } from "../data/echoApi";
import { supabase } from "../lib/supabaseClient";
import { getLocalSaved, getLocalSavedIds, unsaveLocal } from "../data/savedLocal";
import RequireAuth from "../auth/RequireAuth";
import type { ContentItem } from "../data/contentApi";

// Unified saved item type that can be either content_item or feed_item
type SavedItem = {
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

function EchoCard({ echo, onDelete }: { echo: EchoWithContent; onDelete: (id: string) => void }) {
  const content = echo.content_items;
  const [contentExpanded, setContentExpanded] = useState(false);

  return (
    <article
      style={{
        padding: "0 0 24px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: "24px",
      }}
    >
      {/* Reflection - primary, emphasized */}
      <div
        style={{
          fontSize: "16px",
          lineHeight: 1.6,
          color: "var(--ink)",
          marginBottom: content ? "12px" : "0",
        }}
      >
        {echo.note}
      </div>

      {/* Content - collapsed by default, secondary */}
      {content && (
        <div style={{ marginTop: "12px" }}>
          {!contentExpanded ? (
            <button
              onClick={() => setContentExpanded(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--ink-tertiary)",
                padding: "0",
                textAlign: "left",
                textDecoration: "underline",
              }}
            >
              {content.image_url && (
                <img
                  src={content.image_url}
                  alt={content.title}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "4px",
                    objectFit: "cover",
                    display: "inline-block",
                    verticalAlign: "middle",
                    marginRight: "8px",
                  }}
                />
              )}
              {content.title}
            </button>
          ) : (
            <div
              style={{
                padding: "12px",
                borderRadius: "6px",
                backgroundColor: "var(--border)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {content.image_url && (
                  <img
                    src={content.image_url}
                    alt={content.title}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "4px",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                      marginBottom: "2px",
                    }}
                  >
                    {content.title}
                  </div>
                  {content.kind && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-tertiary)",
                      }}
                    >
                      {content.kind}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setContentExpanded(false)}
                style={{
                  marginTop: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--ink-tertiary)",
                  padding: "0",
                  textDecoration: "underline",
                }}
              >
                Collapse
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer - minimal */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "12px", color: "var(--ink-tertiary)" }}>
          <span>{formatTime(echo.created_at)}</span>
          {echo.shared_to_waves && (
            <span
              style={{
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(34, 197, 94, 0.08)",
                color: "rgba(34, 197, 94, 0.7)",
              }}
            >
              Wave
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (confirm("Delete this Echo?")) {
              onDelete(echo.id);
            }
          }}
          style={{
            background: "none",
            border: "none",
            color: "rgba(239, 68, 68, 0.6)",
            cursor: "pointer",
            fontSize: "12px",
            padding: "2px 0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(239, 68, 68, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(239, 68, 68, 0.6)";
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function SavedCard({ item, onRemove }: { item: SavedItem; onRemove: (id: string) => void }) {
  return (
    <article
      style={{
        padding: "0 0 20px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.title}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "4px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "4px",
            }}
          >
            {item.title}
          </div>
          {item.byline && (
            <div
              style={{
                fontSize: "13px",
                color: "var(--ink-muted)",
                marginBottom: "2px",
              }}
            >
              {item.byline}
            </div>
          )}
          {item.kind && (
            <div
              style={{
                fontSize: "12px",
                  color: "var(--ink-tertiary)",
                marginTop: "2px",
              }}
            >
              {item.kind}
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(239, 68, 68, 0.5)",
            cursor: "pointer",
            fontSize: "12px",
            padding: "2px 0",
            alignSelf: "flex-start",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(239, 68, 68, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(239, 68, 68, 0.5)";
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

function TimelineContent() {
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode(location));

  // Echo state
  const [echoes, setEchoes] = useState<EchoWithContent[]>([]);
  const [echoLoading, setEchoLoading] = useState(true);
  const [echoError, setEchoError] = useState<string | null>(null);

  // Saved state
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
        .catch(() => {
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

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, { echoes: EchoWithContent[]; saved: SavedItem[] }> = {};

    if (viewMode === "echo") {
      echoes.forEach((echo) => {
        const dateKey = getDateKey(echo.created_at);
        if (!groups[dateKey]) {
          groups[dateKey] = { echoes: [], saved: [] };
        }
        groups[dateKey].echoes.push(echo);
      });
    } else {
      savedItems.forEach((item) => {
        const dateKey = getDateKey(item.created_at || new Date().toISOString());
        if (!groups[dateKey]) {
          groups[dateKey] = { echoes: [], saved: [] };
        }
        groups[dateKey].saved.push(item);
      });
    }

    return groups;
  }, [echoes, savedItems, viewMode]);

  // Calendar data
  const calendarDays = useMemo(() => {
    return getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return { echoes: [], saved: [] };
    return groupedItems[selectedDate] || { echoes: [], saved: [] };
  }, [selectedDate, groupedItems]);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setStoredViewMode(mode);
    setSelectedDate(null);
  }

  const loading = viewMode === "echo" ? echoLoading : savedLoading;
  const error = viewMode === "echo" ? echoError : savedError;
  const items = viewMode === "echo" ? echoes : savedItems;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        padding: "20px 16px",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header with toggle - tighter */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Timeline
            </h1>

            {/* Toggle */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                padding: "4px",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                background: "var(--surface)",
              }}
            >
              <button
                onClick={() => handleViewModeChange("echo")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "echo" ? "var(--border)" : "transparent",
                  cursor: "pointer",
                  fontWeight: viewMode === "echo" ? 600 : 500,
                  fontSize: "13px",
                  color: "var(--ink-muted)",
                  transition: "all 0.2s",
                }}
              >
                Echo
              </button>
              <button
                onClick={() => handleViewModeChange("saved")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "saved" ? "var(--border)" : "transparent",
                  cursor: "pointer",
                  fontWeight: viewMode === "saved" ? 600 : 500,
                  fontSize: "13px",
                  color: "var(--ink-muted)",
                  transition: "all 0.2s",
                }}
              >
                Saved
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              color: "rgba(239, 68, 68, 0.9)",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: "var(--ink-tertiary)" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: "rgba(0,0,0,0.5)" }}>
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>
              No {viewMode === "echo" ? "Echoes" : "saved items"} yet
            </p>
            <p style={{ fontSize: "14px" }}>
              {viewMode === "echo"
                ? 'Start reflecting by clicking "Echo" on any content item.'
                : "Save items to see them here."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "24px",
            }}
          >
            {/* Calendar */}
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                height: "fit-content",
                position: "sticky",
                top: "24px",
              }}
            >
              {/* Month navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <button
                  onClick={() => {
                    const prev = new Date(currentMonth);
                    prev.setMonth(prev.getMonth() - 1);
                    setCurrentMonth(prev);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "18px",
                    padding: "4px 8px",
                  }}
                >
                  ←
                </button>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
                <button
                  onClick={() => {
                    const next = new Date(currentMonth);
                    next.setMonth(next.getMonth() + 1);
                    setCurrentMonth(next);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "18px",
                    padding: "4px 8px",
                  }}
                >
                  →
                </button>
              </div>

              {/* Weekday headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "4px",
                  marginBottom: "8px",
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    style={{
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-tertiary)",
                      padding: "4px",
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "4px",
                }}
              >
                {calendarDays.map((day, idx) => {
                  const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday =
                    day.toDateString() === new Date().toDateString();
                  const count = groupedItems[dateKey]
                    ? viewMode === "echo"
                      ? groupedItems[dateKey].echoes.length
                      : groupedItems[dateKey].saved.length
                    : 0;
                  const isSelected = selectedDate === dateKey;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isCurrentMonth && count > 0) {
                          setSelectedDate(dateKey);
                        }
                      }}
                      disabled={!isCurrentMonth || count === 0}
                      style={{
                        aspectRatio: "1",
                        border: "none",
                        borderRadius: "6px",
                        background: isSelected
                          ? "rgba(0,0,0,0.15)"
                          : isToday
                          ? "rgba(0,0,0,0.05)"
                          : count > 0
                          ? "rgba(0,0,0,0.02)"
                          : "transparent",
                        cursor: isCurrentMonth && count > 0 ? "pointer" : "default",
                        color: isCurrentMonth ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.3)",
                        fontSize: "13px",
                        fontWeight: isToday ? 700 : 500,
                        position: "relative",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (isCurrentMonth && count > 0 && !isSelected) {
                          e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.08)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isCurrentMonth && count > 0 && !isSelected) {
                          e.currentTarget.style.backgroundColor = isToday ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.02)";
                        }
                      }}
                    >
                      <div>{day.getDate()}</div>
                      {count > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "2px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "4px",
                            height: "4px",
                            borderRadius: "50%",
                            backgroundColor: isSelected ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.4)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Items list */}
            <div>
              {selectedDate ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <h2
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "var(--ink)",
                        margin: 0,
                      }}
                    >
                      {formatDate(selectedDate + "T00:00:00")}
                    </h2>
                    <button
                      onClick={() => setSelectedDate(null)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "var(--ink-muted)",
                        padding: "4px 8px",
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {viewMode === "echo" ? (
                    <div>
                      {selectedDayItems.echoes.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px", color: "rgba(0,0,0,0.5)" }}>
                          No Echoes on this day
                        </div>
                      ) : (
                        selectedDayItems.echoes
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((echo) => <EchoCard key={echo.id} echo={echo} onDelete={handleDeleteEcho} />)
                      )}
                    </div>
                  ) : (
                    <div>
                      {selectedDayItems.saved.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px", color: "rgba(0,0,0,0.5)" }}>
                          No saved items on this day
                        </div>
                      ) : (
                        selectedDayItems.saved
                          .sort(
                            (a, b) =>
                              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                          )
                          .map((item) => <SavedCard key={item.id} item={item} onRemove={handleRemoveSaved} />)
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "14px", color: "rgba(0,0,0,0.6)", marginBottom: "20px" }}>
                    Click a date on the calendar to view items from that day
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Timeline() {
  return (
    <RequireAuth title="Timeline" message="Please sign in to view your Timeline">
      <TimelineContent />
    </RequireAuth>
  );
}
