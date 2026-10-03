import { createFileRoute } from "@tanstack/react-router";
import { AdminCRM } from "@/routes/admin";

export const Route = createFileRoute("/admin/login/office-manager")({
  component: AdminCRM,
});
