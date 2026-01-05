import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserId } from "../data/savesApi";
import { requireAuth } from "../auth/requireAuth";
import { fetchAllEvents, type EventFilters, type Event } from "../data/eventsApi";
import PageHeader from "../ui/PageHeader";

type MoodFilter = "all" | "destructive" | "expansive" | "minimize" | "blank";

const MOOD_CONFIG: Record<MoodFilter, { emoji: string; label: string; desc?: string }> = {
  all: { emoji: "✨", label: "All Events" },
  destructive: { emoji: "🔥", label: "Destructive", desc: "High energy, intense" },
  expansive: { emoji: "🌱", label: "Expansive", desc: "Growth, learning" },
  minimize: { emoji: "🎋", label: "Minimize", desc: "Calm, simple" },
  blank: { emoji: "🌙", label: "Blank", desc: "Chill, social" },
};

export default function Events() {
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedMood, setSelectedMood] = useState<MoodFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

      return matchesMood && matchesSearch;
    });
  }, [events, selectedMood, searchQuery]);

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


  return (
    <div className="page">
      <PageHeader 
        title="Events" 
        subtitle="Find experiences that match your mood" 
        icon="📅"
      />

      <div className="center-wrap">
        {/* Recommended Section */}
        {recommendedEvents.length > 0 && !loading && (
          <div className="events-recommended-section">
            <h2>
              <span className="events-recommended-icon">✨</span>
              Recommended for You
            </h2>
            <p>Based on your activity patterns and preferences</p>
            <div className="events-grid">
              {recommendedEvents.map((event) => (
                <div
                  key={event.id}
                  className="events-event-card"
                  onClick={() => window.open(event.url || "#", "_blank")}
                >
                  <div className="events-event-icon">{event.emoji}</div>
                  <div className="events-match-score">{event.matchScore}% match</div>
                  <div className="events-event-title">{event.title}</div>
                  <div className="events-event-meta">📅 {event.date.full}</div>
                  <div className="events-event-meta">📍 {event.location}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="events-search-section">
          <input
            type="text"
            className="events-search-input"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="events-mood-filters">
            {(Object.keys(MOOD_CONFIG) as MoodFilter[]).map((mood) => {
              const config = MOOD_CONFIG[mood];
              return (
                <button
                  key={mood}
                  className={`events-mood-btn ${selectedMood === mood ? "events-mood-btn-active" : ""}`}
                  type="button"
                  onClick={() => setSelectedMood(mood)}
                >
                  {config.emoji} {config.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="events-card">
            <p className="muted">Loading events…</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="events-card">
            <div className="events-empty-icon">🔍</div>
            <h3 className="events-empty-title">No events found</h3>
            <p className="events-empty-text">Try adjusting your filters or search terms</p>
            <button
              className="events-empty-btn"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedMood("all");
              }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="events-event-card"
                onClick={() => window.open(event.url || "#", "_blank")}
              >
                <div className="events-event-header">
                  <div>
                    <div className="events-event-icon">{event.emoji}</div>
                  </div>
                  <button
                    className={`events-heart-btn ${savedIds.has(event.id) ? "events-heart-saved" : ""}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave(event.id);
                    }}
                    aria-label={savedIds.has(event.id) ? "Unsave" : "Save"}
                  >
                    {savedIds.has(event.id) ? "♥" : "♡"}
                  </button>
                </div>
                {event.matchScore && (
                  <div className="events-match-score">{event.matchScore}% match</div>
                )}
                <div className="events-event-title">{event.title}</div>
                <div className="events-event-meta">📅 {event.date.full}</div>
                <div className="events-event-meta">📍 {event.location}</div>
              </div>
            ))}
          </div>
        )}

        {!isAuthed && !loading && (
          <div className="events-card">
            <p className="muted" style={{ margin: 0 }}>
              Want to save events? Sign in to heart them.
            </p>
            <button
              className="events-signin-btn"
              type="button"
              onClick={() => navigate("/login", { state: { from: "/events" } })}
            >
              Sign in →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

