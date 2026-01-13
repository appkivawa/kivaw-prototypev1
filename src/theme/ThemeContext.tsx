import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);
const STORAGE_KEY = "kivaw_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check for saved preference first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    
    // Otherwise, respect system preference
    if (typeof window !== "undefined" && window.matchMedia) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    }
    
    // Default to light if no system preference available
    return "light";
  });

  useEffect(() => {
    // Set immediately to prevent flash
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system preference changes (only if no manual preference is set)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const saved = localStorage.getItem(STORAGE_KEY);
    
    // Only auto-update if user hasn't manually set a preference
    if (!saved) {
      const handleChange = (e: MediaQueryListEvent) => {
        setThemeState(e.matches ? "dark" : "light");
      };
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
      // Legacy browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, []);

  const toggle = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  const setTheme = (t: Theme) => setThemeState(t);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

