import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/requireAuth";
import { fetchAllEvents, type EventFilters } from "../data/eventsApi";

type ViewMode = "grid" | "list";
type MoodFilter = "all" | "destructive" | "expansive" | "minimize" | "blank";

interface Event {
  id: string;
  title: string;
  description: string;
  emoji: string;
  date: {
    day: number;
    month: string;
    full: string;
  };
  time: string;
  location: string;
  price: string;
  attendees: string;
  moods: MoodFilter[];
  tags: string[];
  source: "Eventbrite" | "Meetup" | "Posh" | "Other";
  matchScore?: number;
  image?: string | null;
  url?: string;
}

const MOOD_CONFIG: Record<MoodFilter, { emoji: string; label: string; desc?: string }> = {
  all: { emoji: "✨", label: "All Events" },
  destructive: { emoji: "🔥", label: "Destructive", desc: "High energy, intense" },
  expansive: { emoji: "🌱", label: "Expansive", desc: "Growth, learning" },
  minimize: { emoji: "🎋", label: "Minimize", desc: "Calm, simple" },
  blank: { emoji: "🌙", label: "Blank", desc: "Chill, social" },
};

function EventCard({
  event,
  onSave,
  isSaved,
  view = "grid",
  matchScore,
}: {
  event: Event;
  onSave: (id: string) => void;
  isSaved: boolean;
  view?: ViewMode;
  matchScore?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const getMoodColor = (mood: MoodFilter) => {
    const colors: Record<MoodFilter, string> = {
      all: "events-mood-gray",
      destructive: "events-mood-red",
      expansive: "events-mood-green",
      minimize: "events-mood-blue",
      blank: "events-mood-purple",
    };
    return colors[mood] || colors.all;
  };

  if (view === "list") {
    return (
      <Card
        className="events-card-list"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="events-list-date">
          <div className="events-list-date-month">{event.date.month}</div>
          <div className="events-list-date-day">{event.date.day}</div>
        </div>

        <div className="events-list-image">
          {event.image ? (
            <img src={event.image} alt={event.title} />
          ) : (
            <div className="events-list-emoji">{event.emoji}</div>
          )}
        </div>

        <div className="events-list-content">
          <div className="events-list-header">
            <h3 className="events-list-title">{event.title}</h3>
            {matchScore && (
              <div className="events-match-badge">
                <span className="events-match-icon">✨</span>
                {matchScore}%
              </div>
            )}
          </div>

          <p className="events-list-description">{event.description}</p>

          <div className="events-list-meta">
            <div className="events-meta-item">
              <span className="events-meta-icon">🕐</span>
              {event.time}
            </div>
            <div className="events-meta-item">
              <span className="events-meta-icon">📍</span>
              {event.location}
            </div>
            <div className="events-meta-item">
              <span className="events-meta-icon">👥</span>
              {event.attendees}
            </div>
            <div className="events-meta-item events-meta-price">
              <span className="events-meta-icon">💰</span>
              {event.price}
            </div>
          </div>

          <div className="events-list-tags">
            {event.moods.map((mood, i) => (
              <span key={i} className={`events-mood-tag ${getMoodColor(mood)}`}>
                {MOOD_CONFIG[mood].emoji} {MOOD_CONFIG[mood].label}
              </span>
            ))}
            {event.tags.slice(0, 2).map((tag, i) => (
              <span key={i} className="events-tag">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="events-list-actions">
          <button
            className={`events-heart-btn ${isSaved ? "events-heart-saved" : ""}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSave(event.id);
            }}
            aria-label={isSaved ? "Unsave" : "Save"}
          >
            {isSaved ? "♥" : "♡"}
          </button>
          <button
            className="events-view-btn"
            type="button"
            onClick={() => window.open(event.url || "#", "_blank")}
          >
            View →
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="events-card-grid"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="events-card-image">
        {event.image ? (
          <img src={event.image} alt={event.title} />
        ) : (
          <div className="events-card-emoji">{event.emoji}</div>
        )}

        <button
          className={`events-card-heart ${isSaved ? "events-heart-saved" : ""}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave(event.id);
          }}
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          {isSaved ? "♥" : "♡"}
        </button>

        {matchScore && (
          <div className="events-card-match">
            <span className="events-match-icon">✨</span>
            {matchScore}% match
          </div>
        )}

        <div className="events-card-source">{event.source}</div>
      </div>

      <div className="events-card-content">
        <div className="events-card-date">
          <span className="events-date-icon">📅</span>
          {event.date.full}
        </div>

        <h3 className="events-card-title">{event.title}</h3>
        <p className="events-card-description">{event.description}</p>

        <div className="events-card-meta">
          <div className="events-meta-item">
            <span className="events-meta-icon">🕐</span>
            {event.time}
          </div>
          <div className="events-meta-item">
            <span className="events-meta-icon">📍</span>
            {event.location}
          </div>
          <div className="events-meta-item">
            <span className="events-meta-icon">👥</span>
            {event.attendees}
          </div>
          <div className="events-meta-item events-meta-price">
            <span className="events-meta-icon">💰</span>
            {event.price}
          </div>
        </div>

        <div className="events-card-tags">
          {event.moods.map((mood, i) => (
            <span key={i} className={`events-mood-tag ${getMoodColor(mood)}`}>
              {MOOD_CONFIG[mood].emoji} {MOOD_CONFIG[mood].label}
            </span>
          ))}
        </div>

        <div className="events-card-tags">
          {event.tags.map((tag, i) => (
            <span key={i} className="events-tag">
              #{tag}
            </span>
          ))}
        </div>

        <button
          className="events-card-cta"
          type="button"
          onClick={() => window.open(event.url || "#", "_blank")}
        >
          View Event Details →
        </button>
      </div>
    </Card>
  );
}

export default function Events() {
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedMood, setSelectedMood] = useState<MoodFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Quick filters
  const quickFilters = ["This Weekend", "Free", "Online", "Outdoors", "Beginner Friendly", "Small Group"];

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        // Get user location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!cancelled) {
                setUserLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                });
              }
            },
            () => {
              // User denied or error - continue without location
            }
          );
        }

        // Check auth
        const uid = await getUserId();
        if (!cancelled) {
          setIsAuthed(!!uid);
        }

        // Fetch events from APIs (Eventbrite, Meetup, Posh)
        // TODO: Replace with actual API calls once API keys are configured
        const filters: EventFilters = {
          location: userLocation || undefined,
          moods: selectedMood !== "all" ? [selectedMood] : undefined,
        };

        // Try to fetch from APIs, fallback to mock data
        let fetchedEvents: Event[] = [];
        try {
          fetchedEvents = await fetchAllEvents(filters);
        } catch (error) {
          console.warn("Could not fetch events from APIs, using mock data:", error);
        }

        // Use mock data if API returns empty (for now)
        const mockEvents: Event[] = [
          {
            id: "1",
            title: "Sunrise Yoga & Meditation",
            emoji: "🧘",
            description: "Start your day with intention at Brooklyn Bridge Park. Gentle flow suitable for all levels.",
            date: { day: 15, month: "FEB", full: "Feb 15, 2026" },
            time: "Tomorrow, 6:30 AM - 8:00 AM",
            location: "Brooklyn Bridge Park, NY",
            price: "Free",
            attendees: "45 going",
            moods: ["expansive", "minimize"],
            tags: ["wellness", "outdoor", "morning"],
            source: "Meetup",
            matchScore: 95,
            image: null,
          },
          {
            id: "2",
            title: "Rage Room Experience",
            emoji: "💥",
            description: "Smash things in a safe environment. Release stress and channel your energy productively.",
            date: { day: 16, month: "FEB", full: "Feb 16, 2026" },
            time: "This Weekend, 2:00 PM - 3:30 PM",
            location: "Manhattan, NY",
            price: "$45",
            attendees: "12 going",
            moods: ["destructive"],
            tags: ["stress-relief", "unique", "indoor"],
            source: "Eventbrite",
            matchScore: 94,
            image: null,
          },
          {
            id: "3",
            title: "Silent Reading Club",
            emoji: "📚",
            description: "Read together in comfortable silence at a cozy local cafe. Bring your own book.",
            date: { day: 18, month: "FEB", full: "Feb 18, 2026" },
            time: "Thursday, 7:00 PM - 9:00 PM",
            location: "Greenwich Village, NY",
            price: "Free",
            attendees: "28 going",
            moods: ["minimize", "blank"],
            tags: ["reading", "quiet", "community"],
            source: "Meetup",
            matchScore: 86,
            image: null,
          },
          {
            id: "4",
            title: "Creative Workshop: Vision Boarding",
            emoji: "🎨",
            description: "Create a visual representation of your goals and dreams. All materials provided.",
            date: { day: 19, month: "FEB", full: "Feb 19, 2026" },
            time: "Friday, 6:30 PM - 8:30 PM",
            location: "Chelsea, NY",
            price: "$35",
            attendees: "18 going",
            moods: ["expansive"],
            tags: ["creative", "growth", "art"],
            source: "Eventbrite",
            matchScore: 92,
            image: null,
          },
        ];

        if (!cancelled) {
          // Use fetched events if available, otherwise use mock data
          const eventsToUse = fetchedEvents.length > 0 ? fetchedEvents : mockEvents;
          
          // TODO: Calculate match scores based on user preferences
          // For now, mock events already have match scores
          
          setEvents(eventsToUse);
        }
      } catch (e: any) {
        console.error("Error loading events:", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesMood = selectedMood === "all" || event.moods.includes(selectedMood);
      const matchesSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !selectedDate || event.date.day === selectedDate;

      return matchesMood && matchesSearch && matchesDate;
    });
  }, [events, selectedMood, searchQuery, selectedDate]);

  const recommendedEvents = useMemo(() => {
    return events
      .filter((e) => e.matchScore)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, 3);
  }, [events]);

  const handleSave = async (eventId: string) => {
    const uid = await requireAuth(navigate, "/events");
    if (!uid) return;

    setSavedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });

    // TODO: Save to database
  };

  const handleFilterToggle = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  return (
    <div className="page">
      <div className="kivaw-pagehead">
        <div className="events-header-icon">📅</div>
        <h1>Events</h1>
        <p>Find experiences that match your mood</p>
      </div>

      <div className="center-wrap">
        {/* Recommended Section */}
        {recommendedEvents.length > 0 && !loading && (
          <Card className="events-recommended">
            <div className="events-recommended-header">
              <span className="events-recommended-icon">✨</span>
              <h3 className="events-recommended-title">Recommended for You</h3>
            </div>
            <p className="events-recommended-desc">Based on your activity patterns and preferences</p>
            <div className="events-recommended-grid">
              {recommendedEvents.map((event, i) => (
                <button
                  key={event.id}
                  className="events-recommended-card"
                  type="button"
                  onClick={() => window.open(event.url || "#", "_blank")}
                >
                  <div className="events-recommended-emoji">{event.emoji}</div>
                  <div className="events-recommended-match">{event.matchScore}% match</div>
                  <h4 className="events-recommended-title-small">{event.title}</h4>
                  <div className="events-recommended-meta">
                    <div className="events-recommended-meta-item">
                      <span>📅</span>
                      {event.date.full}
                    </div>
                    <div className="events-recommended-meta-item">
                      <span>📍</span>
                      {event.location}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="center card-pad">
          {/* Search */}
          <div className="explore-search-wrapper">
            <div className="explore-search-icon">🔍</div>
            <input
              className="explore-search-input"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="explore-search-clear"
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Mood Filter */}
          <div className="events-mood-filter-section">
            <h3 className="events-section-title">Filter by mood</h3>
            <div className="events-mood-filter-grid">
              {(Object.keys(MOOD_CONFIG) as MoodFilter[]).map((mood) => {
                const config = MOOD_CONFIG[mood];
                return (
                  <button
                    key={mood}
                    className={`events-mood-filter-btn ${selectedMood === mood ? "events-mood-filter-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedMood(mood)}
                  >
                    <div className="events-mood-filter-emoji">{config.emoji}</div>
                    <div className="events-mood-filter-label">{config.label}</div>
                    {config.desc && (
                      <div className="events-mood-filter-desc">{config.desc}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Filters & Controls */}
          <div className="explore-controls">
            <div className="explore-controls-left">
              <span className="explore-results-count">
                {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
              </span>
              {(selectedMood !== "all" || searchQuery || activeFilters.length > 0) && (
                <button
                  className="explore-clear-filters"
                  type="button"
                  onClick={() => {
                    setSelectedMood("all");
                    setSearchQuery("");
                    setActiveFilters([]);
                    setSelectedDate(null);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="explore-controls-right">
              <div className="explore-view-toggle">
                <button
                  className={`explore-view-btn ${viewMode === "grid" ? "explore-view-btn-active" : ""}`}
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  ⬜
                </button>
                <button
                  className={`explore-view-btn ${viewMode === "list" ? "explore-view-btn-active" : ""}`}
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="events-quick-filters">
            {quickFilters.map((filter) => (
              <button
                key={filter}
                className={`events-quick-filter ${activeFilters.includes(filter) ? "events-quick-filter-active" : ""}`}
                type="button"
                onClick={() => handleFilterToggle(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {!isAuthed && (
            <div className="kivaw-signinPrompt" style={{ marginTop: 12, marginBottom: 16 }}>
              <p className="muted" style={{ margin: 0 }}>
                Want to save events? Sign in to heart them.
              </p>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => navigate("/login", { state: { from: "/events" } })}
              >
                Sign in →
              </button>
            </div>
          )}

          {loading ? (
            <p className="muted">Loading events…</p>
          ) : filteredEvents.length === 0 ? (
            <div className="explore-empty-state">
              <div className="explore-empty-icon">🔍</div>
              <h3 className="explore-empty-title">No events found</h3>
              <p className="explore-empty-text">Try adjusting your filters or search terms</p>
              <button
                className="explore-empty-btn"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedMood("all");
                  setActiveFilters([]);
                  setSelectedDate(null);
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "kivaw-rec-grid" : "events-list-view"}>
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onSave={handleSave}
                  isSaved={savedIds.has(event.id)}
                  view={viewMode}
                  matchScore={event.matchScore}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Sign In CTA */}
        {!isAuthed && !loading && (
          <Card className="explore-signin-card">
            <div className="explore-signin-icon">🎟️</div>
            <h3 className="explore-signin-title">Never miss an event</h3>
            <p className="explore-signin-text">
              Sign in to get personalized event recommendations and save your favorites
            </p>
            <div className="explore-signin-actions">
              <button
                className="explore-signin-btn-primary"
                type="button"
                onClick={() => navigate("/login", { state: { from: "/events" } })}
              >
                Sign in to save events →
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

