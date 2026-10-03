import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClientLoginSplitView } from "@/components/ClientLoginSplitView";
import { smoothNavigate } from "@/lib/nav";

export const Route = createFileRoute("/login")({
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const impersonateId = params.get("impersonateLeadId") || params.get("impersonateClientId");
      if (impersonateId) {
        let clientData: any = null;
        try {
          const raw = sessionStorage.getItem("codex_impersonate_lead");
          if (raw) clientData = JSON.parse(raw);
        } catch (_) {}

        const id = impersonateId;
        const name = clientData?.name || clientData?.company || "Client";
        const email = clientData?.email || "";
        const token = `cdx_sess_${id}_${Date.now()}`;
        const portalClient = {
          id,
          name,
          company: clientData?.company || name,
          email,
          phone: clientData?.phone || "",
          address: clientData?.address || "",
          country: clientData?.country || "United Kingdom",
          countryCode: clientData?.countryCode || "GB",
          status: "Active",
          portalEnabled: true,
          tier: clientData?.tier || "Enterprise Partner",
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        localStorage.setItem("cdx_portal_session_token_v2", token);
        localStorage.setItem("cdx_portal_session_client_v2", JSON.stringify(portalClient));
        localStorage.setItem("codex_client_token", token);
        localStorage.setItem("codex_client_user", JSON.stringify(portalClient));
        sessionStorage.removeItem("cdx_portal_logged_out");
        sessionStorage.setItem("codex_impersonating_admin", "true");
        sessionStorage.setItem("codex_impersonating_client_name", name);

        smoothNavigate("/portal/dashboard");
      }
    }
  }, []);

  return (
    <ClientLoginSplitView
      onClose={() => {
        smoothNavigate("/");
      }}
      onSuccess={() => {
        smoothNavigate("/portal/dashboard");
      }}
    />
  );
}
