/**
 * portalAuth.ts
 *
 * Dedicated authentication and session service for the Codex Dynamics Client Portal.
 * Handles client login, session validation, token storage, and client isolation guards.
 */

import { portalDb, type PortalClient } from './portalDatabase';

const PORTAL_TOKEN_KEY = 'cdx_portal_session_token_v2';
const PORTAL_USER_KEY = 'cdx_portal_session_client_v2';
// The real session token lives in an HttpOnly cookie; storage only keeps this marker.
export const PORTAL_COOKIE_SESSION_MARKER = 'cookie-session';

export function portalAuthHeaders(token: string | null | undefined): Record<string, string> {
  return token && token !== PORTAL_COOKIE_SESSION_MARKER ? { Authorization: `Bearer ${token}` } : {};
}

export interface PortalSession {
  token: string;
  client: PortalClient;
  loginTime: number;
}

export function readPortalSession(): PortalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const isImpersonating = sessionStorage.getItem('codex_impersonating_admin') === 'true';
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    const raw = localStorage.getItem(PORTAL_USER_KEY);

    let client: PortalClient | null = null;
    if (raw) {
      try {
        client = JSON.parse(raw) as PortalClient;
      } catch (_) {}
    }

    if (!client || !token || token.startsWith('cdx_sess_')) {
      if (isImpersonating) clearPortalSession();
      return null;
    }

    // The server-issued portal token carries the impersonation scope. The
    // browser flag only selects the appropriate portal UI; it grants no API
    // access by itself.
    if (isImpersonating) {
      return {
        token,
        client,
        loginTime: Date.now(),
      };
    }

    // Standard client login verification
    const freshClient = portalDb.getClientById(client.id);
    if (!freshClient || !freshClient.portalEnabled || freshClient.status !== 'Active') {
      clearPortalSession();
      return null;
    }
    if (!token) {
      clearPortalSession();
      return null;
    }
    return {
      token,
      client: freshClient,
      loginTime: Date.now(),
    };
  } catch (e) {
    if (sessionStorage.getItem('codex_impersonating_admin') === 'true') {
      return null;
    }
    clearPortalSession();
    return null;
  }
}

export function setPortalSession(client: PortalClient, serverToken?: string): PortalSession {
  // Ensure the client is recorded in portal database
  portalDb.upsertClient(client);

  const impersonating = sessionStorage.getItem('codex_impersonating_admin') === 'true';
  if (impersonating) throw new Error('Use the server-authorized portal session flow for staff access.');
  const token = serverToken || localStorage.getItem(PORTAL_TOKEN_KEY) || '';
  if (!token || token.startsWith('cdx_sess_')) throw new Error('A valid server session is required.');
  const session: PortalSession = {
    token,
    client,
    loginTime: Date.now(),
  };

  try {
    sessionStorage.removeItem('cdx_portal_logged_out');
    localStorage.setItem(PORTAL_TOKEN_KEY, PORTAL_COOKIE_SESSION_MARKER);
    localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(client));
    // Also sync with legacy keys for backwards-compatibility with old /client route
    localStorage.setItem('codex_client_token', PORTAL_COOKIE_SESSION_MARKER);
    localStorage.setItem('codex_client_user', JSON.stringify({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      country: client.country,
      status: client.status,
    }));
    window.dispatchEvent(new CustomEvent('cdx_portal_auth_changed', { detail: session }));
  } catch (e) {
    console.error('[portalAuth] failed to write session', e);
  }

  // Update last login in database safely
  try {
    portalDb.adminUpdateClient(client.id, {
      lastLoginAt: new Date().toISOString(),
    });
    portalDb.logAudit(client.id, client.name, 'CLIENT_LOGIN', `Client signed into Client Portal successfully`);
  } catch (_) {}

  return session;
}

export function setPortalImpersonationSession(client: PortalClient, serverToken: string): PortalSession {
  if (!serverToken || serverToken.startsWith('cdx_sess_')) {
    throw new Error('The server did not return a valid client portal session.');
  }
  clearPortalSession();
  const session: PortalSession = {
    token: serverToken,
    client,
    loginTime: Date.now(),
  };
  try {
    sessionStorage.removeItem('cdx_portal_logged_out');
    sessionStorage.setItem('codex_impersonating_admin', 'true');
    sessionStorage.setItem('codex_impersonating_client_name', client.name || 'Client');
    localStorage.setItem(PORTAL_TOKEN_KEY, PORTAL_COOKIE_SESSION_MARKER);
    localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(client));
    localStorage.setItem('codex_client_token', PORTAL_COOKIE_SESSION_MARKER);
    localStorage.setItem('codex_client_user', JSON.stringify({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      country: client.country,
      status: client.status,
    }));
    window.dispatchEvent(new CustomEvent('cdx_portal_auth_changed', { detail: session }));
  } catch (error) {
    clearPortalSession();
    throw error;
  }
  return session;
}

export function clearPortalSession(): void {
  try {
    sessionStorage.setItem('cdx_portal_logged_out', 'true');
    const impersonating = sessionStorage.getItem('codex_impersonating_admin') === 'true';
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    const raw = localStorage.getItem(PORTAL_USER_KEY);
    if (token) {
      void fetch('/api/portal/logout', {
        method: 'POST',
        headers: portalAuthHeaders(token),
        credentials: 'same-origin',
      }).catch(() => {});
    }
    if (token && raw && !impersonating) {
      try {
        const client = JSON.parse(raw) as PortalClient;
        portalDb.logAudit(client.id, client.name, 'CLIENT_LOGOUT', 'Client signed out of Client Portal');
      } catch (_) {}
    }
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    localStorage.removeItem(PORTAL_USER_KEY);
    localStorage.removeItem('codex_client_token');
    localStorage.removeItem('codex_client_user');
    sessionStorage.removeItem('codex_impersonating_admin');
    sessionStorage.removeItem('codex_impersonating_client_name');
    sessionStorage.removeItem('codex_impersonate_lead');
    sessionStorage.removeItem('codex_impersonate_notifications');
    window.dispatchEvent(new CustomEvent('cdx_portal_auth_changed', { detail: null }));
  } catch (_) {}
}

/**
 * Authenticates client credentials.
 * Throws human-readable Error if invalid or disabled.
 */
export async function portalLogin(email: string, password?: string): Promise<PortalClient> {
  const cleanEmail = email.toLowerCase().trim();
  const res = await fetch('/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.client || !data.token) {
    throw new Error(data.error || 'Client sign-in failed. Please check your details and try again.');
  }
  setPortalSession(data.client, data.token);
  return data.client;
}
