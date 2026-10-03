import { createFileRoute } from "@tanstack/react-router";
import { AdminCRM } from "@/routes/admin";

export const Route = createFileRoute("/admin/login/super-admin")({
  component: AdminCRM,
});
