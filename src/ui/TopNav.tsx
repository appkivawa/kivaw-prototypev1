import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import logo from "../assets/kivaw-logo-light.png";

export default function TopNav() {
  const nav = useNavigate();
  const { theme, toggle } = useTheme();

  return (
    <header className="topnav">
      <div className="topnav__inner">
        <button
          className="brand"
          onClick={() => nav("/")}
          aria-label="Go home"
        >
          <img src={logo} alt="Kivaw" className="brand__logo" />
        </button>

        <nav className="navlinks navlinks--desktop">
          <NavLink to="/" end className="navlink">Home</NavLink>
          <NavLink to="/explore" className="navlink">Explore</NavLink>
          <NavLink to="/waves" className="navlink">Waves</NavLink>
          <NavLink to="/echo" className="navlink">Echo</NavLink>
          <NavLink to="/events" className="navlink">Events</NavLink>
          <NavLink to="/saved" className="navlink">Saved</NavLink>
        </nav>

        <div className="topnav__right">
          <div className="nav-auth">
            <button className="nav-cta" onClick={() => nav("/explore")}>
              Continue
            </button>
            <button
              className="moon"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
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
          <NavLink to="/explore" className="tabbar__btn">
            <span className="tabbar__icon">🧭</span>
            <span className="tabbar__label">Explore</span>
          </NavLink>
        </div>
        <div className="tabbar__item">
          <NavLink to="/waves" className="tabbar__btn">
            <span className="tabbar__icon">🌊</span>
            <span className="tabbar__label">Waves</span>
          </NavLink>
        </div>
        <div className="tabbar__item">
          <NavLink to="/echo" className="tabbar__btn">
            <span className="tabbar__icon">💬</span>
            <span className="tabbar__label">Echo</span>
          </NavLink>
        </div>
        <div className="tabbar__item">
          <NavLink to="/events" className="tabbar__btn">
            <span className="tabbar__icon">📅</span>
            <span className="tabbar__label">Events</span>
          </NavLink>
        </div>
        <div className="tabbar__item">
          <NavLink to="/saved" className="tabbar__btn">
            <span className="tabbar__icon">♥</span>
            <span className="tabbar__label">Saved</span>
          </NavLink>
        </div>
      </nav>
    </header>
  );
}





































