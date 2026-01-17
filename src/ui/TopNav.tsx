import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile } from "../data/profileApi";
import "../styles/nav.css";

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
      nav("/");
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
    <header className="topnav">
      <div className="topnav__inner">
        <button className="brand" onClick={() => nav("/")} aria-label="Go home">
          KIVAW
        </button>

        {/* Desktop nav */}
        <nav className="navlinks navlinks--desktop">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}
          >
            Home
          </NavLink>

          <NavLink
            to="/feed"
            className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}
          >
            Discover
          </NavLink>

          {isSignedIn && (
            <>
              <NavLink
                to="/timeline"
                className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}
              >
                Timeline
              </NavLink>

              <NavLink
                to="/waves"
                className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}
              >
                Waves
              </NavLink>
            </>
          )}
        </nav>

        <div className="topnav__right">
          {isSignedIn && (
            <button
              onClick={() => nav("/profile")}
              type="button"
              className="topnav-profile-btn"
              aria-label="Profile"
              title="Profile"
            >
              {userInitial}
            </button>
          )}
          <button className="nav-cta-btn" onClick={handleAuthClick} type="button">
            {isSignedIn ? "Sign out" : "Continue"}
          </button>

          <button
            onClick={toggle}
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="topnav-theme-toggle"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav className="tabbar">
        <div className="tabbar__item">
          <NavLink to="/" end className="tabbar__btn">
            <span className="tabbar__icon">🏠</span>
            <span className="tabbar__label">Home</span>
          </NavLink>
        </div>

        <div className="tabbar__item">
          <NavLink to="/feed" className="tabbar__btn">
            <span className="tabbar__icon">🔍</span>
            <span className="tabbar__label">Discover</span>
          </NavLink>
        </div>

        {isSignedIn && (
          <>
            <div className="tabbar__item">
              <NavLink to="/timeline" className="tabbar__btn">
                <span className="tabbar__icon">💭</span>
                <span className="tabbar__label">Timeline</span>
              </NavLink>
            </div>

            <div className="tabbar__item">
              <NavLink to="/waves" className="tabbar__btn">
                <span className="tabbar__icon">🌊</span>
                <span className="tabbar__label">Waves</span>
              </NavLink>
            </div>
          </>
        )}
      </nav>
    </header>
  );
}



