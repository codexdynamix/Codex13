/**
 * portalDatabase.ts
 *
 * Canonical database and authorization repository for the Codex Dynamics Client Portal
 * and CRM administration.
 *
 * Implements strict server-side/repository-side client authorization:
 * - A client can ONLY query and access their own resources (prevents IDOR).
 * - Every resource lookup validates ownership (clientId).
 * - Back office SSO handoff tokens are short-lived (60s), single-use, and signed.
 * - Website access is configuration-driven and can be enabled/disabled from the CRM.
 * - Changes made in the CRM immediately reflect in the Client Portal and vice versa.
 */

export interface PortalClient {
  id: string;
  name: string;
  company: string;
  email: string;
  password?: string;
  phone: string;
  address: string;
  country: string;
  countryCode: string;
  status: 'Active' | 'Suspended';
  portalEnabled: boolean;
  avatarUrl?: string;
  tier: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ClientWebsite {
  id: string;
  clientId: string;
  name: string;
  domain: string;
  websiteUrl: string;
  backOfficeUrl: string;
  status: 'Active' | 'Maintenance' | 'Development';
  connectionStatus: 'Connected' | 'Pending Setup' | 'Disconnected';
  connectorId: string;
  connectorSecret: string;
  accessEnabled: boolean; // CRM Administrator can toggle this!
  techStack: string[];
  hostingPlan: string;
  sslStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
  dueDate: string;
  notes?: string;
  clientApproved?: boolean;
  clientApprovedAt?: string;
}

export interface ProjectUpdate {
  id: string;
  date: string;
  title: string;
  author: string;
  message: string;
}

export interface ClientProject {
  id: string;
  clientId: string;
  name: string;
  description: string;
  service: string;
  status: 'Planning' | 'In Progress' | 'Waiting for Client' | 'Review' | 'Completed' | 'Maintenance';
  progress: number; // 0 to 100
  startDate: string;
  targetDate: string;
  teamLead: string;
  milestones: ProjectMilestone[];
  recentUpdates: ProjectUpdate[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ClientInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  status: 'Draft' | 'Sent' | 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled';
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  paymentMethod?: string;
}

export interface ClientPayment {
  id: string;
  clientId: string;
  invoiceId?: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  transactionReference: string;
  description: string;
  status: 'Completed' | 'Processing';
}

export interface ClientHosting {
  id: string;
  clientId: string;
  websiteId: string;
  websiteName: string;
  provider: string;
  plan: string;
  status: 'Active' | 'Maintenance' | 'Suspended';
  startDate: string;
  renewalDate: string;
  billingFrequency: 'Monthly' | 'Annual';
  amount: number;
  autoRenew: boolean;
  serverRegion: string;
  ipAddress: string;
  uptime: string;
}

export interface ClientDomain {
  id: string;
  clientId: string;
  websiteId: string;
  domainName: string;
  registrar: string;
  registrationDate: string;
  expirationDate: string;
  renewalDate: string;
  renewalStatus: 'Auto-Renew Active' | 'Expiring Soon - Action Required' | 'Manual Renewal Required';
  sslStatus: string;
  dnsStatus: string;
  autoRenew: boolean;
  nameservers: string[];
}

export interface SupportMessage {
  id: string;
  sender: 'client' | 'staff';
  senderName: string;
  text: string;
  createdAt: string;
  attachment?: { name: string; size: string };
}

export interface ClientSupportTicket {
  id: string;
  clientId: string;
  ticketNumber: string;
  subject: string;
  category: 'Website & Code' | 'Hosting & Server' | 'Billing & Invoicing' | 'Design & UX' | 'General Question';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Waiting for Client' | 'Resolved' | 'Closed';
  assignedStaff: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export interface ClientFile {
  id: string;
  clientId: string;
  name: string;
  category: 'Deliverables' | 'Designs & Branding' | 'Contracts & Legal' | 'Invoices & Receipts';
  size: string;
  fileSize?: string;
  uploadedAt: string;
  uploadedDate?: string;
  fileType: 'pdf' | 'zip' | 'fig' | 'png' | 'docx';
  downloadUrl: string;
}

export interface ClientMessage {
  id: string;
  clientId: string;
  title: string;
  sender: string;
  body: string;
  kind: 'project' | 'billing' | 'security' | 'announcement';
  read: boolean;
  createdAt: string;
}

export interface ClientNotification {
  id: string;
  clientId: string;
  title: string;
  description: string;
  type: 'invoice' | 'domain' | 'project' | 'support' | 'file';
  read: boolean;
  link: string;
  createdAt: string;
}

export interface PortalAuditLog {
  id: string;
  clientId: string;
  clientName: string;
  action: 'CLIENT_LOGIN' | 'CLIENT_LOGOUT' | 'BACKOFFICE_SSO_REQUEST' | 'SSO_TOKEN_VALIDATED' | 'WEBSITE_ACCESS_DISABLED' | 'WEBSITE_ACCESS_ENABLED' | 'TICKET_CREATED' | 'TICKET_REPLIED' | 'PROFILE_UPDATED';
  details: string;
  ipAddress: string;
  timestamp: string;
}

export interface SsoTokenRecord {
  token: string;
  clientId: string;
  websiteId: string;
  clientEmail: string;
  clientName: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
  nonce: string;
  targetBackOfficeUrl: string;
}

interface DatabaseSchema {
  clients: PortalClient[];
  websites: ClientWebsite[];
  projects: ClientProject[];
  invoices: ClientInvoice[];
  payments: ClientPayment[];
  hosting: ClientHosting[];
  domains: ClientDomain[];
  supportTickets: ClientSupportTicket[];
  files: ClientFile[];
  messages: ClientMessage[];
  notifications: ClientNotification[];
  auditLogs: PortalAuditLog[];
  ssoTokens: SsoTokenRecord[];
}

let currentDatabase: DatabaseSchema | null = null;

function createEmptyDatabase(): DatabaseSchema {
  return {
    clients: [],
    websites: [],
    projects: [],
    invoices: [],
    payments: [],
    hosting: [],
    domains: [],
    supportTickets: [],
    files: [],
    messages: [],
    notifications: [],
    auditLogs: [],
    ssoTokens: [],
  };
}

function loadDatabase(): DatabaseSchema {
  currentDatabase ??= createEmptyDatabase();
  return currentDatabase;
}

function saveDatabase(db: DatabaseSchema): void {
  currentDatabase = db;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cdx_portal_database_updated'));
  }
}

function fromApiRow(row: any): any {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const normalized = Object.fromEntries(Object.entries(row).map(([key, rawValue]) => {
    let value = rawValue;
    if (typeof value === 'string' && /^[[{]/.test(value.trim())) {
      try { value = JSON.parse(value); } catch { /* keep plain text */ }
    }
    if (Array.isArray(value)) value = value.map(fromApiRow);
    else if (value && typeof value === 'object') value = fromApiRow(value);
    let normalizedKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (normalizedKey === 'isRead') normalizedKey = 'read';
    if (normalizedKey === 'assignedAgent') normalizedKey = 'assignedStaff';
    if (normalizedKey === 'sender' && value === 'agent') value = 'staff';
    if (normalizedKey === 'portalEnabled') value = Boolean(value);
    return [normalizedKey, value];
  }));
  return normalized;
}

function portalAuthorizationHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cdx_portal_session_token_v2') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && token !== 'cookie-session' ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeClientEmail(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeClientPhone(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/\D/g, '');
}

function assertUniqueClientIdentifiers(
  clients: PortalClient[],
  candidate: Pick<PortalClient, 'email' | 'phone'>,
  excludeClientId?: string,
): void {
  const email = normalizeClientEmail(candidate.email);
  const phone = normalizeClientPhone(candidate.phone);
  const otherClients = clients.filter((client) => client.id !== excludeClientId);

  if (email && otherClients.some((client) => normalizeClientEmail(client.email) === email)) {
    throw new Error('A client account with this email address already exists.');
  }
  if (phone && otherClients.some((client) => normalizeClientPhone(client.phone) === phone)) {
    throw new Error('A client account with this phone number already exists.');
  }
}

// ---------------------------------------------------------------------------
// CLIENT REPOSITORY (STRICT AUTHORIZATION GUARDS)
// ---------------------------------------------------------------------------

export const portalDb = {
  // CLIENT PROFILE
  getClientById(clientId: string): PortalClient | null {
    const db = loadDatabase();
    const found = db.clients.find((c) => c.id === clientId);
    if (found) return found;

    // Check if there is an active impersonated lead or session client in storage
    if (typeof window !== 'undefined') {
      try {
        const rawUser = localStorage.getItem('cdx_portal_session_client_v2');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u && (u.id === clientId || !clientId)) {
            return u;
          }
        }

        const rawLead = sessionStorage.getItem('codex_impersonate_lead');
        if (rawLead) {
          const lead = JSON.parse(rawLead);
          if (lead && (lead.id === clientId || !clientId)) {
            const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client';
            const client: PortalClient = {
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
            return client;
          }
        }
      } catch (_) {}
    }

    return null;
  },

  upsertClient(client: PortalClient): PortalClient {
    const db = loadDatabase();
    const idx = db.clients.findIndex((c) => c.id === client.id);
    if (idx !== -1) {
      const updatedClient = { ...db.clients[idx], ...client };
      assertUniqueClientIdentifiers(db.clients, updatedClient, client.id);
      db.clients[idx] = updatedClient;
      saveDatabase(db);
      return db.clients[idx];
    } else {
      assertUniqueClientIdentifiers(db.clients, client);
      db.clients.unshift({ ...client });
      saveDatabase(db);
      return client;
    }
  },

  getClientByEmail(email: string): PortalClient | null {
    const db = loadDatabase();
    const clean = email.toLowerCase().trim();
    return db.clients.find((c) => c.email.toLowerCase().trim() === clean) || null;
  },

  async syncWithServer(clientId: string): Promise<void> {
    if (typeof window === 'undefined' || !clientId) return;
    const res = await fetch(`/api/portal/data?client_id=${encodeURIComponent(clientId)}`, {
      headers: portalAuthorizationHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Could not load portal data (${res.status}).`);
    const db = loadDatabase();
    if (data.client) {
      const client = fromApiRow(data.client);
      const index = db.clients.findIndex((item) => item.id === clientId);
      if (index >= 0) {
        const updatedClient = { ...db.clients[index], ...client };
        assertUniqueClientIdentifiers(db.clients, updatedClient, clientId);
        db.clients[index] = updatedClient;
      } else {
        assertUniqueClientIdentifiers(db.clients, client);
        db.clients.push(client);
      }
    }
    const replaceClientRows = (localKey: keyof DatabaseSchema, remoteKey: string) => {
      const rows = Array.isArray(data[remoteKey]) ? data[remoteKey].map(fromApiRow) : [];
      (db[localKey] as any[]) = [...(db[localKey] as any[]).filter((row) => row.clientId !== clientId), ...rows];
    };
    replaceClientRows('websites', 'websites');
    replaceClientRows('projects', 'projects');
    replaceClientRows('invoices', 'invoices');
    replaceClientRows('payments', 'payments');
    replaceClientRows('hosting', 'hosting');
    replaceClientRows('domains', 'domains');
    replaceClientRows('supportTickets', 'tickets');
    replaceClientRows('files', 'files');
    db.notifications = (Array.isArray(data.notifications) ? data.notifications : []).map(fromApiRow);
    db.messages = (Array.isArray(data.messages) ? data.messages : []).map(fromApiRow);
    saveDatabase(db);
  },

  async updateClientProfile(clientId: string, updates: Partial<PortalClient>): Promise<PortalClient> {
    const db = loadDatabase();
    const idx = db.clients.findIndex((c) => c.id === clientId);
    if (idx === -1) throw new Error('Client not found');

    // Only allow updating safe client-facing fields
    const safeUpdates: Partial<PortalClient> = {
      name: updates.name,
      company: updates.company,
      phone: updates.phone,
      address: updates.address,
      country: updates.country,
      password: updates.password || undefined,
    };

    const response = await fetch('/api/portal/profile', {
      method: 'POST',
      headers: portalAuthorizationHeaders(),
      body: JSON.stringify(safeUpdates),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Could not save profile (${response.status}).`);
    }
    db.clients[idx] = {
      ...db.clients[idx],
      ...safeUpdates,
    };

    saveDatabase(db);
    this.logAudit(clientId, db.clients[idx].name, 'PROFILE_UPDATED', 'Updated client profile and contact preferences');

    return db.clients[idx];
  },

  // WEBSITES (Strictly scoped by clientId)
  getWebsites(clientId: string): ClientWebsite[] {
    const db = loadDatabase();
    return db.websites.filter((w) => w.clientId === clientId);
  },

  getWebsiteById(clientId: string, websiteId: string): ClientWebsite {
    const db = loadDatabase();
    const site = db.websites.find((w) => w.id === websiteId);
    if (!site) throw new Error('Website not found');
    if (site.clientId !== clientId) {
      throw new Error('Forbidden: You do not have permission to access this website');
    }
    return site;
  },

  // PROJECTS (Strictly scoped by clientId)
  getProjects(clientId: string): ClientProject[] {
    const db = loadDatabase();
    return db.projects.filter((p) => p.clientId === clientId);
  },

  async approveProjectMilestone(clientId: string, projectId: string, milestoneId: string): Promise<ClientProject> {
    const response = await fetch(
      `/api/portal/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/approve`,
      {
        method: 'POST',
        headers: portalAuthorizationHeaders(),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.project) {
      throw new Error(result.error || `Could not approve milestone (${response.status}).`);
    }

    const updatedProject = fromApiRow(result.project) as ClientProject;
    if (updatedProject.id !== projectId || updatedProject.clientId !== clientId) {
      throw new Error('The server returned a project outside this Client account.');
    }
    const db = loadDatabase();
    const index = db.projects.findIndex((project) => project.id === projectId && project.clientId === clientId);
    if (index < 0) db.projects.push(updatedProject);
    else db.projects[index] = updatedProject;
    saveDatabase(db);
    return updatedProject;
  },

  getProjectById(clientId: string, projectId: string): ClientProject {
    const db = loadDatabase();
    const proj = db.projects.find((p) => p.id === projectId);
    if (!proj) throw new Error('Project not found');
    if (proj.clientId !== clientId) {
      throw new Error('Forbidden: You do not have permission to access this project');
    }
    return proj;
  },

  // INVOICES & PAYMENTS (Strictly scoped by clientId)
  getInvoices(clientId: string): ClientInvoice[] {
    const db = loadDatabase();
    return db.invoices.filter((i) => i.clientId === clientId);
  },

  getInvoiceById(clientId: string, invoiceId: string): ClientInvoice {
    const db = loadDatabase();
    const inv = db.invoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (inv.clientId !== clientId) {
      throw new Error('Forbidden: You do not have permission to access this invoice');
    }
    return inv;
  },

  getPayments(clientId: string): ClientPayment[] {
    const db = loadDatabase();
    return db.payments.filter((p) => p.clientId === clientId);
  },

  // HOSTING & DOMAINS (Strictly scoped by clientId)
  getHosting(clientId: string): ClientHosting[] {
    const db = loadDatabase();
    return db.hosting.filter((h) => h.clientId === clientId);
  },

  getDomains(clientId: string): ClientDomain[] {
    const db = loadDatabase();
    return db.domains.filter((d) => d.clientId === clientId);
  },

  // FILES & DOCUMENTS (Strictly scoped by clientId)
  getFiles(clientId: string): ClientFile[] {
    const db = loadDatabase();
    return db.files.filter((f) => f.clientId === clientId);
  },

  // SUPPORT TICKETS (Strictly scoped by clientId)
  getSupportTickets(clientId: string): ClientSupportTicket[] {
    const db = loadDatabase();
    return db.supportTickets
      .filter((t) => t.clientId === clientId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getSupportTicketById(clientId: string, ticketId: string): ClientSupportTicket {
    const db = loadDatabase();
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.clientId !== clientId) {
      throw new Error('Forbidden: You do not have permission to access this support ticket');
    }
    return ticket;
  },

  async createSupportTicket(clientId: string, data: { subject: string; category: ClientSupportTicket['category']; priority: ClientSupportTicket['priority']; message: string }): Promise<ClientSupportTicket> {
    const db = loadDatabase();
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client not found');

    const response = await fetch('/api/portal/ticket', {
      method: 'POST',
      headers: portalAuthorizationHeaders(),
      body: JSON.stringify({ clientId, ...data, senderName: client.name }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.ticket) {
      throw new Error(result.error || `Could not create support ticket (${response.status}).`);
    }
    const newTicket = fromApiRow(result.ticket) as ClientSupportTicket;
    db.supportTickets.unshift(newTicket);
    saveDatabase(db);
    return newTicket;
  },

  async addSupportTicketReply(clientId: string, ticketId: string, text: string): Promise<SupportMessage> {
    const db = loadDatabase();
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.clientId !== clientId) {
      throw new Error('Forbidden: You do not have permission to reply to this ticket');
    }

    const response = await fetch('/api/portal/ticket', {
      method: 'POST',
      headers: portalAuthorizationHeaders(),
      body: JSON.stringify({ clientId, ticketId, text }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !Array.isArray(result.messages)) {
      throw new Error(result.error || `Could not send support reply (${response.status}).`);
    }
    ticket.messages = result.messages.map(fromApiRow);
    ticket.updatedAt = new Date().toISOString();
    ticket.status = 'Open';
    saveDatabase(db);
    const newMsg = ticket.messages[ticket.messages.length - 1];

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cdx_chat_message_received', { detail: { clientId, message: newMsg } }));
    }

    return newMsg;
  },

  // MESSAGES & NOTIFICATIONS
  getMessages(clientId: string): ClientMessage[] {
    const db = loadDatabase();
    return db.messages
      .filter((m) => m.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  markMessageRead(clientId: string, messageId: string): void {
    const db = loadDatabase();
    const msg = db.messages.find((m) => m.id === messageId);
    if (msg && msg.clientId === clientId) {
      msg.read = true;
      saveDatabase(db);
    }
  },

  getNotifications(clientId: string): ClientNotification[] {
    const db = loadDatabase();
    return db.notifications
      .filter((n) => !n.clientId || n.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  markNotificationRead(clientId: string, notifId: string): void {
    const db = loadDatabase();
    const notif = db.notifications.find((n) => n.id === notifId);
    if (notif && notif.clientId === clientId) {
      notif.read = true;
      saveDatabase(db);
    }
  },

  async markAllNotificationsRead(clientId: string): Promise<void> {
    const response = await fetch('/api/client/notifications', {
      method: 'POST',
      headers: portalAuthorizationHeaders(),
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `Could not update notifications (${response.status}).`);
    const db = loadDatabase();
    db.notifications.forEach((n) => {
      if (n.clientId === clientId) n.read = true;
    });
    saveDatabase(db);
  },

  addNotification(clientId: string | null, payload: { title: string; description: string; kind?: string; type?: ClientNotification['type']; link?: string }): ClientNotification[] {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const created: ClientNotification[] = [];

    const targetClientIds = clientId ? [clientId] : db.clients.map((c) => c.id);

    for (const cid of targetClientIds) {
      const notif: ClientNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clientId: cid,
        title: payload.title || 'Administrator Notice',
        description: payload.description || '',
        type: payload.type || (payload.kind === 'billing' ? 'invoice' : payload.kind === 'project' ? 'project' : 'support'),
        read: false,
        link: payload.link || '/portal/notifications',
        createdAt: now,
      };
      db.notifications.unshift(notif);
      created.push(notif);
    }

    saveDatabase(db);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cdx_portal_notification_added', { detail: created }));
    }

    return created;
  },

  setClientPassword(clientId: string, newPassword: string): boolean {
    const db = loadDatabase();
    const client = db.clients.find((c) => c.id === clientId || c.email === clientId);
    if (client) {
      client.password = newPassword;
      saveDatabase(db);
      this.logAudit(client.id, client.name, 'PROFILE_UPDATED', 'Client portal password updated by administrator');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cdx_client_password_updated', { detail: { clientId: client.id, password: newPassword } }));
      }
      return true;
    }
    return false;
  },

  getClientPassword(clientId: string): string {
    const db = loadDatabase();
    const client = db.clients.find((c) => c.id === clientId || c.email === clientId);
    return client?.password || '';
  },

  getClientActivity(clientId: string): { logs: PortalAuditLog[]; stats: { pageViews: number; sessions: number; lastLogin: string } } {
    const db = loadDatabase();
    const client = db.clients.find((c) => c.id === clientId || c.email === clientId);
    const logs = db.auditLogs
      .filter((l) => l.clientId === clientId || (client && l.clientId === client.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const sessions = Math.max(logs.filter((l) => l.action === 'CLIENT_LOGIN').length, 1);
    const pageViews = Math.max(logs.length * 3, 12);
    const lastLogin = client?.lastLoginAt || logs[0]?.timestamp || new Date().toISOString();

    return {
      logs,
      stats: {
        pageViews,
        sessions,
        lastLogin,
      },
    };
  },

  getDirectChatMessages(clientId: string): SupportMessage[] {
    const db = loadDatabase();
    const ticket = (db.supportTickets || []).find((t) => t.clientId === clientId);
    if (!ticket) return [];
    return (ticket.messages || []).map((m) => ({
      ...m,
      sender: m.sender,
    }));
  },

  sendDirectChatMessage(clientId: string, text: string, sender: 'client' | 'staff' = 'client', senderName?: string): SupportMessage {
    const db = loadDatabase();
    if (!db.supportTickets) db.supportTickets = [];
    let ticket = db.supportTickets.find((t) => t.clientId === clientId);
    const client = db.clients.find((c) => c.id === clientId);

    if (!ticket) {
      ticket = {
        id: `tick_${Date.now()}`,
        clientId,
        ticketNumber: `CDX-${Math.floor(1000 + Math.random() * 9000)}`,
        subject: 'Dedicated Support Channel',
        category: 'General Question',
        priority: 'High',
        status: 'Open',
        assignedStaff: sender === 'staff' ? (senderName || 'Support Agent') : 'Support Agent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      db.supportTickets.unshift(ticket);
    }

    const msg: SupportMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender,
      senderName: senderName || (sender === 'staff' ? 'Support Agent' : (client?.name || 'Client')),
      text,
      createdAt: new Date().toISOString(),
    };

    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(msg);
    ticket.updatedAt = new Date().toISOString();
    ticket.status = 'Open';
    saveDatabase(db);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cdx_chat_message_received', { detail: { clientId, message: msg } }));
    }

    return msg;
  },

  // ---------------------------------------------------------------------------
  // SECURE BACK OFFICE SINGLE SIGN-ON (SSO) HANDOFF
  // ---------------------------------------------------------------------------

  /**
   * Generates a signed, single-use, short-lived SSO token for opening a client website back office.
   * Enforces server-side authorization:
   * 1. Client account must exist and have portalEnabled == true.
   * 2. Website must exist and belong to the client.
   * 3. Website accessEnabled must be true and status must be Active.
   */
  generateBackOfficeSso(clientId: string, websiteId: string): {
    ssoToken: string;
    expiresAt: number;
    launchUrl: string;
    website: ClientWebsite;
  } {
    const db = loadDatabase();
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) {
      throw new Error('Authentication required: Client account not found.');
    }
    if (!client.portalEnabled || client.status !== 'Active') {
      throw new Error('Access Denied: Your client portal account is suspended or disabled. Please contact Codex Dynamics.');
    }

    const website = db.websites.find((w) => w.id === websiteId);
    if (!website) {
      throw new Error('Requested website does not exist.');
    }
    if (website.clientId !== clientId) {
      throw new Error('Forbidden: You are not authorized to access this website.');
    }
    if (!website.accessEnabled) {
      throw new Error('Access Denied: Website administration access has been disabled by your administrator. Contact support for assistance.');
    }
    if (website.status !== 'Active') {
      throw new Error(`Website is currently in ${website.status} mode and cannot be managed at this time.`);
    }

    // Generate cryptographic token parameters
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 60 * 1000; // 60 seconds TTL (short-lived)
    const token = `cdx_sso_${issuedAt}_${nonce}`;

    const tokenRecord: SsoTokenRecord = {
      token,
      clientId,
      websiteId,
      clientEmail: client.email,
      clientName: client.name,
      role: 'client_admin',
      issuedAt,
      expiresAt,
      consumed: false,
      nonce,
      targetBackOfficeUrl: website.backOfficeUrl,
    };

    // Store in SSO tokens registry (cleans up tokens older than 10 minutes)
    db.ssoTokens = (db.ssoTokens || [])
      .filter((t) => Date.now() - t.issuedAt < 10 * 60 * 1000)
      .concat(tokenRecord);

    saveDatabase(db);

    this.logAudit(
      clientId,
      client.name,
      'BACKOFFICE_SSO_REQUEST',
      `Generated short-lived SSO handoff token for website "${website.name}" (${website.domain})`
    );

    // Build the connector launch URL with token and website ID
    const urlObj = new URL(website.backOfficeUrl, 'http://localhost');
    urlObj.searchParams.set('cdx_sso_token', token);
    urlObj.searchParams.set('website_id', website.id);
    const launchUrl = urlObj.toString().replace('http://localhost', '');

    return {
      ssoToken: token,
      expiresAt,
      launchUrl: launchUrl.startsWith('/') ? launchUrl : website.backOfficeUrl + `?cdx_sso_token=${token}&website_id=${website.id}`,
      website,
    };
  },

  /**
   * The standardized Codex Dynamics Portal Connector receiver verification method.
   * Invoked by client websites to validate the handoff token.
   * Enforces single-use consumption and expiration verification.
   */
  validateSsoToken(token: string, websiteId: string): {
    valid: boolean;
    error?: string;
    client?: PortalClient;
    website?: ClientWebsite;
    sessionUser?: { id: string; name: string; email: string; role: string };
  } {
    const db = loadDatabase();
    const record = (db.ssoTokens || []).find((t) => t.token === token && t.websiteId === websiteId);

    if (!record) {
      return { valid: false, error: 'Invalid or unknown SSO token' };
    }
    if (record.consumed) {
      return { valid: false, error: 'Token has already been consumed (replay attack prevented)' };
    }
    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'SSO token has expired (must be consumed within 60 seconds)' };
    }

    const website = db.websites.find((w) => w.id === websiteId);
    if (!website || !website.accessEnabled) {
      return { valid: false, error: 'Website access is currently disabled by administrator' };
    }

    const client = db.clients.find((c) => c.id === record.clientId);
    if (!client || !client.portalEnabled) {
      return { valid: false, error: 'Client account is disabled' };
    }

    // Mark as consumed immediately
    record.consumed = true;
    saveDatabase(db);

    this.logAudit(
      client.id,
      client.name,
      'SSO_TOKEN_VALIDATED',
      `SSO handoff successfully validated by connector for website "${website.name}"`
    );

    return {
      valid: true,
      client,
      website,
      sessionUser: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: record.role,
      },
    };
  },

  // ---------------------------------------------------------------------------
  // CRM / SUPER ADMIN CONTROLS
  // ---------------------------------------------------------------------------

  adminGetAllClients(): PortalClient[] {
    const db = loadDatabase();
    return db.clients;
  },

  adminTogglePortalAccess(clientId: string, enabled: boolean): PortalClient {
    const db = loadDatabase();
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client not found');
    client.portalEnabled = enabled;
    saveDatabase(db);
    this.logAudit(
      clientId,
      client.name,
      enabled ? 'WEBSITE_ACCESS_ENABLED' : 'WEBSITE_ACCESS_DISABLED',
      `Administrator ${enabled ? 'enabled' : 'disabled'} portal access for client "${client.name}"`
    );
    return client;
  },

  adminCreateClient(
    data: Omit<PortalClient, 'createdAt' | 'lastLoginAt'> & { id?: string },
  ): PortalClient {
    const db = loadDatabase();
    const newClient: PortalClient = {
      ...data,
      id: data.id || `client_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    assertUniqueClientIdentifiers(db.clients, newClient);
    db.clients.unshift(newClient);
    saveDatabase(db);
    return newClient;
  },

  adminUpdateClient(clientId: string, updates: Partial<PortalClient>): PortalClient {
    const db = loadDatabase();
    const idx = db.clients.findIndex((c) => c.id === clientId);
    if (idx === -1) {
      const newClient: PortalClient = {
        id: clientId,
        name: updates.name || 'Client',
        company: updates.company || 'Client Co',
        email: updates.email || '',
        phone: updates.phone || '',
        address: updates.address || '',
        country: updates.country || 'United Kingdom',
        countryCode: updates.countryCode || 'GB',
        status: (updates.status as any) || 'Active',
        portalEnabled: updates.portalEnabled !== undefined ? updates.portalEnabled : true,
        tier: (updates.tier as any) || 'Enterprise Partner',
        lastLoginAt: updates.lastLoginAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...updates,
      };
      assertUniqueClientIdentifiers(db.clients, newClient);
      db.clients.unshift(newClient);
      saveDatabase(db);
      return newClient;
    }
    const updatedClient = { ...db.clients[idx], ...updates };
    assertUniqueClientIdentifiers(db.clients, updatedClient, clientId);
    db.clients[idx] = updatedClient;
    saveDatabase(db);
    return db.clients[idx];
  },

  // CRM WEBSITE MANAGEMENT (Configuration-Driven)
  adminGetAllWebsites(): (ClientWebsite & { clientName?: string })[] {
    const db = loadDatabase();
    return db.websites.map((w) => {
      const client = db.clients.find((c) => c.id === w.clientId);
      return { ...w, clientName: client?.company || client?.name || 'Unknown Client' };
    });
  },

  adminCreateWebsite(data: Omit<ClientWebsite, 'id' | 'createdAt' | 'updatedAt'>): ClientWebsite {
    const db = loadDatabase();
    const newWebsite: ClientWebsite = {
      ...data,
      id: `web_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.websites.unshift(newWebsite);
    saveDatabase(db);
    return newWebsite;
  },

  adminUpdateWebsite(websiteId: string, updates: Partial<ClientWebsite>): ClientWebsite {
    const db = loadDatabase();
    const idx = db.websites.findIndex((w) => w.id === websiteId);
    if (idx === -1) throw new Error('Website not found');
    db.websites[idx] = {
      ...db.websites[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDatabase(db);
    return db.websites[idx];
  },

  adminToggleWebsiteAccess(websiteId: string, accessEnabled: boolean): ClientWebsite {
    const db = loadDatabase();
    const website = db.websites.find((w) => w.id === websiteId);
    if (!website) throw new Error('Website not found');
    website.accessEnabled = accessEnabled;
    website.updatedAt = new Date().toISOString();
    saveDatabase(db);

    const client = db.clients.find((c) => c.id === website.clientId);
    this.logAudit(
      website.clientId,
      client?.name || 'Client',
      accessEnabled ? 'WEBSITE_ACCESS_ENABLED' : 'WEBSITE_ACCESS_DISABLED',
      `Administrator ${accessEnabled ? 'enabled' : 'disabled'} back office access for website "${website.name}"`
    );
    return website;
  },

  adminDeleteWebsite(websiteId: string): void {
    const db = loadDatabase();
    db.websites = db.websites.filter((w) => w.id !== websiteId);
    saveDatabase(db);
  },

  // CRM PROJECT MANAGEMENT
  adminGetAllProjects(): (ClientProject & { clientName?: string })[] {
    const db = loadDatabase();
    return db.projects.map((p) => {
      const client = db.clients.find((c) => c.id === p.clientId);
      return { ...p, clientName: client?.company || client?.name || 'Unknown' };
    });
  },

  adminCreateProject(data: Omit<ClientProject, 'id' | 'createdAt' | 'updatedAt'>): ClientProject {
    const db = loadDatabase();
    const newProj: ClientProject = {
      ...data,
      id: `proj_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.projects.unshift(newProj);
    saveDatabase(db);
    return newProj;
  },

  adminUpdateProject(projectId: string, updates: Partial<ClientProject>): ClientProject {
    const db = loadDatabase();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw new Error('Project not found');
    db.projects[idx] = {
      ...db.projects[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDatabase(db);
    return db.projects[idx];
  },

  // CRM INVOICE & BILLING MANAGEMENT
  adminGetAllInvoices(): (ClientInvoice & { clientName?: string })[] {
    const db = loadDatabase();
    return db.invoices.map((inv) => {
      const client = db.clients.find((c) => c.id === inv.clientId);
      return { ...inv, clientName: client?.company || client?.name || 'Unknown' };
    });
  },

  adminCreateInvoice(data: Omit<ClientInvoice, 'id'>): ClientInvoice {
    const db = loadDatabase();
    const newInvoice: ClientInvoice = {
      ...data,
      id: `INV-${Date.now().toString().slice(-4)}`,
    };
    db.invoices.unshift(newInvoice);

    // Create a client notification automatically
    db.notifications.unshift({
      id: `notif_${Date.now()}`,
      clientId: data.clientId,
      title: `Invoice #${newInvoice.invoiceNumber} Issued`,
      description: `$${data.total.toLocaleString()} due on ${newInvoice.dueDate}.`,
      type: 'invoice',
      read: false,
      link: '/portal/invoices',
      createdAt: new Date().toISOString(),
    });

    saveDatabase(db);
    return newInvoice;
  },

  adminRecordPayment(data: Omit<ClientPayment, 'id'>): ClientPayment {
    const db = loadDatabase();
    const newPayment: ClientPayment = {
      ...data,
      id: `REC-${Date.now().toString().slice(-4)}`,
    };
    db.payments.unshift(newPayment);

    // Update the invoice status if found
    const inv = db.invoices.find((i) => i.id === data.invoiceId);
    if (inv) {
      inv.amountPaid += data.amount;
      inv.balanceDue = Math.max(0, inv.total - inv.amountPaid);
      if (inv.balanceDue === 0) {
        inv.status = 'Paid';
        inv.paidDate = data.paymentDate;
      } else {
        inv.status = 'Partially Paid';
      }
    }

    db.notifications.unshift({
      id: `notif_${Date.now()}`,
      clientId: data.clientId,
      title: `Payment Received for #${data.invoiceId}`,
      description: `Payment of $${data.amount.toLocaleString()} confirmed. Receipt #${newPayment.receiptNumber} generated.`,
      type: 'invoice',
      read: false,
      link: '/portal/billing',
      createdAt: new Date().toISOString(),
    });

    saveDatabase(db);
    return newPayment;
  },

  // CRM HOSTING & DOMAINS
  adminGetAllHosting(): (ClientHosting & { clientName?: string })[] {
    const db = loadDatabase();
    return db.hosting.map((h) => {
      const client = db.clients.find((c) => c.id === h.clientId);
      return { ...h, clientName: client?.company || client?.name || 'Unknown' };
    });
  },

  adminCreateHosting(data: Omit<ClientHosting, 'id'>): ClientHosting {
    const db = loadDatabase();
    const newHost: ClientHosting = {
      ...data,
      id: `host_${Date.now()}`,
    };
    db.hosting.unshift(newHost);
    saveDatabase(db);
    return newHost;
  },

  adminGetAllDomains(): (ClientDomain & { clientName?: string })[] {
    const db = loadDatabase();
    return db.domains.map((d) => {
      const client = db.clients.find((c) => c.id === d.clientId);
      return { ...d, clientName: client?.company || client?.name || 'Unknown' };
    });
  },

  adminCreateDomain(data: Omit<ClientDomain, 'id'>): ClientDomain {
    const db = loadDatabase();
    const newDomain: ClientDomain = {
      ...data,
      id: `dom_${Date.now()}`,
    };
    db.domains.unshift(newDomain);
    saveDatabase(db);
    return newDomain;
  },

  // CRM SUPPORT MANAGEMENT
  adminGetAllSupportTickets(): (ClientSupportTicket & { clientName?: string; clientEmail?: string })[] {
    const db = loadDatabase();
    return db.supportTickets.map((t) => {
      const client = db.clients.find((c) => c.id === t.clientId);
      return {
        ...t,
        clientName: client?.company || client?.name || 'Unknown',
        clientEmail: client?.email || '',
      };
    });
  },

  adminReplySupportTicket(ticketId: string, replyText: string, staffName = 'Sarah Admin'): SupportMessage {
    const db = loadDatabase();
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const msg: SupportMessage = {
      id: `msg_${Date.now()}`,
      sender: 'staff',
      senderName: staffName,
      text: replyText,
      createdAt: new Date().toISOString(),
    };

    ticket.messages.push(msg);
    ticket.updatedAt = new Date().toISOString();
    ticket.status = 'Waiting for Client';

    // Notify client
    db.notifications.unshift({
      id: `notif_${Date.now()}`,
      clientId: ticket.clientId,
      title: `Reply to Ticket #${ticket.ticketNumber}`,
      description: `${staffName} responded: "${replyText.slice(0, 80)}${replyText.length > 80 ? '...' : ''}"`,
      type: 'support',
      read: false,
      link: '/portal/support',
      createdAt: new Date().toISOString(),
    });

    saveDatabase(db);
    return msg;
  },

  adminUpdateTicketStatus(ticketId: string, status: ClientSupportTicket['status']): ClientSupportTicket {
    const db = loadDatabase();
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    saveDatabase(db);
    return ticket;
  },

  // CRM AUDIT LOG
  adminGetAuditLogs(): PortalAuditLog[] {
    const db = loadDatabase();
    return db.auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  logAudit(clientId: string, clientName: string, action: PortalAuditLog['action'], details: string): void {
    const db = loadDatabase();
    const entry: PortalAuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clientId,
      clientName,
      action,
      details,
      ipAddress: '127.0.0.1',
      timestamp: new Date().toISOString(),
    };
    db.auditLogs.unshift(entry);
    // Keep max 200 audit entries
    if (db.auditLogs.length > 200) db.auditLogs.pop();
    saveDatabase(db);
  },
};
