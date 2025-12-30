import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

import markLight from "../assets/kivaw-mark-light.svg";
import markDark from "../assets/kivaw-mark-dark.svg";

export default function TopNav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const markSrc = theme === "dark" ? markDark : markLight;

  return (
    <header className="topnav">
      <div className="topnav__inner">
        <button className="brand" onClick={() => navigate("/")} aria-label="Go home">
          <img className="brand__mark" src={markSrc} alt="KIVAW" />
        </button>

        <nav className="navlinks" aria-label="Primary">
          <NavLink to="/" className={({ isActive }) => `navlink ${isActive ? "is-active" : ""}`}>
            Home
          </NavLink>
          <NavLink to="/explore" className={({ isActive }) => `navlink ${isActive ? "is-active" : ""}`}>
            Explore
          </NavLink>
          <NavLink to="/saved" className={({ isActive }) => `navlink ${isActive ? "is-active" : ""}`}>
            Saved
          </NavLink>
        </nav>

        <button className="moon" onClick={toggle} aria-label="Toggle theme">
          {theme === "light" ? "🌙" : "☾"}
        </button>
      </div>

      <div className="topnav__divider" />
    </header>
  );
}










