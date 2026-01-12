import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";

export default function TopNav() {
  const nav = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsSignedIn(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    <header className="topnav coral-header">
      <div className="topnav__inner coral-nav">
        <button className="brand coral-brand" onClick={() => nav("/")} aria-label="Go home">
          KIVAW
        </button>

        {/* Desktop nav */}
        <nav className="navlinks navlinks--desktop coral-nav-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `navlink coral-nav-link ${isActive ? "active" : ""}`}
          >
            Home
          </NavLink>

          <NavLink
            to="/feed"
            className={({ isActive }) => `navlink coral-nav-link ${isActive ? "active" : ""}`}
          >
            Discover
          </NavLink>

          {isSignedIn && (
            <>
              <NavLink
                to="/timeline"
                className={({ isActive }) => `navlink coral-nav-link ${isActive ? "active" : ""}`}
              >
                Timeline
              </NavLink>

              <NavLink
                to="/waves"
                className={({ isActive }) => `navlink coral-nav-link ${isActive ? "active" : ""}`}
              >
                Waves
              </NavLink>
            </>
          )}
        </nav>

        <div className="topnav__right">
          <button className="nav-cta-btn coral-nav-cta" onClick={handleAuthClick} type="button">
            {isSignedIn ? "Sign out" : "Continue"}
          </button>

          <button className="moon coral-theme-toggle" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
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



