import { createFileRoute } from "@tanstack/react-router";
import { ClientPortalApp } from "@/portal/ClientPortalApp";

export const Route = createFileRoute("/client")({
  component: ClientPortalApp,
});
