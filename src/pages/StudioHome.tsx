// src/pages/StudioHome.tsx
// New homepage matching the "Yav Studio Home" design mockup
// This file can be used alongside existing pages for testing

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import "../styles/studio.css";

// Signal types that users can toggle
const SIGNALS = [
  { key: "news", label: "News", sub: "Long-form only", icon: "📰" },
  { key: "social", label: "Social", sub: "Threads, not noise", icon: "💬" },
  { key: "podcasts", label: "Podcasts", sub: "Weekly picks", icon: "🎧" },
  { key: "video", label: "Music + Video", sub: "Background only", icon: "🎵" },
];

// Quick filter tags
const QUICK_TAGS = [
  { label: "All signals · one studio", active: true },
  { label: "News", active: false },
  { label: "Social", active: false },
  { label: "Podcasts", active: false },
  { label: "Music", active: false },
  { label: "Video", active: false },
];

export default function StudioHome() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [activeSignals, setActiveSignals] = useState<string[]>(["podcasts"]);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsSignedIn(!!data.session);
    });
  }, []);

  function toggleSignal(key: string) {
    setActiveSignals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleGetStarted() {
    if (isSignedIn) {
      navigate("/studio/feed");
    } else {
      navigate("/login", { state: { from: "/studio/feed" } });
    }
  }

  return (
    <div className="studio-page">
      {/* Navigation */}
      <nav className="studio-nav">
        <div className="studio-nav__inner">
          <button 
            className="studio-nav__brand" 
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <span className="studio-nav__brand-icon">K</span>
            <span>KIVAW</span>
          </button>

          <div className="studio-nav__links">
            <button 
              className="studio-nav__link studio-nav__link--active"
              onClick={() => navigate("/")}
            >
              Home
            </button>
            <button 
              className="studio-nav__link"
              onClick={() => navigate("/studio/explore")}
            >
              Discover
            </button>
            <button 
              className="studio-nav__link"
              onClick={() => navigate("/studio/feed")}
            >
              Feed
            </button>
          </div>

          <div className="studio-nav__actions">
            <button 
              className="studio-nav__link-text"
              onClick={() => navigate("/guide")}
            >
              How it works
            </button>
            <button 
              className="studio-btn studio-btn--primary"
              onClick={handleGetStarted}
            >
              {isSignedIn ? "Go to Feed" : "Continue"}
            </button>
            <button
              className="studio-btn studio-btn--ghost"
              onClick={toggle}
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="studio-hero">
        {/* Left: Main content */}
        <div>
          <div className="studio-hero__label">STUDIO MEDIA FEED</div>
          
          <h1 className="studio-hero__title">
            Match your{" "}
            <span className="studio-hero__title-highlight">signal</span>
            <br />
            not the noise.
          </h1>

          <p className="studio-hero__desc">
            A quiet, clean home for the news, socials, podcasts, music and videos 
            that actually fit your headspace.
          </p>

          <div className="studio-hero__actions">
            <button 
              className="studio-btn studio-btn--primary"
              onClick={handleGetStarted}
            >
              Get started
            </button>
            <button 
              className="studio-btn studio-btn--secondary"
              onClick={() => navigate("/studio/explore")}
            >
              See a sample feed
            </button>
          </div>

          <div className="studio-hero__tags">
            {QUICK_TAGS.map((tag) => (
              <span
                key={tag.label}
                className={`studio-hero__tag ${tag.active ? "studio-hero__tag--active" : ""}`}
              >
                {tag.label}
              </span>
            ))}
          </div>

          <div className="studio-hero__footer">
            Built for people who want a calm, studio-grade view of their media universe.
          </div>
        </div>

        {/* Right: Tune your mix card */}
        <div className="studio-mix-card">
          <div className="studio-mix-card__header">
            <h2 className="studio-mix-card__title">Tune your mix</h2>
            <span className="studio-mix-card__profile">Profile: Deep work</span>
          </div>

          <p className="studio-mix-card__desc">
            Tell us what you care about. We do the quiet curation.
          </p>

          <div className="studio-mix-card__signals">
            {SIGNALS.map((signal) => (
              <button
                key={signal.key}
                className={`studio-signal ${activeSignals.includes(signal.key) ? "studio-signal--active" : ""}`}
                onClick={() => toggleSignal(signal.key)}
              >
                <span className="studio-signal__icon">{signal.icon}</span>
                <span className="studio-signal__label">{signal.label}</span>
                <span className="studio-signal__sub">{signal.sub}</span>
              </button>
            ))}
          </div>

          <div className="studio-mix-card__footer">
            <span className="studio-mix-card__hint">
              We surface what matches your energy across the last 48 hours.
            </span>
            <button 
              className="studio-mix-card__preview"
              onClick={() => navigate("/studio/explore")}
            >
              ▶ Preview echo
            </button>
          </div>
        </div>
      </main>

      {/* Bottom feature tags */}
      <div style={{ 
        maxWidth: "1000px", 
        margin: "0 auto", 
        padding: "0 24px 80px",
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px"
      }}>
        <span className="studio-hero__tag">No infinite scroll</span>
        <span className="studio-hero__tag">No autoplay</span>
        <span className="studio-hero__tag">Signals only</span>
      </div>
    </div>
  );
}
