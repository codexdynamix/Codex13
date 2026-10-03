/**
 * portalAuth.ts
 *
 * Dedicated authentication and session service for the Codex Dynamics Client Portal.
 * Handles client login, session validation, token storage, and client isolation guards.
 */

import { portalDb, type PortalClient } from './portalDatabase';

const PORTAL_TOKEN_KEY = 'cdx_portal_session_token_v2';
const PORTAL_USER_KEY = 'cdx_portal_session_client_v2';

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

    // If admin is impersonating but user payload isn't in localStorage, check sessionStorage
    if (!client && isImpersonating) {
      try {
        const leadRaw = sessionStorage.getItem('codex_impersonate_lead');
        if (leadRaw) {
          const lead = JSON.parse(leadRaw);
          const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client';
          client = {
            id: lead.id,
            name,
            company: lead.company || name,
            email: lead.email || '',
            phone: lead.phone || '',
            address: lead.address || '',
            country: lead.country || 'United Kingdom',
            countryCode: lead.countryCode || 'GB',
            status: 'Active',
            portalEnabled: true,
            tier: (lead.tier || 'Enterprise Partner') as any,
            lastLoginAt: new Date().toISOString(),
            createdAt: lead.createdAt || new Date().toISOString(),
          };
          localStorage.setItem(PORTAL_TOKEN_KEY, `cdx_sess_${client.id}_${Date.now()}`);
          localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(client));
        }
      } catch (_) {}
    }

    if (!client) {
      return null;
    }

    // If accessing via admin authority, bypass password and disabled check
    if (isImpersonating) {
      return {
        token: token || `cdx_sess_${client.id}_${Date.now()}`,
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
    return {
      token: token || `cdx_sess_${freshClient.id}_${Date.now()}`,
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

export function setPortalSession(client: PortalClient): PortalSession {
  // Ensure the client is recorded in portal database
  portalDb.upsertClient(client);

  const token = `cdx_sess_${client.id}_${Date.now()}`;
  const session: PortalSession = {
    token,
    client,
    loginTime: Date.now(),
  };

  try {
    sessionStorage.removeItem('cdx_portal_logged_out');
    localStorage.setItem(PORTAL_TOKEN_KEY, token);
    localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(client));
    // Also sync with legacy keys for backwards-compatibility with old /client route
    localStorage.setItem('codex_client_token', token);
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

export function clearPortalSession(): void {
  try {
    sessionStorage.setItem('cdx_portal_logged_out', 'true');
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    const raw = localStorage.getItem(PORTAL_USER_KEY);
    if (token && raw) {
      try {
        const client = JSON.parse(raw) as PortalClient;
        portalDb.logAudit(client.id, client.name, 'CLIENT_LOGOUT', 'Client signed out of Client Portal');
      } catch (_) {}
    }
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    localStorage.removeItem(PORTAL_USER_KEY);
    localStorage.removeItem('codex_client_token');
    localStorage.removeItem('codex_client_user');
    window.dispatchEvent(new CustomEvent('cdx_portal_auth_changed', { detail: null }));
  } catch (_) {}
}

/**
 * Authenticates client credentials.
 * Throws human-readable Error if invalid or disabled.
 */
export async function portalLogin(email: string, password?: string): Promise<PortalClient> {
  const cleanEmail = email.toLowerCase().trim();

  try {
    const res = await fetch('/api/portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    const data = await res.json();
    if (res.ok && data.ok && data.client) {
      setPortalSession(data.client);
      return data.client;
    }

    if (data.error) {
      throw new Error(data.error);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
  }

  const client = portalDb.getClientByEmail(cleanEmail);

  if (!client) {
    throw new Error('No client account found with this email address. Please check your spelling or contact your Codex Dynamics account manager.');
  }

  if (!client.portalEnabled || client.status !== 'Active') {
    throw new Error('This client portal account is currently disabled or suspended. Please contact Codex Dynamics support.');
  }

  // In production, compare hashed passwords. If password is provided, verify.
  if (client.password && password && client.password !== password) {
    throw new Error('Incorrect password. Please try again or use direct login assistance.');
  }

  setPortalSession(client);
  return client;
}
