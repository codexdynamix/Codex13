import { useEffect } from "react";
import { MemoryRouter, Route as ReactRouterRoute, Routes, useLocation } from "react-router-dom";
import CodexDynamicsAdminApp from "./App.jsx";

function AdminUrlSync() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const locPath = location.pathname;
    const cleanPath = locPath.startsWith("/admin") ? locPath : `/admin${locPath === "/" ? "" : locPath}`;
    const fullPath = `${cleanPath}${location.search}${location.hash}`;
    if (window.location.pathname + window.location.search !== fullPath) {
      window.history.replaceState(null, "", fullPath);
    }
  }, [location]);

  return null;
}

export function AdminRouteShell() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/admin";
  const relativePath = pathname.startsWith("/admin") ? pathname.slice("/admin".length) || "/" : "/";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const initialEntry = `${relativePath}${search}`;

  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminUrlSync />
      <Routes>
        <ReactRouterRoute path="/*" element={<CodexDynamicsAdminApp />} />
      </Routes>
    </MemoryRouter>
  );
}
