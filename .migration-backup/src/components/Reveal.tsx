import { type ReactNode, type ElementType, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

export type RevealDirection = "up" | "down" | "left" | "right" | "fade" | "scale" | "none";

export interface RevealProps<T extends ElementType = "div"> {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: RevealDirection;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  as?: T;
}

export function Reveal<T extends ElementType = "div">({
  children,
  className,
  delay = 0,
  duration = 650,
  direction = "up",
  threshold = 0.12,
  rootMargin = "0px 0px -40px 0px",
  once = true,
  as,
  ...props
}: RevealProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof RevealProps<T>>) {
  const Component = as || "div";

  const [ref, isIntersecting] = useIntersectionObserver<HTMLDivElement>({
    threshold,
    rootMargin,
    triggerOnce: once,
  });

  const getDirectionClass = () => {
    switch (direction) {
      case "fade":
        return "reveal-fade";
      case "scale":
        return "reveal-scale";
      case "left":
        return "reveal-left";
      case "right":
        return "reveal-right";
      case "down":
        return "reveal-down";
      case "none":
        return "";
      case "up":
      default:
        return "reveal";
    }
  };

  const directionClass = getDirectionClass();

  return (
    <Component
      ref={ref as unknown as React.Ref<never>}
      className={cn(
        directionClass,
        isIntersecting && "reveal-in",
        className
      )}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * SectionReveal: Specialized scroll-triggered entrance wrapper for major page sections.
 * Automatically wraps section content with intersection observation and subtle upward easing.
 */
export function SectionReveal({
  children,
  className,
  delay = 0,
  direction = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: RevealDirection;
}) {
  return (
    <Reveal
      direction={direction}
      delay={delay}
      threshold={0.08}
      rootMargin="0px 0px -60px 0px"
      className={cn("w-full", className)}
    >
      {children}
    </Reveal>
  );
}
