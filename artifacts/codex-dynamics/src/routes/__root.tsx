import { lazy, Suspense, useEffect, useState } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { MemoryRouter, Route as ReactRouterRoute, Routes } from "react-router-dom";
import { SiteConfigProvider } from "@/context/SiteConfigContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ContactModalProvider } from "@/context/ContactModalContext";
import { LoginViewProvider } from "@/context/LoginViewContext";
import { Toaster } from "sonner";
import { TidioWidget } from "@/components/TidioWidget";
import { GlobalVisitorTracker } from "@/components/GlobalVisitorTracker";

const CodexDynamicsAdminApp = lazy(() => import("@/crm/admin-app/App.jsx"));
const ClientPortalApp = lazy(() => import("@/portal/ClientPortalApp").then(m => ({ default: m.ClientPortalApp })));

function RouteLoadingScreen({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen w-full bg-[#0E1116] text-[#F5F5F7] flex flex-col items-center justify-center gap-3 select-none"
    >
      <div className="size-8 rounded-full border-2 border-white/10 border-t-[#0071E3] animate-spin" />
      <span className="text-xs font-medium tracking-wide text-neutral-400">{label}</span>
    </div>
  );
}

export function RootShell() {
  const [currentPathname, setCurrentPathname] = useState(() => {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);

    // Preload portal and CRM bundles in the background so transitions are instantaneous
    if (typeof window !== "undefined") {
      const preload = () => {
        import("@/crm/admin-app/App.jsx");
        import("@/portal/ClientPortalApp");
      };
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(preload);
      } else {
        setTimeout(preload, 600);
      }
    }

    // Prevent browsers from restoring prior scroll offset on refresh
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      if (!window.location.hash) {
        window.scrollTo(0, 0);
      }
    }

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const pathname = typeof window !== "undefined" ? window.location.pathname : currentPathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isPortalPath = pathname.startsWith("/portal") || pathname.startsWith("/client");
  const relativePath = pathname.startsWith("/admin") ? pathname.slice("/admin".length) || "/" : "/";
  const initialEntry = `${relativePath}${typeof window !== "undefined" ? window.location.search : ""}`;

  return (
    <ThemeProvider>
      <LoginViewProvider>
        <ContactModalProvider>
          <SiteConfigProvider>
            <GlobalVisitorTracker />
            {!isAdminPath && !isPortalPath && <TidioWidget />}
            {isAdminPath ? (
              <Suspense fallback={<RouteLoadingScreen label="Loading CRM…" />}>
                <MemoryRouter initialEntries={[initialEntry]}>
                  <Routes>
                    <ReactRouterRoute path="/*" element={<CodexDynamicsAdminApp />} />
                  </Routes>
                </MemoryRouter>
              </Suspense>
            ) : isPortalPath ? (
              <Suspense fallback={<RouteLoadingScreen label="Loading Portal…" />}>
                <ClientPortalApp />
              </Suspense>
            ) : (
              <Outlet />
            )}
            <Toaster
              position="top-center"
              offset={56}
              toastOptions={{
                style: {
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-hairline)",
                  color: "var(--color-label)",
                  borderRadius: "12px",
                },
              }}
            />
          </SiteConfigProvider>
        </ContactModalProvider>
      </LoginViewProvider>
    </ThemeProvider>
  );
}

export const Route = createRootRoute({
  component: RootShell,
});
