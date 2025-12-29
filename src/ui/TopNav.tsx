import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

export default function TopNav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="topnav">
      <div className="topnav__inner">
        <button className="brand" onClick={() => navigate("/")}>
          <span className="brand__name">kivaw</span>
        </button>

        <nav className="navlinks">
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
    </header>
  );
}

