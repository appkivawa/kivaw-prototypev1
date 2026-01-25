import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile } from "../data/profileApi";
import "../styles/studio.css";

export default function TopNav() {
  const nav = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInitial, setUserInitial] = useState<string>("?");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsSignedIn(!!data.session);
      if (data.session?.user) {
        setUserEmail(data.session.user.email || null);
        // Get initial from email (first letter)
        const email = data.session.user.email || "";
        setUserInitial(email.charAt(0).toUpperCase() || "?");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
      if (session?.user) {
        setUserEmail(session.user.email || null);
        const email = session.user.email || "";
        setUserInitial(email.charAt(0).toUpperCase() || "?");
      } else {
        setUserEmail(null);
        setUserInitial("?");
      }
    });

    // Try to get profile for better initial (if username exists)
    if (isSignedIn) {
      getMyProfile()
        .then((profile) => {
          if (profile?.email) {
            setUserEmail(profile.email);
            setUserInitial(profile.email.charAt(0).toUpperCase() || "?");
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }

    return () => subscription.unsubscribe();
  }, [isSignedIn]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      nav("/studio");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  function handleAuthClick() {
    if (isSignedIn) {
      handleSignOut();
    } else {
      nav("/login", { state: { from: location.pathname } });
    }
  }

  return (
    <header className="studio-nav">
      <div className="studio-nav__inner">
        <button 
          className="studio-nav__brand" 
          onClick={() => nav("/studio")} 
          aria-label="Go home"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          <span className="studio-nav__brand-icon">K</span>
          <span>KIVAW</span>
        </button>

        {/* Desktop nav - Pill style */}
        <nav className="studio-nav__links">
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
        </nav>

        <div className="studio-nav__actions">
          <button className="studio-nav__link-text" type="button">
            How it works
          </button>
          {isSignedIn && (
            <button
              onClick={() => nav("/profile")}
              type="button"
              aria-label="Profile"
              title="Profile"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "1px solid var(--studio-border)",
                background: "var(--studio-white)",
                color: "var(--studio-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              {userInitial}
            </button>
          )}
          <button 
            onClick={handleAuthClick} 
            type="button"
            className="studio-btn studio-btn--primary"
          >
            {isSignedIn ? "Sign out" : "Go to Feed"}
          </button>
          <button
            onClick={toggle}
            type="button"
            className="studio-theme-toggle"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav className="mobile-nav" style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 0,
        borderTop: "1px solid var(--studio-border)",
        background: "var(--studio-white)",
        padding: "8px 0",
        position: "sticky",
        bottom: 0,
        zIndex: 50,
      }}>
        <NavLink 
          to="/studio" 
          className={({ isActive }) => isActive ? "mobile-nav__link--active" : ""}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            color: "var(--studio-text-muted)",
            textDecoration: "none",
            fontSize: "11px",
            fontWeight: 400,
            cursor: "pointer",
            width: "100%",
            borderRadius: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text)";
              e.currentTarget.style.background = "var(--studio-gray-50)";
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text-muted)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>🏠</span>
          <span style={{ fontSize: "11px", lineHeight: 1.2 }}>Home</span>
        </NavLink>

        <NavLink 
          to="/timeline" 
          className={({ isActive }) => isActive || location.pathname.includes("/timeline/") ? "mobile-nav__link--active" : ""}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            color: "var(--studio-text-muted)",
            textDecoration: "none",
            fontSize: "11px",
            fontWeight: 400,
            cursor: "pointer",
            width: "100%",
            borderRadius: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text)";
              e.currentTarget.style.background = "var(--studio-gray-50)";
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text-muted)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>📅</span>
          <span style={{ fontSize: "11px", lineHeight: 1.2 }}>Timeline</span>
        </NavLink>

        <NavLink 
          to="/collection" 
          className={({ isActive }) => isActive ? "mobile-nav__link--active" : ""}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            color: "var(--studio-text-muted)",
            textDecoration: "none",
            fontSize: "11px",
            fontWeight: 400,
            cursor: "pointer",
            width: "100%",
            borderRadius: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text)";
              e.currentTarget.style.background = "var(--studio-gray-50)";
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text-muted)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>📅</span>
          <span style={{ fontSize: "11px", lineHeight: 1.2 }}>Timeline</span>
        </NavLink>

        <NavLink 
          to="/collection" 
          className={({ isActive }) => isActive ? "mobile-nav__link--active" : ""}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            color: "var(--studio-text-muted)",
            textDecoration: "none",
            fontSize: "11px",
            fontWeight: 400,
            cursor: "pointer",
            width: "100%",
            borderRadius: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text)";
              e.currentTarget.style.background = "var(--studio-gray-50)";
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.classList.contains("mobile-nav__link--active")) {
              e.currentTarget.style.color = "var(--studio-text-muted)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>📚</span>
          <span style={{ fontSize: "11px", lineHeight: 1.2 }}>Collection</span>
        </NavLink>
      </nav>
    </header>
  );
}



