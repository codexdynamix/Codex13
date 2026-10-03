import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackCurrentVisitor } from "@/lib/visitor-tracker";

export function GlobalVisitorTracker() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  useEffect(() => {
    if (typeof window === "undefined") return;
    void trackCurrentVisitor(pathname);
  }, [pathname]);

  return null;
}
