import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { useRoles } from "../auth/useRoles";

type ModeKey = "release" | "build" | "open" | "rest" | "unsure";

type Mode = {
  key: ModeKey;
  name: string;
  emoji: string;
  description: string;
  detailDesc: string;
  examples: string;
};

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthed, loading: sessionLoading } = useSession();
  const { isAdmin, isSuperAdmin, loading: rolesLoading } = useRoles();

  const loading = sessionLoading || rolesLoading;

  // For any admin-only links you may want later (not shown when logged out)
  const showAdminLink = isAuthed && (isAdmin || isSuperAdmin);

  // Progressive disclosure panel
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDetailsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const modes = useMemo<Mode[]>(
    () => [
      {
        key: "release",
        name: "Release",
        emoji: "🔥",
        description: "High energy • Need to expel",
        detailDesc: "High energy • Need to expel",
        examples: "Like: Kickboxing, rage rooms, sports",
      },
      {
        key: "build",
        name: "Build",
        emoji: "🔧",
        description: "High energy • Want direction",
        detailDesc: "High energy • Want direction",
        examples: "Like: Projects, skill-building, challenges, learning",
      },
      {
        key: "open",
        name: "Open",
        emoji: "🌱",
        description: "Moderate energy • Ready to explore",
        detailDesc: "Moderate energy • Ready to explore",
        examples: "Like: New cafés, events, museums, neighborhoods, meetups",
      },
      {
        key: "rest",
        name: "Rest",
        emoji: "⏾",
        description: "Low energy • Need to recharge",
        detailDesc: "Low energy • Need to recharge",
        examples: "Like: Cozy spots, ambient sounds, comfort routines, gentle walks",
      },
      {
        key: "unsure",
        name: "Unsure",
        emoji: "☁️",
        description: "Not sure • Decide for me",
        detailDesc: "Not sure • Decide for me",
        examples: "Like: 3–5 question flow → routes you to the right mode",
      },
    ],
    []
  );

  const howItWorksSteps = useMemo(
    () => [
      {
        number: "1",
        title: "Pick Your Mode",
        description: "Choose Release, Build, Open, Rest — or Unsure.",
      },
      {
        number: "2",
        title: "Get Matched",
        description: "Instant recommendations based on what you actually need.",
      },
      {
        number: "3",
        title: "Explore",
        description: "Browse and save options you’d actually do (wild concept).",
      },
      {
        number: "4",
        title: "Take Action",
        description: "Go do it. Or save it for later and pretend you will. Both valid.",
      },
    ],
    []
  );

  function handleGetStarted() {
    // Keep behavior simple: send them to Explore
    navigate("/explore");
  }

  function handleModeClick(mode: ModeKey) {
    // If you want per-mode filtering later, this is the clean query param:
    // navigate(`/explore?mode=${mode}`);
    // For now, just go to Explore and open panel is optional.
    navigate(`/explore?mode=${mode}`);
  }

  if (loading) {
    return (
      <div className="coral-page-content">
        <div className="coral-section" style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: "#B8B5AD" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="coral-page-content">
      {/* Hero Section - Simple and Clean */}
      <section className="coral-hero-section">
        <h1 className="hero-title">MATCH YOUR ENERGY</h1>
        <p className="coral-subtitle" style={{ fontSize: "clamp(18px, 2.5vw, 22px)", marginBottom: "3rem" }}>
          Recommendations tailored to your state of mind.
        </p>

        {/* CTA Button - Primary Action */}
        <button 
          type="button" 
          onClick={handleGetStarted} 
          className="coral-btn"
          style={{
            background: "var(--coral-gradient)",
            color: "var(--coral-btn-text, white)",
            border: "none",
            padding: "1.3rem 3.5rem",
            fontSize: "1.1rem",
            fontWeight: 600,
            borderRadius: "50px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            marginBottom: "2rem",
            boxShadow: "0 4px 20px rgba(255, 143, 184, 0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 10px 30px rgba(255, 143, 184, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(255, 143, 184, 0.2)";
          }}
        >
          Get Started
        </button>

        {/* Layer 2: Gentle mood preview with hover effects */}
        <div
          className="mood-preview-container"
          style={{
            display: "flex",
            gap: "2rem",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: "3rem",
            opacity: 0.6,
            transition: "opacity 0.3s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
        >
          {modes
            .filter((m) => m.key !== "unsure")
            .map((m) => (
            <div
              key={m.key}
              className="mood-quick-item"
              onClick={() => {
                setDetailsOpen(true);
              }}
              style={{
                cursor: "pointer",
                textAlign: "center",
                userSelect: "none",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLDivElement;
                target.style.transform = "translateY(-5px)";
                const icon = target.querySelector(".mood-icon-quick") as HTMLElement;
                const label = target.querySelector(".mood-label-quick") as HTMLElement;
                if (icon) icon.style.fontSize = "3.5rem";
                if (label) label.style.color = "var(--coral-text-primary)";
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLDivElement;
                target.style.transform = "translateY(0)";
                const icon = target.querySelector(".mood-icon-quick") as HTMLElement;
                const label = target.querySelector(".mood-label-quick") as HTMLElement;
                if (icon) icon.style.fontSize = "3rem";
                if (label) label.style.color = "var(--coral-text-muted)";
              }}
            >
              <div 
                className="mood-icon-quick"
                style={{ 
                  fontSize: "3rem", 
                  marginBottom: "0.5rem",
                  transition: "font-size 0.3s ease",
                }}
              >
                {m.emoji}
              </div>
              <div
                className="mood-label-quick"
                style={{
                  fontFamily: '"Silkscreen", monospace',
                  fontSize: "0.8rem",
                  color: "var(--coral-text-muted)",
                  transition: "color 0.3s ease",
                }}
              >
                {m.name.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* Learn More Button - Subtle */}
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            style={{
              background: "transparent",
              border: "1px solid var(--coral-border)",
              color: "var(--coral-text-muted)",
              padding: "0.8rem 2rem",
              borderRadius: "25px",
              cursor: "pointer",
              fontSize: "0.9rem",
              transition: "all 0.3s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--coral-surface)";
              e.currentTarget.style.color = "var(--coral-text-primary)";
              e.currentTarget.style.borderColor = "var(--coral-border-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--coral-text-muted)";
              e.currentTarget.style.borderColor = "var(--coral-border)";
            }}
          >
            How does this work?
          </button>
        </div>
      </section>

      {/* DETAILS PANEL (Layer 3) - Expandable from bottom */}
      <div
        aria-hidden={!detailsOpen}
        className={`details-panel ${detailsOpen ? "active" : ""}`}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: detailsOpen ? 0 : "-100%",
          background: "var(--coral-detail-panel-bg, rgba(10, 10, 10, 0.98))",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid var(--coral-border)",
          padding: "3rem 1.5rem",
          transition: "bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 1000,
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setDetailsOpen(false)}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1.5rem",
            right: "2rem",
            background: "transparent",
            border: "none",
            color: "var(--coral-text-muted)",
            fontSize: "2rem",
            cursor: "pointer",
            lineHeight: 1,
            transition: "color 0.3s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--coral-text-muted)")}
        >
          ×
        </button>

        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "2rem",
            }}
          >
            {modes.map((m) => (
              <div
                key={m.key}
                className="detail-card-interactive"
                onClick={() => {
                  handleModeClick(m.key);
                  setDetailsOpen(false);
                }}
                style={{
                  cursor: "pointer",
                  background: "var(--coral-detail-card-bg, rgba(255, 255, 255, 0.05))",
                  border: "1px solid var(--coral-border)",
                  borderRadius: "20px",
                  padding: "2rem",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--coral-detail-card-hover, rgba(255, 255, 255, 0.08))";
                  e.currentTarget.style.borderColor = "var(--coral-border-hover)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--coral-detail-card-bg, rgba(255, 255, 255, 0.05))";
                  e.currentTarget.style.borderColor = "var(--coral-border)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div 
                  style={{ 
                    display: "flex", 
                    gap: "1rem", 
                    alignItems: "center", 
                    marginBottom: "1rem" 
                  }}
                >
                  <div style={{ fontSize: "2.5rem" }}>{m.emoji}</div>
                  <div
                    style={{
                      fontFamily: '"Silkscreen", monospace',
                      fontSize: "1.1rem",
                      color: "var(--coral-text-primary)",
                    }}
                  >
                    {m.name.toUpperCase()}
                  </div>
                </div>

                <div 
                  style={{ 
                    color: "var(--coral-text-muted)", 
                    fontSize: "0.95rem", 
                    lineHeight: 1.7,
                    marginBottom: "1rem" 
                  }}
                >
                  {m.detailDesc}
                </div>

                <div 
                  style={{ 
                    color: "#FF8FB8", 
                    fontWeight: 600, 
                    fontSize: "0.85rem" 
                  }}
                >
                  {m.examples}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer - Minimal links */}
      <footer 
        className="coral-footer"
        style={{
          padding: "2rem 3rem",
          display: "flex",
          justifyContent: "center",
          gap: "3rem",
          borderTop: "1px solid var(--coral-border)",
          marginTop: "4rem",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/creator")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--coral-text-muted)",
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "color 0.3s ease",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--coral-text-muted)")}
        >
          Creator
        </button>
        <button
          type="button"
          onClick={() => navigate("/team")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--coral-text-muted)",
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "color 0.3s ease",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--coral-text-muted)")}
        >
          Team
        </button>
        <button
          type="button"
          onClick={() => navigate("/login")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--coral-text-muted)",
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "color 0.3s ease",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--coral-text-muted)")}
        >
          Login
        </button>
      </footer>

      {/* Optional: if you want an admin shortcut while authed, put it here (NOT in the logged-out footer) */}
      {showAdminLink ? null : null}
    </div>
  );
}

