import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
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
  const { toggleTheme, isDark } = useTheme();

  if (variant === "pill" || showLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          "theme-toggle-btn inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className
        )}
        title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
        aria-label={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      >
        {isDark ? (
          <Sun className="size-3.5 text-current" />
        ) : (
          <Moon className="size-3.5 text-current" />
        )}
        <span className="font-medium">{isDark ? "Light Theme" : "Dark Theme"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "theme-toggle-btn relative flex size-8 sm:size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
      title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} theme`}
    >
      {isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}

