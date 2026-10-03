/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = localStorage.getItem("codex-theme");
      if (stored === "dark" || stored === "light") return stored;
      // Check if site config has a dark background
      const siteCfgRaw = localStorage.getItem("codex_site_config");
      if (siteCfgRaw) {
        const parsed = JSON.parse(siteCfgRaw);
        if (parsed.colors?.background) {
          const hex = parsed.colors.background.replace("#", "").trim();
          if (hex.length === 6 || hex.length === 3) {
            const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
            const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
            const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
            const yiq = (r * 299 + g * 587 + b * 114) / 1000;
            return yiq < 135 ? "dark" : "light";
          }
        }
      }
    } catch {}
    return "light";
  });

  const applyThemeToDom = useCallback((newTheme: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    try {
      localStorage.setItem("codex-theme", newTheme);
    } catch {}
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);

    // Also dispatch event so SiteConfigContext or preview listeners can react
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("codex_theme_changed", { detail: { theme: newTheme } }));
    }
  }, [applyThemeToDom]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, [setTheme]);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme, applyThemeToDom]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isDark: theme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

