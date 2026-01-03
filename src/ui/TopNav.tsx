import { useEffect, useState } from "react";
import type { SVGProps } from "react";

import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../lib/supabaseClient";

import logoLight from "../assets/kivaw-logo-light.png";
import logoDark from "../assets/kivaw-logo-dark.png";

/* Icons */
function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function IconBookmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 4h12v18l-6-4-6 4V4z" />
    </svg>
  );
}

function IconWaves(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 10c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
      <path d="M2 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
    </svg>
  );
}

function IconEcho(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.5 8.5 0 1 1-4.1-7.2" />
      <path d="M22 4v6h-6" />
    </svg>
  );
}

function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 13.2A8 8 0 1 1 10.8 3a6.5 6.5 0 0 0 10.2 10.2z" />
    </svg>
  );
}

function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  );
}

function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

export default function TopNav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const logo = theme === "dark" ? logoDark : logoLight;

  const [isAuthed, setIsAuthed] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setIsAuthed(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setIsAuthed(!!session);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  function goLogin() {
    // ✅ preserve the exact page (including admin)
    navigate("/login", { state: { from: location.pathname } });
  }

  async function onSignOut(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();

    if (authBusy) return;
    setAuthBusy(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Sign out error:", error);
    } finally {
      // ✅ wipe cached auth + force clean UI
      try {
        localStorage.removeItem("supabase.auth.token");
        sessionStorage.clear();
      } catch {}

      // Hard redirect ensures NO stale authed UI
      window.location.href = "/";
    }
  }

  function onAccountTap(e: React.MouseEvent) {
    if (isAuthed) onSignOut(e);
    else {
      e.preventDefault();
      e.stopPropagation();
      goLogin();
    }
  }

  return (
    <>
      <header className="topnav">
        <div className="topnav__inner">
          <button className="brand" onClick={() => navigate("/")} type="button">
            <img className="brand__logo" src={logo} alt="Kivaw" />
          </button>

          <nav className="navlinks navlinks--desktop">
            <NavLink to="/" className="navlink" end>
              Home
            </NavLink>
            <NavLink to="/explore" className="navlink">
              Explore
            </NavLink>
            <NavLink to="/waves" className="navlink">
              Waves
            </NavLink>
            <NavLink to="/echo" className="navlink">
              Echo
            </NavLink>
            <NavLink to="/saved" className="navlink">
              Saved
            </NavLink>
          </nav>

          <div className="topnav__right">
            <div className="nav-auth">
              {!isAuthed ? (
                <button type="button" className="nav-cta" onClick={goLogin}>
                  Continue
                </button>
              ) : (
                <button type="button" className="nav-ghost" onClick={(e) => onSignOut(e)} disabled={authBusy}>
                  {authBusy ? "Signing out…" : "Sign out"}
                </button>
              )}
            </div>

            <button
              className="moon"
              onClick={toggle}
              aria-label="Toggle theme"
              type="button"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav className="tabbar" aria-label="Bottom navigation">
        <NavLink to="/" className="tabbar__item" end>
          <IconHome className="tabbar__icon" />
          <span className="tabbar__label">Home</span>
        </NavLink>

        <NavLink to="/explore" className="tabbar__item">
          <IconSearch className="tabbar__icon" />
          <span className="tabbar__label">Explore</span>
        </NavLink>

        <NavLink to="/waves" className="tabbar__item">
          <IconWaves className="tabbar__icon" />
          <span className="tabbar__label">Waves</span>
        </NavLink>

        <NavLink to="/echo" className="tabbar__item">
          <IconEcho className="tabbar__icon" />
          <span className="tabbar__label">Echo</span>
        </NavLink>

        <NavLink to="/saved" className="tabbar__item">
          <IconBookmark className="tabbar__icon" />
          <span className="tabbar__label">Saved</span>
        </NavLink>

        <button className="tabbar__item tabbar__btn" onClick={onAccountTap} type="button" disabled={authBusy}>
          <IconUser className="tabbar__icon" />
          <span className="tabbar__label">{isAuthed ? "Sign out" : "Continue"}</span>
        </button>

        <button className="tabbar__item tabbar__btn" onClick={toggle} type="button">
          {theme === "dark" ? <IconSun className="tabbar__icon" /> : <IconMoon className="tabbar__icon" />}
          <span className="tabbar__label">Theme</span>
        </button>
      </nav>
    </>
  );
}






























