import { startClientPortalImpersonation } from './adminApi';
import { setPortalImpersonationSession } from '../../services/portalAuth';

export async function enterClientPortal(clientId) {
  const response = await startClientPortalImpersonation(clientId);
  if (!response?.ok || !response?.token || !response?.client) {
    throw new Error('Could not start a secure client portal session.');
  }

  setPortalImpersonationSession(response.client, response.token);
  const targetUrl = '/portal/dashboard';
  if (typeof window.cdxNavigate === 'function') {
    window.cdxNavigate(targetUrl);
  } else {
    window.location.assign(targetUrl);
  }
  return response.client;
}