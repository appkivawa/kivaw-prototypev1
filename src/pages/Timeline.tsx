// src/pages/Timeline.tsx
// New Timeline page with Explore and Feed tabs
// This replaces the old Timeline concept - now Timeline = Explore + Feed

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StudioExplore from "./StudioExplore";
import StudioFeed from "./StudioFeed";
import "../styles/studio.css";

type ViewMode = "explore" | "feed";

function getStoredViewMode(location: { pathname: string }): ViewMode {
  // Check URL first
  if (location.pathname.includes("feed")) return "feed";
  if (location.pathname.includes("explore")) return "explore";
  // Check localStorage
  try {
    const stored = localStorage.getItem("kivaw_timeline_view_v2");
    if (stored === "explore" || stored === "feed") return stored;
  } catch {
    // ignore
  }
  return "explore"; // default
}

function setStoredViewMode(mode: ViewMode) {
  try {
    localStorage.setItem("kivaw_timeline_view_v2", mode);
  } catch {
    // ignore
  }
}

export default function Timeline() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode(location));

  useEffect(() => {
    // Update URL when view mode changes
    if (viewMode === "explore" && !location.pathname.includes("explore")) {
      navigate("/timeline/explore", { replace: true });
    } else if (viewMode === "feed" && !location.pathname.includes("feed")) {
      navigate("/timeline/feed", { replace: true });
    }
  }, [viewMode, location.pathname, navigate]);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setStoredViewMode(mode);
    if (mode === "explore") {
      navigate("/timeline/explore", { replace: true });
    } else {
      navigate("/timeline/feed", { replace: true });
    }
  }

  return (
    <div className="studio-page" data-theme="light">
      {/* Header with tabs */}
      <div style={{ 
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--studio-white)",
        borderBottom: "1px solid var(--studio-border)",
        paddingTop: "96px", 
        paddingBottom: "24px",
        paddingLeft: "24px",
        paddingRight: "24px",
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        <h1 style={{ 
          fontSize: "32px", 
          fontWeight: 700, 
          marginBottom: "24px",
          color: "var(--studio-text)"
        }}>
          Timeline
        </h1>
        
        {/* Tab navigation */}
        <div className="studio-nav__links" style={{ marginBottom: "0" }}>
          <button
            type="button"
            onClick={() => handleViewModeChange("explore")}
            className={`studio-nav__link ${viewMode === "explore" ? "studio-nav__link--active" : ""}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
            }}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange("feed")}
            className={`studio-nav__link ${viewMode === "feed" ? "studio-nav__link--active" : ""}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
            }}
          >
            Feed
          </button>
        </div>
      </div>

      {/* Content based on view mode - render StudioExplore/StudioFeed without their nav bars */}
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {viewMode === "explore" ? (
          <StudioExplore hideNav={true} />
        ) : (
          <StudioFeed hideNav={true} />
        )}
      </div>
    </div>
  );
}

