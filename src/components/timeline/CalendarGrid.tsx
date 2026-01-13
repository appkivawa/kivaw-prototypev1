import React from "react";

type CalendarViewMode = "month" | "week";

type CalendarGridProps = {
  viewMode: CalendarViewMode;
  year: number;
  month: number;
  onDateClick: (date: string) => void;
  getDayData: (date: string) => { count: number; snippets: string[] };
  selectedDate: string | null;
  todayDate: string;
};

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function getWeekDays(year: number, month: number, week: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOfWeek = new Date(firstDay);
  startOfWeek.setDate(firstDay.getDate() + week * 7 - firstDay.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function CalendarGrid({
  viewMode,
  year,
  month,
  onDateClick,
  getDayData,
  selectedDate,
  todayDate,
}: CalendarGridProps) {
  const days = viewMode === "month" ? getCalendarDays(year, month) : getWeekDays(year, month, 0);
  const today = new Date(todayDate + "T00:00:00");

  return (
    <div>
      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ink-tertiary)",
              padding: "8px",
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
          gap: "8px",
        }}
      >
        {days.map((day, idx) => {
          const dateKey = getDateKey(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = day.toDateString() === today.toDateString();
          const isSelected = selectedDate === dateKey;
          const dayData = getDayData(dateKey);

          return (
            <button
              key={idx}
              onClick={() => {
                if (isCurrentMonth && dayData.count > 0) {
                  onDateClick(dateKey);
                }
              }}
              disabled={!isCurrentMonth || dayData.count === 0}
              style={{
                minHeight: "100px",
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                background: isSelected
                  ? "var(--ink)"
                  : isToday
                  ? "var(--border-strong)"
                  : dayData.count > 0
                  ? "var(--border)"
                  : "transparent",
                cursor: isCurrentMonth && dayData.count > 0 ? "pointer" : "default",
                color: isSelected ? "var(--bg)" : isCurrentMonth ? "var(--ink)" : "var(--ink-tertiary)",
                fontSize: "14px",
                fontWeight: isToday ? 700 : 500,
                position: "relative",
                transition: "all 0.2s",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
              onMouseEnter={(e) => {
                if (isCurrentMonth && dayData.count > 0 && !isSelected) {
                  e.currentTarget.style.backgroundColor = "var(--border-strong)";
                }
              }}
              onMouseLeave={(e) => {
                if (isCurrentMonth && dayData.count > 0 && !isSelected) {
                  e.currentTarget.style.backgroundColor = isToday ? "var(--border-strong)" : "var(--border)";
                }
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: isToday ? 700 : 500 }}>{day.getDate()}</div>
              {dayData.count > 0 && (
                <>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      opacity: isSelected ? 0.9 : 0.7,
                      marginTop: "4px",
                    }}
                  >
                    {dayData.count} {dayData.count === 1 ? "echo" : "echoes"}
                  </div>
                  {dayData.snippets.length > 0 && (
                    <div
                      style={{
                        fontSize: "11px",
                        lineHeight: 1.4,
                        opacity: isSelected ? 0.9 : 0.6,
                        marginTop: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {dayData.snippets[0]}
                      {dayData.snippets.length > 1 && (
                        <div
                          style={{
                            marginTop: "2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {dayData.snippets[1]}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

