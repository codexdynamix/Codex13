import { readPortalSession } from '../services/portalAuth';

export interface ProviderMailbox { resourceId: string; address: string; assignedClientId?: string | null; assignedClientName?: string | null }
export interface ClientMailbox { id: string; clientId: string; providerMailboxId: string; emailAddress: string; displayName: string; enabled: boolean; createdAt: string; updatedAt: string }
export interface Folder { path: string; name: string; delimiter: string; specialUse: string | null; messageCount: number; unreadCount: number }
export interface MailAddress { address: string; name: string }
export interface MailAttachment { id: string; filename: string | null; contentType: string; sizeBytes: number; inline: boolean; contentId: string | null }
export interface MailMessage { uid: number; path: string; date: string; subject: string | null; from: MailAddress | null; to: MailAddress[]; cc: MailAddress[]; bcc: MailAddress[]; flags: string[]; unseen: boolean; size: number; attachments: MailAttachment[] }
export interface Pagination { page: number; perPage: number; total: number; totalPages: number }
export interface Draft { id?: string; to: string[]; cc: string[]; bcc: string[]; subject: string; text: string; html?: string; attachments: { filename: string; contentType: string; content: string; encoding?: 'base64' }[]; inReplyTo?: { folder: string; uid: number }; forwardOf?: { folder: string; uid: number }; updatedAt?: string }
type Result<T> = T & { pagination?: Pagination };

async function portalRequest<T>(path: string, options: RequestInit = {}, binary = false): Promise<T> {
  const session = readPortalSession();
  if (!session?.token) throw new Error('Your portal session has expired. Sign in again.');
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${session.token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (!response.ok) {
    if (binary) throw new Error(`Attachment download failed (${response.status}).`);
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Mail request failed (${response.status}).`);
  }
  if (binary) return response.blob() as Promise<T>;
  const data = await response.json().catch(() => ({}));
  if (data?.ok === false) throw new Error(data.error || 'Mail request failed.');
  return (data?.data ?? data) as T;
}
const base = (resourceId: string) => `/api/portal/mailboxes/${encodeURIComponent(resourceId)}`;
const messageUrl = (resourceId: string, folder: string, uid: number) => `${base(resourceId)}/folders/${encodeURIComponent(folder)}/messages/${uid}`;
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const normalizeDraft = (draft: Draft): Draft => ({
  ...draft,
  to: Array.isArray(draft.to) ? draft.to : [],
  cc: Array.isArray(draft.cc) ? draft.cc : [],
  bcc: Array.isArray(draft.bcc) ? draft.bcc : [],
  attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
});

export async function getPortalMailboxes() { const d = await portalRequest<{ mailboxes?: ClientMailbox[]; assignments?: ClientMailbox[] } | ClientMailbox[]>('/api/portal/mailboxes'); return Array.isArray(d) ? d : d.mailboxes || d.assignments || []; }
export async function getPortalMailFolders(resourceId: string) { const d = await portalRequest<{ folders?: Folder[] } | Folder[]>(`${base(resourceId)}/folders`); return Array.isArray(d) ? d : d.folders || []; }
export async function listPortalMailMessages(resourceId: string, folder: string, page: number, perPage: number) { return portalRequest<Result<{ messages: MailMessage[] }>>(`${base(resourceId)}/folders/${encodeURIComponent(folder)}/messages?page=${page}&perPage=${perPage}`); }
export async function searchPortalMailMessages(resourceId: string, folder: string, text: string, page: number, perPage: number) { return portalRequest<Result<{ messages: MailMessage[] }>>(`${base(resourceId)}/folders/${encodeURIComponent(folder)}/messages/search?page=${page}&perPage=${perPage}`, { ...json('POST', { text }) }); }
export async function getPortalStarredMessages(resourceId: string, page: number, perPage: number) { return portalRequest<Result<{ messages: MailMessage[] }>>(`${base(resourceId)}/starred?page=${page}&perPage=${perPage}`); }
export async function getPortalMailMessage(resourceId: string, folder: string, uid: number) { return portalRequest<{ message: MailMessage; body: { text: string; html: string } }>(messageUrl(resourceId, folder, uid)); }
export async function setPortalMessageFlags(resourceId: string, folder: string, uid: number, addFlags: string[], removeFlags: string[]) { return portalRequest(messageUrl(resourceId, folder, uid), { ...json('PATCH', { addFlags, removeFlags }) }); }
export async function movePortalMessage(resourceId: string, folder: string, uid: number, targetFolder: string) { return portalRequest(`${messageUrl(resourceId, folder, uid)}/move`, { ...json('POST', { targetFolder }) }); }
export async function deletePortalMailMessage(resourceId: string, folder: string, uid: number) { return portalRequest(messageUrl(resourceId, folder, uid), json('DELETE', { confirmed: true })); }
export async function sendPortalMail(resourceId: string, payload: object) { return portalRequest(`${base(resourceId)}/send`, { ...json('POST', payload) }); }
export async function listPortalMailDrafts(resourceId: string) {
  const d = await portalRequest<{ drafts?: Draft[] } | Draft[]>(`${base(resourceId)}/drafts`);
  return (Array.isArray(d) ? d : d.drafts || []).map(normalizeDraft);
}
export async function savePortalMailDraft(resourceId: string, draft: Draft) {
  const result = await portalRequest<{ draft?: Draft } | Draft>(`${base(resourceId)}/drafts`, { ...json('POST', draft) });
  return normalizeDraft(('draft' in result ? result.draft : result) as Draft);
}
export async function deletePortalMailDraft(resourceId: string, draftId: string) { return portalRequest(`${base(resourceId)}/drafts/${encodeURIComponent(draftId)}`, json('DELETE')); }
export async function downloadPortalMailAttachment(resourceId: string, folder: string, uid: number, attachmentId: string) { return portalRequest<Blob>(`${messageUrl(resourceId, folder, uid)}/attachments/${encodeURIComponent(attachmentId)}`, {}, true); }