import React, { useState, useMemo } from "react";
import CalendarGrid from "./CalendarGrid";
import DayDrawer from "./DayDrawer";
import { type EchoWithContent } from "../../data/echoApi";
import type { SavedItem } from "../../pages/Timeline";

type CalendarViewMode = "month" | "week";
type ViewMode = "echo" | "saved";

type TimelineCalendarProps = {
  viewMode: ViewMode;
  echoes: EchoWithContent[];
  savedItems: SavedItem[];
  onDeleteEcho?: (id: string) => void;
  onRemoveSaved?: (id: string) => void;
  searchQuery?: string;
};

function getDateKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getFirstLine(text: string): string {
  const lines = text.split("\n");
  return lines[0].trim().slice(0, 60);
}

export default function TimelineCalendar({
  viewMode,
  echoes,
  savedItems,
  onDeleteEcho,
  onRemoveSaved,
  searchQuery = "",
}: TimelineCalendarProps) {
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = useMemo(() => {
    const now = new Date();
    return getDateKey(now.toISOString());
  }, []);

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: Record<
      string,
      { echoes: EchoWithContent[]; saved: SavedItem[] }
    > = {};

    if (viewMode === "echo") {
      const filtered = searchQuery
        ? echoes.filter((e) => e.note?.toLowerCase().includes(searchQuery.toLowerCase()))
        : echoes;

      filtered.forEach((echo) => {
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
  }, [viewMode, echoes, savedItems, searchQuery]);

  function getDayData(dateKey: string) {
    const group = groupedItems[dateKey] || { echoes: [], saved: [] };
    const items = viewMode === "echo" ? group.echoes : group.saved;

    if (viewMode === "echo") {
      const snippets = group.echoes
        .slice(0, 2)
        .map((e) => getFirstLine(e.note || ""))
        .filter(Boolean);
      return { count: group.echoes.length, snippets };
    } else {
      return { count: group.saved.length, snippets: [] };
    }
  }

  function handleTodayClick() {
    setCurrentMonth(new Date());
    setSelectedDate(today);
  }

  function handleMonthChange(delta: number) {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setCurrentMonth(newMonth);
  }

  const selectedDateData = selectedDate ? groupedItems[selectedDate] || { echoes: [], saved: [] } : null;

  return (
    <div>
      {/* Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => handleMonthChange(-1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              padding: "4px 8px",
              color: "var(--ink)",
            }}
          >
            ←
          </button>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--ink)",
              minWidth: "160px",
              textAlign: "center",
            }}
          >
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <button
            onClick={() => handleMonthChange(1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              padding: "4px 8px",
              color: "var(--ink)",
            }}
          >
            →
          </button>
        </div>

        {/* View toggle and Today button */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
              onClick={() => setCalendarView("month")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: calendarView === "month" ? "var(--border)" : "transparent",
                cursor: "pointer",
                fontWeight: calendarView === "month" ? 600 : 500,
                fontSize: "13px",
                color: "var(--ink-muted)",
              }}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarView("week")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: calendarView === "week" ? "var(--border)" : "transparent",
                cursor: "pointer",
                fontWeight: calendarView === "week" ? 600 : 500,
                fontSize: "13px",
                color: "var(--ink-muted)",
              }}
            >
              Week
            </button>
          </div>
          <button
            onClick={handleTodayClick}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <CalendarGrid
          viewMode={calendarView}
          year={currentMonth.getFullYear()}
          month={currentMonth.getMonth()}
          onDateClick={setSelectedDate}
          getDayData={getDayData}
          selectedDate={selectedDate}
          todayDate={today}
        />
      </div>

      {/* Day Drawer */}
      {selectedDate && selectedDateData && (
        <DayDrawer
          date={selectedDate}
          echoes={selectedDateData.echoes}
          savedItems={selectedDateData.saved}
          viewMode={viewMode}
          onClose={() => setSelectedDate(null)}
          onDeleteEcho={onDeleteEcho}
          onRemoveSaved={onRemoveSaved}
        />
      )}
    </div>
  );
}




