/**
 * portalConnector.ts
 *
 * The Standardized Codex Dynamics Portal Connector Protocol.
 *
 * This service implements the client-side integration and receiver protocol for any website
 * back office built by or managed by Codex Dynamics.
 *
 * SPECIFICATION:
 * 1. Protocol: Single Sign-On via Short-Lived Single-Use Bearer Token
 * 2. Handshake:
 *    Portal generates: `cdx_sso_<timestamp>_<nonce>` with 60-second TTL
 *    Redirects to: `${backOfficeUrl}?cdx_sso_token=${token}&website_id=${websiteId}`
 * 3. Validation:
 *    Website back office calls `verifyCodexPortalToken(token, websiteId)`
 *    Verifies non-expired, single-use nonce, website ownership, and active client account.
 *    Marks token as consumed to prevent replay attacks.
 *    Creates local session for the authenticated client admin user.
 */

import { portalDb, type ClientWebsite, type PortalClient } from './portalDatabase';

export interface ConnectorVerificationResult {
  success: boolean;
  message?: string;
  error?: string;
  website?: ClientWebsite;
  client?: PortalClient;
  authenticatedUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
    company?: string;
  };
  sessionToken?: string;
  timestamp: string;
}

/**
 * Standard verification function run on the receiving website back office
 */
export function verifyCodexPortalToken(ssoToken: string, websiteId: string): ConnectorVerificationResult {
  const result = portalDb.validateSsoToken(ssoToken, websiteId);

  if (!result.valid) {
    return {
      success: false,
      error: result.error || 'Token verification failed',
      message: result.error || 'Token verification failed',
      timestamp: new Date().toISOString(),
    };
  }

  const localSessionToken = `site_admin_sess_${result.client?.id}_${Date.now()}`;

  return {
    success: true,
    message: 'SSO Token verified successfully',
    website: result.website,
    client: result.client,
    authenticatedUser: result.sessionUser ? {
      ...result.sessionUser,
      company: result.client?.company || '',
    } : undefined,
    sessionToken: localSessionToken,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Standard SDK snippet for future websites (copy-pasteable integration code)
 */
export const CODEX_PORTAL_CONNECTOR_DOCUMENTATION = `
// ============================================================================
// CODEX DYNAMICS PORTAL CONNECTOR SPECIFICATION (v1.0)
// ============================================================================
// To connect any future client website back office to the Codex Dynamics Portal:
//
// 1. Add this verification handler to your website's back office auth route:
//
// app.get('/admin', async (req, res) => {
//   const { cdx_sso_token, website_id } = req.query;
//   if (cdx_sso_token && website_id) {
//     const verification = await verifyWithCodexCentral(cdx_sso_token, website_id);
//     if (verification.success) {
//       // Establish local session and log user into back office!
//       req.session.user = verification.authenticatedUser;
//       return res.redirect('/admin/dashboard');
//     }
//     return res.status(403).send('Codex SSO verification failed: ' + verification.error);
//   }
// });
// ============================================================================
`;
