import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authLogin, authMe, clearClientToken, getLead, readClientToken } from "@/crm/api.js";

export const Route = createFileRoute("/login")({
  component: ClientLoginPage,
});

function ClientLoginPage() {
  const [email, setEmail] = useState("client@codexdynamics.com");
  const [password, setPassword] = useState("client123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const impersonateLeadId = new URLSearchParams(window.location.search).get("impersonateLeadId");
    if (impersonateLeadId) {
      setLoading(true);
      setError("");
      getLead(impersonateLeadId)
        .then(async (lead) => {
          let stashedLead: typeof lead = null;
          try {
            const raw = sessionStorage.getItem("codex_impersonate_lead");
            stashedLead = raw ? JSON.parse(raw) : null;
          } catch (_) {
            stashedLead = null;
          }
          const accountLead = lead || stashedLead;
          const accountPassword = accountLead?.clientPassword || "client123";
          if (!accountLead?.email) {
            throw new Error("This lead does not have portal credentials.");
          }
          const user = await authLogin(accountLead.email, accountPassword);
          if (!user) throw new Error("Could not enter the lead account.");
          sessionStorage.removeItem("codex_impersonate_lead");
          window.location.assign("/client");
        })
        .catch((err) => {
          clearClientToken();
          setError(err instanceof Error ? err.message : "Could not enter the lead account.");
          setLoading(false);
        });
      return;
    }

    const token = readClientToken();
    if (!token) return;

    authMe()
      .then((user) => {
        if (user) {
          window.location.assign("/client");
        } else {
          clearClientToken();
        }
      })
      .catch(() => {
        clearClientToken();
      });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await authLogin(email.trim(), password);
      if (!user) {
        throw new Error("Login failed.");
      }
      window.location.assign("/client");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--color-paper)",
          border: "1px solid var(--color-border)",
          borderRadius: 20,
          boxShadow: "var(--shadow-border)",
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              width: 48,
              height: 48,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-fill)",
              color: "var(--color-foreground)",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 12,
              border: "1px solid var(--color-border)",
            }}
          >
            CD
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Client Portal</h1>
          <p style={{ margin: "8px 0 0", color: "var(--color-subtle)" }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              style={{
                background: "var(--color-fill)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                color: "var(--color-foreground)",
                padding: "12px 14px",
                fontSize: 15,
              }}
              required
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}>Password <small style={{ color: "var(--color-muted-foreground)", fontWeight: 400 }}>(Optional - password not required)</small></span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password not required"
              style={{
                background: "var(--color-fill)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                color: "var(--color-foreground)",
                padding: "12px 14px",
                fontSize: 15,
              }}
            />
          </label>

          {error ? (
            <div
              style={{
                background: "rgba(255, 59, 48, 0.08)",
                border: "1px solid rgba(255, 59, 48, 0.2)",
                color: "#a1141e",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 12,
              background: loading ? "#6d6d73" : "var(--color-primary)",
              color: "var(--color-primary-foreground)",
              fontWeight: 700,
              fontSize: 15,
              padding: "12px 16px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 16, color: "var(--color-subtle)", fontSize: 13, textAlign: "center" }}>
          Demo client access: <strong>client@codexdynamics.com</strong> / <strong>client123</strong>
        </div>
      </div>
    </div>
  );
}
