import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "pill" | "icon" | "nav";
  showLabel?: boolean;
}

export function ThemeToggle({
  className,
  variant = "icon",
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { config, updateLocalConfig } = useSiteConfig();

  const handleToggle = () => {
    const nextTheme = isDark ? "light" : "dark";
    toggleTheme();

    // Also update SiteConfig colors so inline styles immediately adapt
    if (updateLocalConfig) {
      const nextColors = nextTheme === "dark"
        ? {
            ...config.colors,
            background: "#0f1216",
            cardBg: "#181a20",
            textMain: "#eaecef",
            textMuted: "#848e9c",
            border: "#363b44",
            primary: config.colors?.primary || "#f0b90b",
            accent: config.colors?.accent || "#f0b90b",
          }
        : {
            ...config.colors,
            background: "#f5f5f7",
            cardBg: "#ffffff",
            textMain: "#1d1d1f",
            textMuted: "#6e6e73",
            border: "#d2d2d7",
            primary: config.colors?.primary || "#0071e3",
            accent: config.colors?.accent || "#0071e3",
          };

      updateLocalConfig({
        ...config,
        colors: nextColors,
        theme: {
          ...config.theme,
          activeTheme: nextTheme === "dark" ? (config.theme?.activeTheme || "codex-gold") : "titanium-light",
        },
      });
    }
  };

  if (variant === "pill" || showLabel) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "theme-toggle-btn inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all shadow-xs",
          isDark
            ? "border-neutral-700 bg-neutral-800/80 text-amber-300 hover:bg-neutral-800"
            : "border-black/10 bg-white/90 text-neutral-800 hover:bg-white",
          className
        )}
        title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
        aria-label={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      >
        {isDark ? (
          <Sun className="size-3.5 text-amber-400 animate-in spin-in-180 duration-300" />
        ) : (
          <Moon className="size-3.5 text-neutral-700 animate-in spin-in-180 duration-300" />
        )}
        <span className="font-medium">{isDark ? "Light Theme" : "Dark Theme"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "theme-toggle-btn relative flex size-8 sm:size-9 items-center justify-center rounded-full border transition-all shadow-2xs",
        isDark
          ? "border-neutral-700/80 bg-neutral-800/60 text-amber-400 hover:bg-neutral-800 hover:border-amber-400/40 hover:scale-105"
          : "border-black/10 bg-white/80 text-neutral-700 hover:bg-white hover:text-neutral-900 hover:scale-105",
        className
      )}
      title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} theme`}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-neutral-700 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}

