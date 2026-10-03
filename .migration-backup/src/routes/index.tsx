import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteCanvas } from "@/components/SiteCanvas";
import { SiteChrome } from "@/components/SiteChrome";
import { SEO } from "@/components/SEO";
import { trackCurrentVisitor } from "@/lib/visitor-tracker";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const isEmbeddedPreview =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      window.location.search.includes("preview=1") ||
      sessionStorage.getItem("codex_is_preview") === "true");

  const previewPage =
    typeof window !== "undefined" && window.location.search.includes("page=")
      ? (new URLSearchParams(window.location.search).get("page") as any) || "home"
      : "home";

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isEmbeddedPreview) {
        return;
      }

      const onAdmin =
        sessionStorage.getItem("codex_on_admin") === "true" ||
        localStorage.getItem("codex_on_admin") === "true";
      const returnToPublic = sessionStorage.getItem("codex_return_to_public") === "true";

      const navEntry = (performance.getEntriesByType?.("navigation")?.[0] as
        | PerformanceNavigationTiming
        | undefined);
      const isBack = navEntry?.type === "back_forward";

      if (onAdmin && !returnToPublic && !isBack) {
        const lastTab =
          sessionStorage.getItem("codex_admin_active_tab") ||
          localStorage.getItem("codex_admin_active_tab");
        const target = lastTab ? `/admin?tab=${encodeURIComponent(lastTab)}` : "/admin";
        window.location.replace(target);
        return;
      }

      if (returnToPublic || isBack) {
        sessionStorage.removeItem("codex_return_to_public");
        sessionStorage.removeItem("codex_on_admin");
        localStorage.removeItem("codex_on_admin");
      }
    }
    void trackCurrentVisitor(window.location.pathname);
  }, [isEmbeddedPreview]);

  return (
    <SiteCanvas preview={isEmbeddedPreview}>
      <SEO
        title="High-Performance Websites & Digital Agency"
        description="High-performance websites, custom web apps, CRM calling systems, and high-ROAS marketing campaigns. Precision quality on every screen."
        ogType="website"
        keywords={["web design", "web development", "digital agency", "custom CRM", "e-commerce", "high-performance websites"]}
      />
      <SiteChrome page={previewPage} />
    </SiteCanvas>
  );
}
