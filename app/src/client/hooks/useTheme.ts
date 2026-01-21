import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "tv-screener-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";

  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Remove both classes first to ensure clean state
  root.classList.remove("light", "dark");

  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.add("light");
    root.style.colorScheme = "light";
  }
  root.setAttribute("data-theme", theme);
}

// Apply theme immediately on module load (before React mounts)
if (typeof window !== "undefined") {
  applyTheme(getInitialTheme());
}

/**
 * Hook for managing dark/light theme with persistence.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme
  };
}
