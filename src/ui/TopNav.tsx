import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

import logoLight from "../assets/kivaw-logo-light.png";
import logoDark from "../assets/kivaw-logo-dark.png";

export default function TopNav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const logo = theme === "dark" ? logoDark : logoLight;

  return (
    <header className="topnav">
      <div className="topnav__inner">
        <button className="brand" onClick={() => navigate("/")}>
          <img className="brand__logo" src={logo} alt="Kivaw" />
        </button>

        <nav className="navlinks">
          <NavLink to="/" className="navlink">Home</NavLink>
          <NavLink to="/explore" className="navlink">Explore</NavLink>
          <NavLink to="/saved" className="navlink">Saved</NavLink>
        </nav>

        <button className="moon" onClick={toggle}>
          {theme === "dark" ? "☀" : "🌙"}
        </button>
      </div>
    </header>
  );
}



















