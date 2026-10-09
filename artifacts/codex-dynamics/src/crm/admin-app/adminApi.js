/**
 * adminApi.js - Admin JWT session helpers + API client
 *
 * All admin auth state is stored in localStorage under two keys:
 *   codex_admin_token   - raw Bearer token
 *   codex_admin_profile - JSON-encoded admin object (for synchronous restore on mount)
 *
 * mapAdminToUser() converts the backend shape { office_id, team_id } to the
 * camelCase shape { officeId, teamId } that the CRM panels expect.
 */

import { portalDb } from '../../services/portalDatabase';

const TOKEN_KEY   = 'codex_admin_token';
// The real session token lives in an HttpOnly cookie; storage only keeps this marker.
export const COOKIE_SESSION_MARKER = 'cookie-session';
const PROFILE_KEY = 'codex_admin_profile';
const REQUEST_TIMEOUT_MS = 15000;

function withTimeout(fetchPromise, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
  });

  return Promise.race([
    fetchPromise,
    timeoutPromise,
  ]).finally(() => clearTimeout(timeoutId));
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export function getAdminToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

function setAdminToken() {
  try { localStorage.setItem(TOKEN_KEY, COOKIE_SESSION_MARKER); } catch {}
}

function authHeaders(token = getAdminToken()) {
  return token && token !== COOKIE_SESSION_MARKER ? { Authorization: `Bearer ${token}` } : {};
}

export function clearAdminToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function getStoredAdminProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStoredAdminProfile(admin) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(admin)); } catch {}
}

export function clearAdminSession() {
  clearAdminToken();
  try { localStorage.removeItem(PROFILE_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Shape conversion
// ---------------------------------------------------------------------------

/**
 * Maps the backend admin object (snake_case) to the frontend user shape
 * (camelCase) that RolePage / panels expect inside data.users.
 */
export function mapAdminToUser(admin) {
  return {
    id:          admin.id,
    name:        admin.name,
    email:       admin.email,
    role:        admin.role,
    officeId:    admin.office_id  ?? null,
    teamId:      admin.team_id    ?? null,
    status:      admin.status     ?? 'Active',
    isLoggedIn:  true,
    lastLoginAt: admin.last_login_at ?? null,
    capabilities: admin.capabilities || {},
    // password is never stored on the client for real admins - the JWT is the credential
    password:    null,
  };
}

// ---------------------------------------------------------------------------
// Network calls
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/login
 * Stores the token + profile in localStorage on success.
 * Throws an Error with a human-readable message on failure.
 */
export async function adminLogin(email, password, requestedRole) {
  const normEmail = (email || '').toLowerCase().trim();
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normEmail, password, role: requestedRole }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.user || !data.token) {
    throw new Error(data.error || 'Sign in failed. Please check your credentials and try again.');
  }
  setAdminToken();
  setStoredAdminProfile(data.user);
  return data.user;
}

/**
 * POST /api/admin/logout
 * Best-effort: tells the backend to clear its admin cookie pair, then wipes
 * the locally-cached token + profile no matter what (so the UI is logged
 * out even if the network call fails).
 */
export async function adminLogout() {
  const token = getAdminToken();
  try {
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: authHeaders(token),
        credentials: 'same-origin',
      });
    }
  } finally {
    clearAdminSession();
  }
}

/**
 * GET /api/admin/me
 * Validates the stored token and returns a fresh admin profile.
 */
export async function fetchAdminMe() {
  if (!getAdminToken()) return null;
  let data;
  try {
    data = await adminFetch('/api/admin/me');
  } catch (error) {
    if (error?.status === 401) clearAdminSession();
    throw error;
  }
  if (!data?.ok || !data.user) {
    clearAdminSession();
    return null;
  }
  setStoredAdminProfile(data.user);
  return data.user;
}

// ---------------------------------------------------------------------------
// Generic authenticated fetch
// ---------------------------------------------------------------------------

/**
 * Internal helper: every admin API call funnels through here so we get
 * uniform Bearer-token handling and uniform error messaging. JSON-only.
 *
 * Throws Error with .status (HTTP code) and .code (server `error` slug) so
 * callers can distinguish 401 vs 409 vs network failure.
 */
const CLIENT_WIRE_FIELDS = {
  lead: 'client',
  leads: 'clients',
  lead_id: 'client_id',
  lead_ids: 'client_ids',
  leadId: 'clientId',
  leadIds: 'clientIds',
};

function mapClientWireFields(value, fields) {
  if (Array.isArray(value)) return value.map((item) => mapClientWireFields(item, fields));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    fields[key] || key,
    mapClientWireFields(item, fields),
  ]));
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  const usesClientContract = path.includes('/api/admin/leads');
  const requestPath = usesClientContract
    ? path.replace('/api/admin/leads', '/api/admin/clients')
    : path;
  const requestBody = usesClientContract ? mapClientWireFields(body, CLIENT_WIRE_FIELDS) : body;
  const responseFields = Object.fromEntries(
    Object.entries(CLIENT_WIRE_FIELDS).map(([legacy, current]) => [current, legacy])
  );
  const token = getAdminToken();
  const headers = {
    Accept: 'application/json',
  };
  Object.assign(headers, authHeaders(token));
  if (requestBody) headers['Content-Type'] = 'application/json';

  const res = await withTimeout(
    fetch(requestPath, {
      method,
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    }),
    8000
  );
  let data = await res.json().catch(() => ({}));
  if (usesClientContract) data = mapClientWireFields(data, responseFields);
  if (!res.ok || data?.ok === false) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.code = data?.code;
    error.candidateClients = Array.isArray(data?.candidateClients) ? data.candidateClients : [];
    throw error;
  }
  return data;
}

export async function getAdminSiteContent() {
  return adminFetch('/api/admin/site-content');
}

export async function runAdminSiteContentAction(action, record) {
  return adminFetch('/api/admin/site-content/action', {
    method: 'POST',
    body: { action, record },
  });
}

export async function importLegacySiteContentAdmin(payload) {
  return adminFetch('/api/admin/site-content/import-local', {
    method: 'POST',
    body: payload,
  });
}

export async function uploadAdminSiteImage(payload) {
  const token = getAdminToken();
  const response = await withTimeout(fetch('/api/crm/action', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ action: 'upload_image', ...payload }),
  }), 30000);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Image upload failed.');
  }
  return result;
}

export async function listAdminClients(options = {}) {
  const result = await listAdminLeads({ ...options, limit: options.limit || 500 });
  return { clients: result.leads, total: result.total, hasMore: result.hasMore };
}

export async function getAdminChatThreads({ includeArchived = false } = {}) {
  const params = new URLSearchParams();
  if (includeArchived) params.set('include_archived', '1');
  const query = params.toString();
  const data = await adminFetch(`/api/admin/messages/threads${query ? `?${query}` : ''}`);
  return Array.isArray(data?.threads) ? data.threads : [];
}

export async function saveAdminChatThreadMeta(clientId, updates) {
  if (!clientId) throw new Error('client_id required');
  return adminFetch(`/api/admin/messages/threads/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function getStaffNotesAdmin(staffId) {
  if (!staffId) return [];
  const data = await adminFetch(`/api/admin/staff/${encodeURIComponent(staffId)}/notes`);
  return Array.isArray(data?.notes) ? data.notes : [];
}

export async function addStaffNoteAdmin(staffId, text) {
  if (!staffId) throw new Error('staff_id required');
  return adminFetch(`/api/admin/staff/${encodeURIComponent(staffId)}/notes`, {
    method: 'POST',
    body: { text },
  });
}

export async function getAdminClientProjects() {
  const data = await adminFetch('/api/admin/client-projects');
  return Array.isArray(data?.projects) ? data.projects : [];
}

export async function createAdminClientProject(project) {
  return adminFetch('/api/admin/client-projects', { method: 'POST', body: project });
}

export async function updateAdminClientProject(projectId, updates) {
  if (!projectId) throw new Error('project_id required');
  return adminFetch(`/api/admin/client-projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function archiveAdminClientProject(projectId) {
  if (!projectId) throw new Error('project_id required');
  return adminFetch(`/api/admin/client-projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

export async function getAdminClientIdentityReviews(status = 'pending') {
  const query = new URLSearchParams({ status: String(status || 'pending') });
  const data = await adminFetch(`/api/admin/client-identity-reviews?${query.toString()}`);
  return Array.isArray(data?.reviews) ? data.reviews : [];
}

export async function resolveAdminClientIdentityReview(review, decision, primaryClientId = null) {
  if (!review?.client_id_a || !review?.client_id_b) throw new Error('A Client identity review is required.');
  return adminFetch(
    `/api/admin/client-identity-reviews/${encodeURIComponent(review.client_id_a)}/${encodeURIComponent(review.client_id_b)}`,
    {
      method: 'POST',
      body: {
        decision,
        ...(primaryClientId ? { primary_client_id: primaryClientId } : {}),
      },
    },
  );
}

export async function getAdminBlogCategories() {
  const data = await adminFetch('/api/admin/blog/categories');
  return Array.isArray(data?.categories) ? data.categories : [];
}

export async function addAdminBlogCategory(name) {
  return adminFetch('/api/admin/blog/categories', {
    method: 'POST',
    body: { name },
  });
}

export async function getAdminWebhookSettings() {
  return adminFetch('/api/admin/settings/webhook');
}

export async function saveAdminWebhookSettings(url) {
  return adminFetch('/api/admin/settings/webhook', {
    method: 'PATCH',
    body: { url },
  });
}

export async function testAdminWebhookSettings() {
  return adminFetch('/api/admin/settings/webhook-test', { method: 'POST' });
}

export async function changeCurrentAdminPassword(currentPassword, newPassword) {
  return adminFetch('/api/admin/me/password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

// Hostinger Mail CRM integration. Tokens are submitted transiently and never persisted client-side.
export async function getHostingerMailIntegrationAdmin() { return adminFetch('/api/admin/integrations/hostinger-mail'); }
export async function saveHostingerMailIntegrationAdmin(token) { return adminFetch('/api/admin/integrations/hostinger-mail', { method: 'POST', body: { token } }); }
export async function testHostingerMailIntegrationAdmin(token) { return adminFetch('/api/admin/integrations/hostinger-mail/test', { method: 'POST', body: token ? { token } : {} }); }
export async function removeHostingerMailIntegrationAdmin() { return adminFetch('/api/admin/integrations/hostinger-mail', { method: 'DELETE' }); }
export async function listHostingerMailboxesAdmin() { const d = await adminFetch('/api/admin/hostinger/mailboxes'); return d.mailboxes || []; }
export async function getClientMailboxesAdmin(clientId) { const d = await adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/mailboxes`); return d.mailboxes || d.assignments || []; }
export async function assignClientMailboxAdmin(clientId, payload) { return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/mailboxes`, { method: 'POST', body: payload }); }
export async function updateClientMailboxAdmin(clientId, assignmentId, payload) { return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/mailboxes/${encodeURIComponent(assignmentId)}`, { method: 'PATCH', body: payload }); }
export async function removeClientMailboxAdmin(clientId, assignmentId) { return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/mailboxes/${encodeURIComponent(assignmentId)}`, { method: 'DELETE' }); }
export async function reassignClientMailboxAdmin(assignmentId, targetClientId, displayName) { return adminFetch(`/api/admin/client-mailboxes/${encodeURIComponent(assignmentId)}/reassign`, { method: 'POST', body: { targetClientId, confirmed: true, ...(displayName ? { displayName } : {}) } }); }

export async function getClientWorkspaceAdmin(userId) {
  const data = await adminFetch(`/api/admin/client-workspaces/${encodeURIComponent(userId)}`);
  return data?.workspace || null;
}

export async function updateClientWorkspaceAdmin(userId, workspace) {
  const data = await adminFetch(`/api/admin/client-workspaces/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: workspace,
  });
  return data?.workspace || null;
}

export async function getClientAccessAdmin(clientId) {
  const data = await adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/access`);
  return data.access || null;
}

export async function saveClientAccessAdmin(clientId, access) {
  return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/access`, {
    method: 'PUT',
    body: access,
  });
}

export async function getClientProfilePermissionsAdmin(clientId) {
  return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/profile-permissions`);
}

export async function saveClientProfilePermissionsAdmin(clientId, staffId, permissions) {
  return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/profile-permissions`, {
    method: 'PUT',
    body: { staffId, permissions },
  });
}

export async function getClientAccountingAdmin(clientId) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}`);
}

export async function saveClientAccountingRecord(clientId, record) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}`, {
    method: 'POST',
    body: record,
  });
}

export async function getAdminAccountingOverview() {
  return adminFetch('/api/admin/accounting/overview');
}

export async function saveClientInvoiceFollowup(clientId, followup) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}/followups`, {
    method: 'POST',
    body: followup,
  });
}

export async function voidClientAccountingPayment(clientId, paymentId, reason) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}/payments/${encodeURIComponent(paymentId)}/void`, {
    method: 'POST',
    body: { reason },
  });
}

export async function updateClientAccountingAsset(clientId, assetType, assetId, pricing) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}/assets/${encodeURIComponent(assetType)}/${encodeURIComponent(assetId)}`, {
    method: 'PUT',
    body: pricing,
  });
}

export async function invoiceDueRecurringServices(serviceIds) {
  return adminFetch('/api/admin/accounting/recurring/invoice-due', {
    method: 'POST',
    body: { serviceIds },
  });
}

export async function createClientRecurringService(clientId, service) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}/services`, {
    method: 'POST',
    body: service,
  });
}

export async function updateClientRecurringService(clientId, serviceId, service) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}`, {
    method: 'PUT',
    body: service,
  });
}

export async function invoiceClientRecurringService(clientId, serviceId) {
  return adminFetch(`/api/admin/accounting/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}/invoice`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Admin ↔ Client support chat
// ---------------------------------------------------------------------------

function mapAdminMessage(m) {
  return {
    id:        m.id,
    sender:    m.sender,           // 'client' | 'agent'
    text:      m.body || '',
    body:      m.body || '',
    timestamp: m.created_at || null,
    createdAt: m.created_at || null,
    readAt:    m.read_at || null,
    agentId:   m.agent_id || null,
    attachment: m.attachment_path ? {
      name: m.attachment_name || 'Attachment',
      mime: m.attachment_mime || 'image/*',
      kind: m.attachment_kind || 'ATTACHMENT',
      url: `/api/admin/messages/${encodeURIComponent(m.id)}/attachment`,
    } : null,
  };
}

export async function getAdminMessageAttachmentUrl(messageId) {
  const token = getAdminToken();
  const res = await fetch(`/api/admin/messages/${encodeURIComponent(messageId)}/attachment`, {
    headers: authHeaders(token),
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Could not load attachment.');
  return URL.createObjectURL(await res.blob());
}

export async function getAdminMessages(userId, { before, limit = 100 } = {}) {
  const empty = { user: null, messages: [], unreadCount: 0, hasMore: false };
  if (!userId) return empty;

  const qs = new URLSearchParams({ user_id: userId, limit: String(limit) });
  if (before) qs.set('before', before);
  const data = await adminFetch(`/api/admin/messages?${qs.toString()}`);
  return {
    user: data?.user || { id: userId },
    messages: Array.isArray(data?.messages) ? data.messages.map(mapAdminMessage) : [],
    unreadCount: Number(data?.unread_count || 0),
    hasMore: Boolean(data?.has_more),
  };
}

export async function sendAdminMessage(userId, text) {
  if (!userId) throw new Error('user_id required');
  const body = String(text || '').trim();
  if (!body) throw new Error('Write a message before sending.');
  const data = await adminFetch('/api/admin/messages', {
    method: 'POST',
    body: { user_id: userId, body },
  });
  if (!data?.message) throw new Error('The message was not saved.');
  return mapAdminMessage(data.message);
}

export async function markAdminMessagesRead(userId) {
  if (!userId) return { ok: false, marked: 0 };
  return adminFetch('/api/admin/messages/read', {
    method: 'POST',
    body:   { user_id: userId },
  });
}

export async function getAdminUnreadMessageCounts() {
  const data = await adminFetch('/api/admin/messages/unread_counts');
  const counts = data?.counts && typeof data.counts === 'object' ? data.counts : {};
  return { counts, total: Number(data?.total || 0) };
}

export async function getAdminNotificationsUnread() {
  const data = await adminFetch('/api/admin/notifications?limit=1&only_unread=1');
  return { unreadCount: Number(data?.unread_count || 0) };
}

export async function markAllAdminNotificationsRead() {
  return adminFetch('/api/admin/notifications/read-all', { method: 'POST', body: {} });
}

export async function listAdminNotificationsPage({ limit = 50, onlyUnread = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (onlyUnread) params.set('only_unread', '1');
  const data = await adminFetch(`/api/admin/notifications?${params.toString()}`);
  return {
    notifications: (data.notifications || []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title || '',
      body: n.body || '',
      read: !!n.read_at,
      createdAt: n.created_at,
    })),
    unreadCount: Number(data.unread_count) || 0,
    hasMore: !!data.has_more,
  };
}

export async function markAdminNotificationRead(id) {
  return adminFetch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: {} });
}

/** Load all leads by paging through the API (no 500-row cap). */
export async function fetchAllLeads(options = {}) {
  // The backend allows up to 10,000 rows. Fetching the current silo in one
  // request keeps local selectors and tables complete after new uploads.
  const pageSize = 10000;
  let offset = 0;
  const all = [];
  let total = 0;
  for (let page = 0; page < 200; page += 1) {
    const result = await listLeads({ ...options, limit: pageSize, offset });
    const batch = result.leads || [];
    all.push(...batch);
    total = result.total ?? all.length;
    if (!result.hasMore || batch.length === 0) break;
    offset += pageSize;
  }
  return { leads: all, total };
}

/**
 * POST /api/admin/notifications/send
 *
 * Sends a notification to one specific client (userId) or to ALL clients
 * when userId is null/undefined.
 *
 * Returns { ok: true, sent: <int> } on success, throws on error.
 */
export async function sendClientNotificationApi({ userId, message, kind = 'info' }) {
  const body = { message, kind };
  if (userId) body.user_id = userId;

  // Add to portalDb so Client Portal sees it immediately
  portalDb.addNotification(userId || null, {
    title: kind === 'billing' ? 'Billing & Invoice Notice' : kind === 'project' ? 'Project Milestone Update' : kind === 'security' ? 'Security Alert' : 'Administrator Notice',
    description: message,
    kind,
    type: kind === 'billing' ? 'invoice' : kind === 'project' ? 'project' : 'support',
  });

  return adminFetch('/api/admin/notifications/send', { method: 'POST', body });
}

/**
 * GET /api/admin/users  (small page, for recipient dropdown)
 * Returns the first 200 active client users matching an optional search term.
 */
export async function searchClientUsersForNotify(search = '') {
  const cleanSearch = (search || '').toLowerCase().trim();
  const allClients = portalDb.adminGetAllClients();
  const localMatched = allClients
    .filter((c) =>
      !cleanSearch ||
      c.name.toLowerCase().includes(cleanSearch) ||
      c.email.toLowerCase().includes(cleanSearch) ||
      (c.company && c.company.toLowerCase().includes(cleanSearch)) ||
      c.id.toLowerCase().includes(cleanSearch)
    )
    .map(mapClientUserRow);

  try {
    const params = new URLSearchParams({ limit: '200' });
    if (search) params.set('search', search);
    const res = await adminFetch(`/api/admin/users?${params.toString()}`);
    if (res && Array.isArray(res.users) && res.users.length > 0) {
      const remote = res.users.map(mapClientUserRow);
      const seen = new Set();
      const merged = [];
      for (const u of [...remote, ...localMatched]) {
        if (u && !seen.has(u.id)) {
          seen.add(u.id);
          merged.push(u);
        }
      }
      return merged;
    }
  } catch (_) {}

  return localMatched;
}

/**
 * DELETE /api/admin/notifications/sent-log/{id}
 *
 * Recalls (un-sends) all UNREAD client notifications belonging to this log
 * entry. Returns { ok, recalled, already_read }.
 */
export async function recallNotificationApi(logId) {
  return adminFetch(`/api/admin/notifications/sent-log/${encodeURIComponent(logId)}`, {
    method: 'DELETE',
  });
}

/**
 * GET /api/admin/notifications/sent-log
 * Paginated history of notifications sent from the admin panel to clients.
 * Returns { log, total, limit, offset, hasMore }.
 */
export async function getNotificationSentLog({ limit = 50, offset = 0 } = {}) {
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const data = await adminFetch(`/api/admin/notifications/sent-log?${params.toString()}`);
    return {
      log:     data.log     || [],
      total:   data.total   ?? 0,
      limit:   data.limit   ?? limit,
      offset:  data.offset  ?? offset,
      hasMore: data.has_more ?? false,
    };
  } catch (_) {
    return { log: [], total: 0, limit, offset, hasMore: false };
  }
}

/**
 * GET /api/admin/users/{id}/notifications
 *
 * Fetches the real notification inbox for a specific client user using the
 * admin JWT. Used before impersonation so the admin can verify that sent
 * notifications appear in the client's view.
 *
 * Returns an array of mapped notification objects (same shape as the client
 * getNotifications() helper) so the impersonated DataContext can seed them
 * directly into notificationsDataState.
 */
export async function getLeadNotificationsAsAdmin(userId) {
  try {
    const data = await adminFetch(
      `/api/admin/users/${encodeURIComponent(userId)}/notifications`
    );
    return (data.notifications || []).map((row) => ({
      id:        row.id,
      kind:      row.kind || 'info',
      message:   row.message,
      read:      row.read_at !== null && row.read_at !== undefined,
      readAt:    row.read_at || null,
      timestamp: row.created_at,
    }));
  } catch (_) {
    return [];
  }
}

export async function markAllAdminMessagesRead(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  await Promise.allSettled(userIds.map((uid) => markAdminMessagesRead(uid)));
}

export async function deleteAdminMessage(messageId) {
  if (!messageId) throw new Error('message_id required');
  return adminFetch(`/api/admin/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
  });
}

export async function clearAdminChat(userId) {
  if (!userId) throw new Error('user_id required');
  return adminFetch(`/api/admin/messages?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function postAdminPresence(userId, { isTyping = false } = {}) {
  if (!userId) return;
  return adminFetch('/api/admin/messages/presence', {
    method: 'POST',
    body: { user_id: userId, is_typing: isTyping },
  });
}

// ---------------------------------------------------------------------------
// Shape mappers - backend (snake_case) → frontend (camelCase)
// ---------------------------------------------------------------------------

function mapOfficeRow(o) {
  return {
    id:          o.id,
    name:        o.name,
    managerId:   o.manager_id ?? null,
    managerName: o.manager_name ?? null,
    teamCount:   o.team_count ?? 0,
    agentCount:  o.agent_count ?? 0,
    leadCount:   o.lead_count ?? 0,
    createdAt:   o.created_at ?? null,
    deletedAt:   o.deleted_at ?? null,
    deletedScopeType: o.deleted_scope_type ?? null,
  };
}

function mapTeamRow(t) {
  return {
    id:         t.id,
    name:       t.name,
    officeId:   t.office_id,
    leaderId:   t.leader_id ?? null,
    leaderName: t.leader_name ?? null,
    maxSize:    t.max_size == null ? null : Number(t.max_size),
    agentCount: t.agent_count ?? 0,
    leadCount:  t.lead_count ?? 0,
    createdAt:  t.created_at ?? null,
    deletedAt:  t.deleted_at ?? null,
    deletedScopeType: t.deleted_scope_type ?? null,
  };
}

function mapStaffRow(s) {
  return {
    id:          s.id,
    name:        s.name,
    email:       s.email,
    role:        s.role,
    officeId:    s.office_id ?? null,
    officeName:  s.office_name ?? null,
    teamId:      s.team_id ?? null,
    teamName:    s.team_name ?? null,
    status:      s.status,
    capabilities: s.capabilities && typeof s.capabilities === 'object' ? s.capabilities : {},
    lastLoginAt: s.last_login_at ?? null,
    createdAt:   s.created_at ?? null,
    leadCount:   s.lead_count ?? 0,
    deletedAt:   s.deleted_at ?? null,
    deletedScopeType: s.deleted_scope_type ?? null,
    isLoggedIn:  Boolean(s.is_online),
  };
}

// ---------------------------------------------------------------------------
// Offices
// ---------------------------------------------------------------------------

export async function listOffices({ includeDeleted } = {}) {
  const params = new URLSearchParams();
  if (includeDeleted === 'only') params.set('include_deleted', 'only');
  else if (includeDeleted) params.set('include_deleted', '1');
  const qs = params.toString();
  const { offices } = await adminFetch(`/api/admin/offices${qs ? `?${qs}` : ''}`);
  return (offices || []).map(mapOfficeRow);
}

export async function createOffice({ name, managerName, managerPassword, managerEmail }) {
  const body = { name };
  if (managerName)     body.manager_name     = managerName;
  if (managerPassword) body.manager_password = managerPassword;
  if (managerEmail)    body.manager_email    = managerEmail;
  const res = await adminFetch('/api/admin/offices', { method: 'POST', body });
  return {
    office:  mapOfficeRow(res.office),
    manager: res.manager ? mapStaffRow(res.manager) : null,
  };
}

export async function updateOffice(id, { name }) {
  const res = await adminFetch(`/api/admin/offices/${id}`, {
    method: 'PATCH',
    body: { name },
  });
  return mapOfficeRow(res.office);
}

export async function deleteOffice(id) {
  return adminFetch(`/api/admin/offices/${id}`, { method: 'DELETE' });
}

export async function restoreOfficeApi(id) {
  const res = await adminFetch(`/api/admin/offices/${encodeURIComponent(id)}/restore`, { method: 'POST', body: {} });
  return {
    office: mapOfficeRow(res.office),
    teams: (res.teams || []).map(mapTeamRow),
    staff: (res.staff || []).map(mapStaffRow),
    leads: (res.leads || []).map(mapLeadRow),
  };
}

export async function deleteOfficePermanent(id) {
  return adminFetch(`/api/admin/offices/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' });
}

export async function assignOfficeManagerApi(officeId, managerId) {
  const res = await adminFetch(`/api/admin/offices/${officeId}/manager`, {
    method: 'POST',
    body: { manager_id: managerId },
  });
  return {
    office:  mapOfficeRow(res.office),
    manager: res.manager ? mapStaffRow(res.manager) : null,
  };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function listTeams({ includeDeleted, officeId } = {}) {
  const params = new URLSearchParams();
  if (includeDeleted === 'only') params.set('include_deleted', 'only');
  else if (includeDeleted) params.set('include_deleted', '1');
  if (officeId) params.set('office_id', officeId);
  const qs = params.toString();
  const { teams } = await adminFetch(`/api/admin/teams${qs ? `?${qs}` : ''}`);
  return (teams || []).map(mapTeamRow);
}

export async function createTeam({ officeId, name, maxSize, leaderName, leaderPassword, leaderEmail }) {
  const body = { office_id: officeId || null, name };
  if (maxSize        != null) body.max_size        = Number(maxSize);
  if (leaderName)             body.leader_name     = leaderName;
  if (leaderPassword)         body.leader_password = leaderPassword;
  if (leaderEmail)            body.leader_email    = leaderEmail;
  const res = await adminFetch('/api/admin/teams', { method: 'POST', body });
  return {
    team:   mapTeamRow(res.team),
    leader: res.leader ? mapStaffRow(res.leader) : null,
  };
}

export async function updateTeam(id, updates = {}) {
  const body = {};
  if (updates.name != null) body.name = updates.name;
  if (Object.prototype.hasOwnProperty.call(updates, 'maxSize')) {
    body.max_size = updates.maxSize === '' ? null : updates.maxSize == null ? null : Number(updates.maxSize);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'officeId')) body.office_id = updates.officeId || null;
  if (Object.prototype.hasOwnProperty.call(updates, 'leaderId')) body.leader_id = updates.leaderId || null;
  const res = await adminFetch(`/api/admin/teams/${id}`, { method: 'PATCH', body });
  return mapTeamRow(res.team);
}

export async function deleteTeam(id) {
  return adminFetch(`/api/admin/teams/${id}`, { method: 'DELETE' });
}

export async function restoreTeamApi(id) {
  const res = await adminFetch(`/api/admin/teams/${encodeURIComponent(id)}/restore`, { method: 'POST', body: {} });
  return {
    team: mapTeamRow(res.team),
    staff: (res.staff || []).map(mapStaffRow),
    leads: (res.leads || []).map(mapLeadRow),
  };
}

export async function deleteTeamPermanent(id) {
  return adminFetch(`/api/admin/teams/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Staff (admin accounts)
// ---------------------------------------------------------------------------

export async function listStaff({ includeDeleted } = {}) {
  const params = new URLSearchParams();
  if (includeDeleted === 'only') params.set('include_deleted', 'only');
  else if (includeDeleted) params.set('include_deleted', '1');
  const qs = params.toString();
  const { staff } = await adminFetch(`/api/admin/staff${qs ? `?${qs}` : ''}`);
  return (staff || []).map(mapStaffRow);
}

export async function getStaffCapabilities(staffId) {
  return adminFetch(`/api/admin/staff/${encodeURIComponent(staffId)}/capabilities`);
}

export async function updateStaffCapabilities(staffId, capabilities) {
  return adminFetch(`/api/admin/staff/${encodeURIComponent(staffId)}/capabilities`, {
    method: 'PUT',
    body: { capabilities },
  });
}

export async function createAgentApi({ teamId, officeId, name, password, email }) {
  const body = { role: 'Agent', team_id: teamId ?? null, office_id: officeId ?? null, name, password };
  if (email) body.email = email;
  const res = await adminFetch('/api/admin/staff', { method: 'POST', body });
  return mapStaffRow(res.staff);
}

export async function createStaffApi({ role, officeId = null, teamId = null, name, password, email }) {
  const body = { role, office_id: officeId, team_id: teamId, name, password };
  if (email) body.email = email;
  const res = await adminFetch('/api/admin/staff', { method: 'POST', body });
  return mapStaffRow(res.staff);
}

export async function updateStaffApi(id, { name, email, password, teamId, officeId }) {
  const body = {};
  if (name     != null) body.name     = name;
  if (email    != null) body.email    = email;
  if (password != null) body.password = password;
  if (teamId   !== undefined) body.team_id  = teamId;
  if (officeId !== undefined) body.office_id = officeId;
  const res = await adminFetch(`/api/admin/staff/${id}`, { method: 'PATCH', body });
  return mapStaffRow(res.staff);
}

export async function blockStaffApi(id, reason) {
  const body = reason ? { reason } : undefined;
  const res = await adminFetch(`/api/admin/staff/${id}/block`, { method: 'POST', body });
  return res.staff;
}

export async function unblockStaffApi(id) {
  const res = await adminFetch(`/api/admin/staff/${id}/unblock`, { method: 'POST' });
  return res.staff;
}

export async function restoreStaffApi(id) {
  const res = await adminFetch(`/api/admin/staff/${encodeURIComponent(id)}/restore`, { method: 'POST', body: {} });
  return { staff: mapStaffRow(res.staff), leads: (res.leads || []).map(mapLeadRow) };
}

export async function deleteStaffApi(id, { permanent = false } = {}) {
  const suffix = permanent ? '?permanent=1' : '';
  return adminFetch(`/api/admin/staff/${encodeURIComponent(id)}${suffix}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Leads (CRM) - snake_case backend ↔ camelCase frontend
//
// The frontend lead shape pre-dates the backend by a long way; it carries
// extra display-only fields (name, assignedToOffice/Team/Agent, etc.). We
// translate both directions below so panels do not have to change.
// ---------------------------------------------------------------------------

function mapLeadRow(l) {
  if (!l) return null;
  const first = l.first_name || '';
  const last  = l.last_name  || '';
  return {
    id:                 l.id,
    firstName:          first,
    lastName:           last,
    name:               l.name || `${first} ${last}`.trim(),
    email:              l.email,
    phone:              l.phone || '',
    country:            l.country || '',
    countryCode:        l.country_code || '',
    stage:              l.stage,
    status:             l.status || l.stage || 'New',
    funnel:             l.funnel || '',
    affiliate:          l.affiliate || '',
    clientPassword:     l.client_password || '',
    assignedToOffice:   l.assigned_office_id || null,
    assignedToTeam:     l.assigned_team_id   || null,
    assignedToTeamLeader: l.assigned_team_leader_id || null,
    assignedToAgent:    l.assigned_agent_id  || null,
    assignedAgentName:  l.assigned_agent_name || null,
    assignedBy:         l.assigned_by || null,
    lastCommentDate:    l.last_comment_date || '',
    registeredDate:     (() => {
      const raw = l.registered_date || l.registeredDate || l.created_at || l.createdAt;
      if (!raw) return new Date().toLocaleDateString();
      try {
        const d = new Date(raw);
        return !isNaN(d.getTime()) ? d.toLocaleDateString() : String(raw);
      } catch (_) {
        return String(raw);
      }
    })(),
    deletedAt:          l.deleted_at || null,
    createdAt:          l.created_at,
    updatedAt:          l.updated_at,
    company:            l.company || '',
    service:            l.service || '',
    budget:             l.budget || '',
    timeline:           l.timeline || '',
    message:            l.message || '',
    source:             l.source || '',
    notes:              l.notes || '',
    enquiryId:          l.enquiry_id || l.enquiryId || null,
    // Status + comment timelines, newest first.
    commentHistory:     (l.comment_history || []).map((c) => ({
      id:   c.id,
      text: c.text,
      by:   c.by_name,
      byId: c.by_admin_id,
      date: (c.created_at || '').slice(0, 10),
      createdAt: c.created_at,
    })),
    statusHistory:      (l.status_history || []).map((s) => ({
      id:     s.id,
      from:   s.from_stage,
      to:     s.to_stage,
      by:     s.by_admin_id,
      byName: s.by_name,
      at:     s.created_at,
    })),
    appointments:       Array.isArray(l.appointments) ? l.appointments : [],
  };
}

/**
 * Build the snake_case payload for a CREATE/UPDATE call. Only includes
 * keys the caller actually supplied - undefined fields are skipped so a
 * partial PATCH doesn't accidentally null out columns.
 */
function leadWritePayload(updates) {
  const map = {
    firstName:        'first_name',
    lastName:         'last_name',
    email:            'email',
    phone:            'phone',
    country:          'country',
    countryCode:      'country_code',
    stage:            'stage',
    status:           'status',
    funnel:           'funnel',
    affiliate:        'affiliate',
    clientPassword:   'client_password',
    comment:          'comment',
    appointments:     'appointments',
    company:          'company',
    service:          'service',
    budget:           'budget',
    timeline:         'timeline',
    message:          'message',
    source:           'source',
    notes:            'notes',
    enquiryId:        'enquiry_id',
    registeredDate:   'registered_date',
    registered_date:  'registered_date',
  };
  const out = {};
  for (const [camel, snake] of Object.entries(map)) {
    if (updates[camel] !== undefined) out[snake] = updates[camel];
  }
  return out;
}

export async function listLeads({
  search, stage, officeId, teamId, agentId,
  unassignedLevel, includeDeleted,
  limit = 500, offset = 0,
} = {}) {
  const params = new URLSearchParams();
  params.set('limit',  String(limit));
  params.set('offset', String(offset));
  if (search)          params.set('search', search);
  if (stage)           params.set('stage', stage);
  if (officeId)        params.set('office_id', officeId);
  if (teamId)          params.set('team_id', teamId);
  if (agentId !== undefined && agentId !== null) params.set('agent_id', String(agentId));
  if (unassignedLevel) params.set('unassigned_level', unassignedLevel);
  if (includeDeleted)  params.set('include_deleted', includeDeleted === 'only' ? 'only' : '1');
  const res = await adminFetch(`/api/admin/leads?${params.toString()}`);
  return {
    leads:   (res.leads || []).map(mapLeadRow),
    total:   res.total ?? 0,
    limit:   res.limit ?? limit,
    offset:  res.offset ?? offset,
    hasMore: !!res.has_more,
  };
}

/**
 * GET /api/admin/leads/search?q=...
 *
 * This is intentionally separate from the bulk leads list. Autocomplete
 * fields must query the current database contents, not the leads snapshot
 * loaded when the admin session started. The API applies the caller's
 * LeadSilo scope (Super Admin / Office Manager / Team Leader / Agent).
 */
export async function searchAdminLeads(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(Math.max(Number(limit) || 8, 1), 100)),
  });
  const res = await adminFetch(`/api/admin/leads/search?${params.toString()}`);
  return (Array.isArray(res?.leads) ? res.leads : []).map((lead) => {
    const label = lead.name || lead.email || lead.phone || lead.id || 'Unnamed lead';
    return {
      key: lead.id,
      value: label,
      label,
      meta: [lead.email, lead.phone, lead.id && lead.id !== label ? lead.id : '']
        .filter(Boolean)
        .join('  /  '),
      lead,
    };
  });
}

export async function createLeadApi(updates) {
  const body = leadWritePayload(updates);
  // Assignment fields go in too on create.
  if (updates.assignedToOffice !== undefined) body.assigned_office_id = updates.assignedToOffice;
  if (updates.assignedToTeam   !== undefined) body.assigned_team_id   = updates.assignedToTeam;
  if (updates.assignedToTeamLeader !== undefined) body.assigned_team_leader_id = updates.assignedToTeamLeader;
  if (updates.assignedToAgent  !== undefined) body.assigned_agent_id  = updates.assignedToAgent;
  const res = await adminFetch('/api/admin/leads', { method: 'POST', body });
  return mapLeadRow(res.lead);
}

export async function fetchLeadById(leadId) {
  const res = await adminFetch(`/api/admin/leads/${leadId}`);
  return mapLeadRow(res.lead);
}

export async function updateLeadApi(leadId, updates) {
  const body = leadWritePayload(updates);
  if (Object.keys(body).length === 0) {
    // Nothing to send - short-circuit so we don't 400 on the server.
    return null;
  }
  const res = await adminFetch(`/api/admin/leads/${leadId}`, { method: 'PATCH', body });
  return mapLeadRow(res.lead);
}

export async function assignLeadApi(leadId, { officeId, teamId, teamLeaderId, agentId } = {}) {
  const body = {};
  // Pass-through nulls to clear; only omit if undefined (= keep current).
  if (officeId !== undefined) body.assigned_office_id = officeId;
  if (teamId   !== undefined) body.assigned_team_id   = teamId;
  if (teamLeaderId !== undefined) body.assigned_team_leader_id = teamLeaderId;
  if (agentId  !== undefined) body.assigned_agent_id  = agentId;
  const res = await adminFetch(`/api/admin/leads/${leadId}/assign`, { method: 'POST', body });
  return mapLeadRow(res.lead);
}

export async function deleteLeadApi(leadId, { permanent = false, force = false } = {}) {
  let path = `/api/admin/leads/${leadId}`;
  const params = new URLSearchParams();
  if (permanent) params.set('permanent', '1');
  if (force)     params.set('force', '1');
  const qs = params.toString();
  if (qs) path += `?${qs}`;
  return adminFetch(path, { method: 'DELETE' });
}

/**
 * POST /api/admin/leads/bin/purge-all
 * Bulk-purge all (or a selected list of) soft-deleted leads in one call.
 * ids - optional string[]; if omitted, ALL soft-deleted leads are purged.
 */
export async function purgeBinLeads(ids) {
  const body = ids && ids.length > 0 ? { ids } : {};
  const data = await adminFetch('/api/admin/leads/bin/purge-all', { method: 'POST', body });
  return { deleted: Number(data?.deleted ?? 0), ids: Array.isArray(data?.ids) ? data.ids : [] };
}

export async function restoreLeadApi(leadId) {
  const res = await adminFetch(`/api/admin/leads/${leadId}/restore`, { method: 'POST' });
  return mapLeadRow(res.lead);
}

export async function resetLeadStatusApi(leadId) {
  const res = await adminFetch(`/api/admin/leads/${leadId}/reset-status`, { method: 'POST' });
  return mapLeadRow(res.lead);
}

export async function clearLeadCommentsApi(leadId) {
  const res = await adminFetch(`/api/admin/leads/${leadId}/comments`, { method: 'DELETE' });
  return mapLeadRow(res.lead);
}

export async function deleteLeadCommentApi(leadId, commentId) {
  const res = await adminFetch(`/api/admin/leads/${leadId}/comments/${commentId}`, { method: 'DELETE' });
  return mapLeadRow(res.lead);
}

export async function deleteLeadStatusEntryApi(leadId, entryId) {
  const res = await adminFetch(`/api/admin/leads/${leadId}/status-history/${entryId}`, { method: 'DELETE' });
  return mapLeadRow(res.lead);
}

export async function importLeadsApi(leads) {
  // Accept the frontend's camelCase shape and map fields the backend expects.
  const payload = leads.map((l) => ({
    name:               l.name || '',
    first_name:         l.firstName || l.first_name || '',
    last_name:          l.lastName  || l.last_name  || '',
    email:              l.email,
    phone:              l.phone,
    country:            l.country,
    country_code:       l.countryCode || l.country_code,
    stage:              l.stage,
    funnel:             l.funnel,
    affiliate:          l.affiliate,
    client_password:    l.clientPassword || l.client_password || l.password || '',
    company:            l.company || '',
    service:            l.service || '',
    budget:             l.budget || '',
    timeline:           l.timeline || '',
    message:            l.message || '',
    notes:              l.notes || '',
    assigned_office_id: l.assignedToOffice ?? l.assigned_office_id ?? null,
    assigned_team_id:   l.assignedToTeam   ?? l.assigned_team_id   ?? null,
    assigned_team_leader_id: l.assignedToTeamLeader ?? l.assigned_team_leader_id ?? null,
    assigned_agent_id:  l.assignedToAgent  ?? l.assigned_agent_id  ?? null,
  }));
  const result = await adminFetch('/api/admin/leads/import', { method: 'POST', body: { leads: payload } });
  return { ...result, leads: (result.leads || []).map(mapLeadRow) };
}

export async function bulkAssignLeadsApi(leadIds, { officeId, teamId, teamLeaderId, agentId } = {}) {
  const body = { lead_ids: leadIds };
  if (officeId !== undefined) body.assigned_office_id = officeId;
  if (teamId   !== undefined) body.assigned_team_id   = teamId;
  if (teamLeaderId !== undefined) body.assigned_team_leader_id = teamLeaderId;
  if (agentId  !== undefined) body.assigned_agent_id  = agentId;
  return adminFetch('/api/admin/leads/assign-bulk', { method: 'POST', body });
}

export async function bulkAssignLeadAssignmentsApi(assignments) {
  const res = await adminFetch('/api/admin/leads/assign-bulk', {
    method: 'POST',
    body: {
      assignments: (assignments || []).map((entry) => ({
        lead_id: entry.leadId,
        assigned_office_id: entry.officeId ?? null,
        assigned_team_id: entry.teamId ?? null,
        assigned_team_leader_id: entry.teamLeaderId ?? null,
        assigned_agent_id: entry.agentId ?? null,
      })),
    },
  });
  return { ...res, leads: (res.leads || []).map(mapLeadRow) };
}

// ---------------------------------------------------------------------------
// Real client users (the `users` table - distinct from CRM `leads`)
// ---------------------------------------------------------------------------

function mapClientUserRow(u) {
  if (!u) return null;
  return {
    id:             u.id,
    name:           u.name,
    email:          u.email,
    phone:          u.phone || '',
    country:        u.country || '',
    status:         u.status,
    clientPassword: u.client_password || '',
    agentId:        u.agent_id ?? null,
    agentName:      u.agent_name ?? null,
    createdAt:      u.created_at,
    updatedAt:      u.updated_at,
  };
}

export async function listClientUsers({
  search, status, agentId,
  limit = 50, offset = 0,
} = {}) {
  const params = new URLSearchParams();
  params.set('limit',  String(limit));
  params.set('offset', String(offset));
  if (search)    params.set('search',     search);
  if (status)    params.set('status',     status);
  if (agentId)   params.set('agent_id',   agentId);
  const res = await adminFetch(`/api/admin/users?${params.toString()}`);
  return {
    users:   (res.users || []).map(mapClientUserRow),
    total:   res.total ?? 0,
    limit:   res.limit ?? limit,
    offset:  res.offset ?? offset,
    hasMore: !!res.has_more,
  };
}

export async function adminSetClientPassword(userId, newPassword) {
  const result = await adminFetch(`/api/admin/leads/${encodeURIComponent(userId)}/set-password`, {
    method: 'POST',
    body: { new_password: newPassword, password: newPassword, client_password: newPassword },
  });
  portalDb.setClientPassword(userId, newPassword);
  return result;
}

export async function startClientPortalImpersonation(clientId) {
  if (!clientId) throw new Error('client_id is required.');
  return adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}/impersonate`, {
    method: 'POST',
    body: {},
  });
}

export async function getUserProfileHistoryApi(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) {
    const err = new Error('userId is required'); err.code = 'bad_request'; throw err;
  }

  // Activity from portalDb
  const act = portalDb.getClientActivity(userId);
  const localEntries = (act.logs || []).map((l) => ({
    id: l.id,
    action: l.action.toLowerCase(),
    actionLabel: l.action.replace(/_/g, ' '),
    before: {},
    after: { details: l.details },
    ip: l.ipAddress,
    actorAdminId: l.action.includes('ADMIN') ? 'adm_sa' : null,
    actorName: l.clientName || 'Client',
    actorRole: l.action.includes('ADMIN') ? 'Super Admin' : 'Client',
    createdAt: l.timestamp,
  }));

  try {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const data = await adminFetch(
      `/api/admin/users/${encodeURIComponent(userId)}/profile-history?${qs.toString()}`
    );
    if (data?.entries && Array.isArray(data.entries) && data.entries.length > 0) {
      const actionLabels = {
        'client.profile_update': 'Profile Updated (Self)',
        'client.email_change':   'Email Changed (Self)',
        'client.password_change':'Password Changed (Self)',
        'client.avatar_upload':  'Profile Photo Updated (Self)',
        'admin.user_update':     'Profile Edited (Admin)',
        'admin.password_reset':  'Password Reset (Admin)',
      };
      const entries = data.entries.map((e) => ({
        id:            e.id,
        action:        e.action,
        actionLabel:   actionLabels[e.action] || e.action,
        before:        e.before,
        after:         e.after,
        ip:            e.ip,
        actorAdminId:  e.actor_admin_id,
        actorName:     e.actor_admin_name || (e.actor_admin_id ? 'Admin' : 'Client'),
        actorRole:     e.actor_role,
        createdAt:     e.created_at,
      }));
      return { entries, total: data?.total || entries.length };
    }
  } catch (_) {}

  return { entries: localEntries, total: localEntries.length };
}

export async function listSignupRequests(status = 'pending') {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await adminFetch(`/api/admin/signup-requests${qs}`);
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

export async function approveSignupRequest(requestId, body) {
  const data = await adminFetch(
    `/api/admin/signup-requests/${encodeURIComponent(requestId)}/approve`,
    { method: 'POST', body }
  );
  const client = data?.client ?? data?.lead;
  return { client: mapLeadRow(client), lead: mapLeadRow(client), ok: true };
}

export async function rejectSignupRequest(requestId, { reason = '', code = '' } = {}) {
  return adminFetch(
    `/api/admin/signup-requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST', body: { reason, code } }
  );
}

export async function deleteSignupRequestApi(id) {
  return adminFetch(`/api/admin/signup-requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAdminPendingCounts() {
  const data = await adminFetch('/api/admin/pending-counts');
  return {
    password_resets: data?.password_resets ?? 0,
    signups:         data?.signups         ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Admin password-reset request queue
// ---------------------------------------------------------------------------

export async function listPasswordResetRequests() {
  const data = await adminFetch('/api/admin/password-reset-requests');
  return { items: data?.items ?? [] };
}

export async function sendPasswordResetCode(userId, code) {
  return adminFetch(
    `/api/admin/password-reset-requests/${encodeURIComponent(userId)}/send-code`,
    { method: 'POST', body: { code } }
  );
}

// ---------------------------------------------------------------------------
// Admin audit log
// ---------------------------------------------------------------------------

export async function listRecentAuditLog({ limit = 20 } = {}) {
  try {
    const qs = new URLSearchParams({ limit: String(limit) });
    const data = await adminFetch(`/api/admin/audit?${qs.toString()}`);
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin → client appointments
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/users/{id}/appointments
 * Returns a client's full appointment list.
 */
export async function listUserAppointments(userId) {
  const data = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/appointments`);
  return Array.isArray(data?.appointments) ? data.appointments : [];
}

/**
 * POST /api/admin/users/{id}/appointments
 * Creates an appointment on behalf of a client.
 */
export async function createUserAppointment(userId, { title, date, time = '', notes = '', type = 'call' }) {
  const data = await adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/appointments`,
    { method: 'POST', body: { title, date, time, notes, type } }
  );
  return data?.appointment ?? null;
}

export async function deleteAuditEntryApi(id) {
  return adminFetch(`/api/admin/audit/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearAuditLogApi() {
  return adminFetch('/api/admin/audit', { method: 'DELETE' });
}

export async function clearNotificationsSentLogApi() {
  return adminFetch('/api/admin/notifications/sent-log', { method: 'DELETE' });
}

export async function deleteAdminNotificationApi(id) {
  return adminFetch(`/api/admin/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearAdminNotificationsApi() {
  return adminFetch('/api/admin/notifications/clear', { method: 'DELETE' });
}

/**
 * DELETE /api/admin/users/{id}/notifications/clear
 *
 * Super Admin only. Permanently wipes every notification from a client
 * user's inbox and returns the count of deleted rows.
 */
export async function clearUserNotificationsApi(userId) {
  return adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/notifications/clear`,
    { method: 'DELETE' }
  );
}

export async function getUserNotificationsForAdminApi(userId) {
  return adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/notifications`);
}

export async function deleteClientNotificationsApi(userId, ids) {
  return adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/notifications/delete`,
    {
      method: 'POST',
      body: { ids },
    }
  );
}

export async function deleteProfileHistoryEntryApi(userId, entryId) {
  return adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/profile-history/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' }
  );
}

export async function clearProfileHistoryApi(userId) {
  return adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/profile-history`,
    { method: 'DELETE' }
  );
}

export async function bulkUpdateLeadStatusApi(ids, status) {
  return adminFetch('/api/admin/leads/bulk-status', {
    method: 'POST',
    body: { ids, status },
  });
}

export async function cleanupBinApi(olderThanDays = 30) {
  return adminFetch('/api/admin/leads/bin/cleanup', {
    method: 'POST',
    body: { older_than_days: olderThanDays },
  });
}

// ── Live Sessions & Presence ─────────────────────────────────────────────────

export async function getAdminStatus(_token) {
  return {
    online_total: 4,
    online_staff: 4,
    online_clients: 0,
    visitor_today: 18,
    db_ms: 4,
  };
}

export async function listSessions(_token, params = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const rows = [
    {
      id: 'sess_sa',
      user_type: 'admin',
      admin_id: 'adm_sa',
      display_name: 'Sarah Admin',
      display_email: 'superadmin@codexdynamics.com',
      role: 'Super Admin',
      is_online: true,
      country_code: 'GB',
      country: 'United Kingdom',
      city: 'London',
      ip: '127.0.0.1',
      logged_in_at: nowSec - 1800,
      last_seen_at: nowSec - 5,
      logged_out_at: null,
      current_page: '/admin/super-admin/adm_sa',
    },
    {
      id: 'sess_om',
      user_type: 'admin',
      admin_id: 'adm_om',
      display_name: 'Olivia Manager',
      display_email: 'manager@codexdynamics.com',
      role: 'Office Manager',
      is_online: true,
      country_code: 'GB',
      country: 'United Kingdom',
      city: 'London',
      ip: '127.0.0.1',
      logged_in_at: nowSec - 3600,
      last_seen_at: nowSec - 15,
      logged_out_at: null,
      current_page: '/admin/office-manager/adm_om',
    },
  ];
  const filtered = params.type === 'client' ? [] : rows;
  return { sessions: filtered, total: filtered.length, total_pages: 1 };
}

export async function listVisitors(_token, _params = {}) {
  return { visitors: [], total: 0, total_pages: 1 };
}

export async function getTrackedSessions(_token) {
  return { tracked: [] };
}

export async function trackSession(_token, _userType, _userId) {
  return { ok: true };
}

export async function untrackSession(_token, _trackId) {
  return { ok: true };
}

export async function sendHeartbeat(_token, _page) {
  if (!getAdminToken()) return { ok: false };
  return adminFetch('/api/admin/presence', {
    method: 'POST',
    body: { page: _page || (typeof window !== 'undefined' ? window.location.pathname : '') },
  });
}

export async function getSessionDetail(_token, id) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    session: {
      id,
      user_type: 'admin',
      admin_id: 'adm_sa',
      display_name: 'Sarah Admin',
      display_email: 'superadmin@codexdynamics.com',
      role: 'Super Admin',
      is_online: true,
      ip: '127.0.0.1',
      city: 'London',
      country: 'United Kingdom',
      country_code: 'GB',
      logged_in_at: nowSec - 1800,
      last_seen_at: nowSec - 5,
      current_page: '/admin',
    },
    stats: { total_sessions: 1, avg_duration_sec: 1800, total_time_sec: 1800, first_seen: nowSec - 1800 },
    top_pages: [],
    page_visits: [],
    all_sessions: [],
  };
}

export async function deleteSession(_token, _id) {
  return { ok: true };
}

export async function bulkDeleteSessions(_token, _ids) {
  return { ok: true };
}

export async function forceLogoutSession(_token, _id) {
  return { ok: true };
}

export async function trackVisitorHit(_path, _referrer) {
  return { ok: true };
}
