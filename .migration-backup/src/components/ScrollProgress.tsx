import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollProgressProps {
  /** Optional custom CSS classes */
  className?: string;
  /** Optional target container ref if measuring a scrollable modal or element */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Height in pixels or Tailwind height class (default: h-1) */
  height?: string;
  /** Color of the progress indicator (default: primary brand blue) */
  color?: string;
}

/**
 * ScrollProgress displays a reactive, smooth progress bar at the top of the viewport
 * (or container) as the user scrolls through long-form content, optimizing readability
 * and reading orientation on mobile and desktop devices.
 */
export function ScrollProgress({
  className,
  targetRef,
  height = "h-1",
  color = "bg-blue",
}: ScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // If a specific scrollable element is targeted (like a modal or card)
    if (targetRef?.current) {
      const el = targetRef.current;
      const handleScroll = () => {
        const scrollTop = el.scrollTop;
        const scrollHeight = el.scrollHeight - el.clientHeight;
        if (scrollHeight > 0) {
          const ratio = Math.min(1, Math.max(0, scrollTop / scrollHeight));
          setProgress(ratio * 100);
        } else {
          setProgress(0);
        }
      };

      el.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      return () => el.removeEventListener("scroll", handleScroll);
    }

    // Window scroll handler (entire viewport for long-form blog articles)
    const handleWindowScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight > 0) {
        const ratio = Math.min(1, Math.max(0, scrollTop / docHeight));
        setProgress(ratio * 100);
      } else {
        setProgress(0);
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    handleWindowScroll();

    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [targetRef]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-0 left-0 right-0 z-[100] w-full bg-transparent",
        className
      )}
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-1 origin-left transition-[transform,width] duration-75 ease-out shadow-xs",
          height,
          color
        )}
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  );
}
