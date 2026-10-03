import { useEffect, useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { MemoryRouter, Route as ReactRouterRoute, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth/provider";
import { SiteConfigProvider } from "@/context/SiteConfigContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ContactModalProvider } from "@/context/ContactModalContext";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import CodexDynamicsAdminApp from "@/crm/admin-app/App.jsx";
import { Toaster } from "sonner";
import { TidioWidget } from "@/components/TidioWidget";
import { GlobalVisitorTracker } from "@/components/GlobalVisitorTracker";
import appCss from "../styles.css?url";

const APP_NAME = "Codex Dynamics";

export function RootShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const isAdminPath = mounted && pathname.startsWith("/admin");
  const relativePath = pathname.startsWith("/admin") ? pathname.slice("/admin".length) || "/" : "/";
  const initialEntry = `${relativePath}${typeof window !== "undefined" ? window.location.search : ""}`;

  if (isAdminPath) {
    return (
      <html lang="en" className="antialiased" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body>
          <PreviewHostBridge />
          <ThemeProvider>
            <ContactModalProvider>
              <SiteConfigProvider>
                <GlobalVisitorTracker />
                <TidioWidget />
                <AuthProvider>
                  <MemoryRouter initialEntries={[initialEntry]}>
                    <Routes>
                      <ReactRouterRoute path="/*" element={<CodexDynamicsAdminApp />} />
                    </Routes>
                  </MemoryRouter>
                  <Toaster
                    position="top-center"
                    offset={56}
                    toastOptions={{
                      style: {
                        background: "var(--color-paper)",
                        border: "1px solid var(--color-hairline)",
                        color: "var(--color-label)",
                        borderRadius: "12px",
                      },
                    }}
                  />
                </AuthProvider>
              </SiteConfigProvider>
            </ContactModalProvider>
          </ThemeProvider>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <ThemeProvider>
          <ContactModalProvider>
            <SiteConfigProvider>
              <GlobalVisitorTracker />
              <TidioWidget />
              <AuthProvider>
                <Outlet />
                <Toaster
                  position="top-center"
                  offset={56}
                  toastOptions={{
                    style: {
                      background: "var(--color-paper)",
                      border: "1px solid var(--color-hairline)",
                      color: "var(--color-label)",
                      borderRadius: "12px",
                    },
                  }}
                />
              </AuthProvider>
            </SiteConfigProvider>
          </ContactModalProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "High-performance websites, web design, web development, custom CRMs, and digital marketing agency.",
      },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content:
          "High-performance websites, web design, web development, custom CRMs, and digital marketing agency.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootShell,
});
