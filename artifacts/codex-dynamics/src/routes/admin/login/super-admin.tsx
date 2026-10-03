import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteShell } from "@/crm/admin-app/AdminRouteShell";

export const Route = createFileRoute("/admin/login/super-admin")({
  component: AdminRouteShell,
});
