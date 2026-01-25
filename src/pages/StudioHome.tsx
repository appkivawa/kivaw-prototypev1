// src/pages/studio/StudioHome.tsx
// New Studio landing page - "Match your signal, not the noise"

import { useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { useSession } from "../auth/useSession";

import "../styles/studio.css";

type SignalKey = "news" | "social" | "podcasts" | "video";

const SIGNALS: { key: SignalKey; icon: string; label: string; sub: string }[] = [
  { key: "news", icon: "📰", label: "News", sub: "Long-form only" },
  { key: "social", icon: "💬", label: "Social", sub: "Threads, not noise" },
  { key: "podcasts", icon: "🎧", label: "Podcasts", sub: "Weekly picks" },
  { key: "video", icon: "🎵", label: "Music + Video", sub: "Background only" },
];

const FEATURES = ["No infinite scroll", "No autoplay", "Signals only"];

const TAGS = ["All signals · one studio", "News", "Social", "Podcasts", "Music", "Video"];

export default function StudioHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { session } = useSession();
  const isSignedIn = !!session;

  const [activeSignals, setActiveSignals] = useState<SignalKey[]>(["podcasts"]);

  const toggleSignal = (key: SignalKey) => {
    setActiveSignals((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleGetStarted = () => {
    if (isSignedIn) navigate("/timeline/feed");
    else navigate("/login", { state: { from: "/timeline/feed" } });
  };

  const handleSampleFeed = () => navigate("/timeline/explore");

  return (
    <div className="studio-page" data-theme="light">
      <nav className="studio-nav">
        <div className="studio-nav__inner">
          <button className="studio-nav__brand" onClick={() => navigate("/studio")}>
            <span className="studio-nav__brand-icon">K</span>
            KIVAW
          </button>

          <div className="studio-nav__links">
            <NavLink
              to="/studio"
              className={({ isActive }) => `studio-nav__link ${isActive ? "studio-nav__link--active" : ""}`}
            >
              Home
            </NavLink>

            <NavLink
              to="/timeline"
              className={({ isActive }) => `studio-nav__link ${isActive || location.pathname.includes("/timeline/") ? "studio-nav__link--active" : ""}`}
            >
              Timeline
            </NavLink>

            <NavLink
              to="/collection"
              className={({ isActive }) => `studio-nav__link ${isActive ? "studio-nav__link--active" : ""}`}
            >
              Collection
            </NavLink>
          </div>

          <div className="studio-nav__actions">
            <button className="studio-nav__link-text" type="button">
              How it works
            </button>
            <button className="studio-btn studio-btn--primary" onClick={handleGetStarted} type="button">
              {isSignedIn ? "Go to Feed" : "Get started"}
            </button>
            <button
              className="studio-theme-toggle"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>

      <div className="studio-hero">
        <div className="studio-hero__main">
          <h1 className="studio-hero__title">
            Match your <span className="studio-hero__title-highlight">signal</span> not the noise.
          </h1>

          <p className="studio-hero__desc">
            A quiet, clean home for the news, socials, podcasts, music and videos that actually fit your headspace.
          </p>

          <div className="studio-hero__actions">
            <button className="studio-btn studio-btn--primary" onClick={handleGetStarted} type="button">
              Get started
            </button>
            <button className="studio-btn studio-btn--secondary" onClick={handleSampleFeed} type="button">
              See a sample feed
            </button>
          </div>

          <div className="studio-hero__tags">
            {TAGS.map((tag, i) => (
              <button
                key={tag}
                type="button"
                className={`studio-hero__tag ${i === 0 ? "studio-hero__tag--active" : ""}`}
                onClick={() => {
                  if (tag !== "All signals · one studio") {
                    navigate("/timeline/explore");
                  }
                }}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="studio-hero__footer">
            <p>Built for people who want a calm, studio-grade view of their media universe.</p>
            <div className="studio-hero__features">
              {FEATURES.map((feature) => (
                <span key={feature} className="studio-hero__feature">
                  <span style={{ color: "var(--studio-coral)", marginRight: "6px" }}>✓</span>
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="studio-mix-card">
          <div className="studio-mix-card__header">
            <h2 className="studio-mix-card__title">Tune your mix</h2>
            <span className="studio-mix-card__profile">Profile: Deep work</span>
          </div>

          <p className="studio-mix-card__desc">Tell us what you care about. We do the quiet curation.</p>

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
            <span className="studio-mix-card__hint">We surface what matches your energy across the last 48 hours.</span>
            <button className="studio-mix-card__preview" onClick={handleSampleFeed} type="button">
              ► Preview echo
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
