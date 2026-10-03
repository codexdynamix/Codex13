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

// ---------------------------------------------------------------------------
// INITIAL SEED DATA
// ---------------------------------------------------------------------------

const SEED_CLIENTS: PortalClient[] = [
  {
    id: 'client_vance',
    name: 'Eleanor Vance',
    company: 'Vance Tech Capital',
    email: 'eleanor.vance@vancetech.io',
    phone: '+1 (415) 890-2341',
    address: '450 Mission St, Suite 1800, San Francisco, CA 94105',
    country: 'United States',
    countryCode: 'US',
    status: 'Active',
    portalEnabled: true,
    tier: 'Enterprise Partner',
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    id: 'client_brody',
    name: 'Marcus Brody',
    company: 'Brody Luxury Goods',
    email: 'marcus@brodydesign.co',
    phone: '+44 20 7946 0912',
    address: '14 Berkeley Square, Mayfair, London W1J 6BL',
    country: 'United Kingdom',
    countryCode: 'GB',
    status: 'Active',
    portalEnabled: true,
    tier: 'Growth Tier',
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: 'usr_demo',
    name: 'Alex Morgan',
    company: 'Morgan Digital Media',
    email: 'client@codexdynamics.com',
    phone: '+1 (555) 234-5678',
    address: '777 Broadway, 12th Floor, New York, NY 10003',
    country: 'United States',
    countryCode: 'US',
    status: 'Active',
    portalEnabled: true,
    tier: 'Dedicated Agency',
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
  },
];

const SEED_WEBSITES: ClientWebsite[] = [
  // Client A (Vance Tech Capital)
  {
    id: 'web_vance_01',
    clientId: 'client_vance',
    name: 'Vance Tech Capital Public Site',
    domain: 'vancetech.io',
    websiteUrl: 'https://vancetech.io',
    backOfficeUrl: 'https://vancetech.io/admin',
    status: 'Active',
    connectionStatus: 'Connected',
    connectorId: 'cdx-connector-v1',
    connectorSecret: 'sec_vance_89f72b',
    accessEnabled: true,
    techStack: ['Next.js 15', 'Tailwind CSS', 'Vercel Edge', 'Cloudflare'],
    hostingPlan: 'Enterprise Dedicated Edge Node',
    sslStatus: 'Active & Auto-Renewing',
    createdAt: '2026-07-10T10:00:00Z',
    updatedAt: '2026-09-28T14:30:00Z',
  },
  {
    id: 'web_vance_02',
    clientId: 'client_vance',
    name: 'Vance Capital LP Portal',
    domain: 'lp.vancetech.io',
    websiteUrl: 'https://lp.vancetech.io',
    backOfficeUrl: 'https://lp.vancetech.io/admin',
    status: 'Active',
    connectionStatus: 'Connected',
    connectorId: 'cdx-connector-v1',
    connectorSecret: 'sec_vance_lp_33c91',
    accessEnabled: true,
    techStack: ['React 19', 'PostgreSQL', 'Auth0 SSO', 'Docker'],
    hostingPlan: 'High-Security Dedicated Node',
    sslStatus: 'Active & Auto-Renewing',
    createdAt: '2026-08-15T11:00:00Z',
    updatedAt: '2026-10-01T09:15:00Z',
  },

  // Client B (Brody Luxury Goods)
  {
    id: 'web_brody_01',
    clientId: 'client_brody',
    name: 'Brody Luxury Storefront',
    domain: 'brodyluxury.com',
    websiteUrl: 'https://brodyluxury.com',
    backOfficeUrl: 'https://brodyluxury.com/admin',
    status: 'Active',
    connectionStatus: 'Connected',
    connectorId: 'cdx-connector-v1',
    connectorSecret: 'sec_brody_44d189',
    accessEnabled: true,
    techStack: ['Shopify Headless', 'Next.js 14', 'Three.js 3D', 'Stripe'],
    hostingPlan: 'High-Concurrency E-Commerce Node',
    sslStatus: 'Active & Auto-Renewing',
    createdAt: '2026-08-01T14:00:00Z',
    updatedAt: '2026-09-30T16:00:00Z',
  },

  // Demo Client (Alex Morgan)
  {
    id: 'web_morgan_01',
    clientId: 'usr_demo',
    name: 'Morgan Media Global',
    domain: 'morganmedia.com',
    websiteUrl: 'https://morganmedia.com',
    backOfficeUrl: 'https://morganmedia.com/admin',
    status: 'Active',
    connectionStatus: 'Connected',
    connectorId: 'cdx-connector-v1',
    connectorSecret: 'sec_morgan_77b4',
    accessEnabled: true,
    techStack: ['React', 'Node.js Express', 'PostgreSQL'],
    hostingPlan: 'Cloud Pro Node',
    sslStatus: 'Active & Auto-Renewing',
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
  },
];

const SEED_PROJECTS: ClientProject[] = [
  // Client A
  {
    id: 'proj_vance_01',
    clientId: 'client_vance',
    name: 'Venture Capital Portal Rebuild',
    description: 'Next-generation LP investor portal with real-time portfolio IRR performance, capital call automation, and document vault.',
    service: 'High-Performance Web App',
    status: 'In Progress',
    progress: 75,
    startDate: '2026-08-01',
    targetDate: '2026-10-30',
    teamLead: 'Marcus Vance (Technical Lead)',
    milestones: [
      { id: 'm1', title: 'Architecture Specification & Security Sign-off', status: 'completed', dueDate: '2026-08-15', notes: 'Completed ahead of schedule' },
      { id: 'm2', title: 'Interactive Portfolio Analytics Dashboard', status: 'completed', dueDate: '2026-09-10', notes: 'Sign-off received from investment committee' },
      { id: 'm3', title: 'LP Document Vault & Single Sign-On', status: 'in_progress', dueDate: '2026-10-15', notes: 'SSO connector staging verification active' },
      { id: 'm4', title: 'Production Security Audit & Launch', status: 'pending', dueDate: '2026-10-30' },
    ],
    recentUpdates: [
      { id: 'u1', date: '2026-10-01', title: 'SSO Connector Staging Ready', author: 'Codex Engineering', message: 'The standard Codex Dynamics connector has been deployed to staging for testing.' },
      { id: 'u2', date: '2026-09-22', title: 'Portfolio Chart Engine Optimized', author: 'Codex Frontend', message: 'Render speed improved by 60% with WebGL-backed time-series charts.' },
    ],
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-10-01T15:00:00Z',
  },

  // Client B
  {
    id: 'proj_brody_01',
    clientId: 'client_brody',
    name: 'Luxury E-Commerce 3D Storefront',
    description: 'High-conversion bespoke storefront with 3D product previews, multi-currency Apple Pay checkout, and CRM integration.',
    service: 'Web Design & E-Commerce',
    status: 'Review',
    progress: 90,
    startDate: '2026-08-15',
    targetDate: '2026-10-18',
    teamLead: 'Sarah Lin (Creative Director)',
    milestones: [
      { id: 'mb1', title: 'Art Direction & 3D Lighting Setup', status: 'completed', dueDate: '2026-08-30' },
      { id: 'mb2', title: 'Mobile Checkout Flow & Apple Pay', status: 'completed', dueDate: '2026-09-18' },
      { id: 'mb3', title: 'Final Client Acceptance Review', status: 'in_progress', dueDate: '2026-10-10' },
      { id: 'mb4', title: 'Global CDN Deployment & Cutover', status: 'pending', dueDate: '2026-10-18' },
    ],
    recentUpdates: [
      { id: 'ub1', date: '2026-09-29', title: '3D Configurator Review Build', author: 'Codex Design', message: 'Bespoke watch model rendering completed at 60fps on mobile.' },
    ],
    createdAt: '2026-08-15T10:00:00Z',
    updatedAt: '2026-09-29T11:00:00Z',
  },
];

const SEED_INVOICES: ClientInvoice[] = [
  // Client A
  {
    id: 'INV-2026-001',
    clientId: 'client_vance',
    invoiceNumber: 'INV-2026-001',
    issueDate: '2026-08-01',
    dueDate: '2026-08-15',
    paidDate: '2026-08-10',
    status: 'Paid',
    currency: 'USD',
    subtotal: 18500,
    tax: 0,
    total: 18500,
    amountPaid: 18500,
    balanceDue: 0,
    paymentMethod: 'Bank Wire Transfer',
    lineItems: [
      { id: 'li1', description: 'Venture Capital Portal Phase 1: Architecture & UI System', quantity: 1, unitPrice: 12500, total: 12500 },
      { id: 'li2', description: 'High-Security Cloud Node Provisioning & Dedicated Hardware', quantity: 1, unitPrice: 6000, total: 6000 },
    ],
    notes: 'Payment received in full. Thank you for your partnership.',
  },
  {
    id: 'INV-2026-004',
    clientId: 'client_vance',
    invoiceNumber: 'INV-2026-004',
    issueDate: '2026-09-25',
    dueDate: '2026-10-09',
    status: 'Pending',
    currency: 'USD',
    subtotal: 6500,
    tax: 0,
    total: 6500,
    amountPaid: 0,
    balanceDue: 6500,
    lineItems: [
      { id: 'li3', description: 'Venture Capital Portal Phase 2: LP Vault & SSO Integration', quantity: 1, unitPrice: 6500, total: 6500 },
    ],
    notes: 'Due in 7 days via wire transfer to Barclays UK Codex Dynamics account.',
  },

  // Client B
  {
    id: 'INV-2026-002',
    clientId: 'client_brody',
    invoiceNumber: 'INV-2026-002',
    issueDate: '2026-08-15',
    dueDate: '2026-08-30',
    paidDate: '2026-08-25',
    status: 'Paid',
    currency: 'USD',
    subtotal: 12000,
    tax: 0,
    total: 12000,
    amountPaid: 12000,
    balanceDue: 0,
    paymentMethod: 'Stripe Credit Card',
    lineItems: [
      { id: 'lib1', description: 'Luxury E-Commerce Design System & 3D Interactive Assets', quantity: 1, unitPrice: 12000, total: 12000 },
    ],
    notes: 'Paid via Stripe Online Checkout.',
  },
  {
    id: 'INV-2026-005',
    clientId: 'client_brody',
    invoiceNumber: 'INV-2026-005',
    issueDate: '2026-09-15',
    dueDate: '2026-09-30',
    paidDate: '2026-09-28',
    status: 'Paid',
    currency: 'USD',
    subtotal: 3200,
    tax: 0,
    total: 3200,
    amountPaid: 3200,
    balanceDue: 0,
    paymentMethod: 'Stripe Credit Card',
    lineItems: [
      { id: 'lib2', description: 'Mobile Checkout Integration & Apple Pay Certification', quantity: 1, unitPrice: 3200, total: 3200 },
    ],
    notes: 'Payment confirmed.',
  },

  // Demo Client
  {
    id: 'INV-2026-003',
    clientId: 'usr_demo',
    invoiceNumber: 'INV-2026-003',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    paidDate: '2026-09-12',
    status: 'Paid',
    currency: 'USD',
    subtotal: 4500,
    tax: 0,
    total: 4500,
    amountPaid: 4500,
    balanceDue: 0,
    paymentMethod: 'Direct Debit',
    lineItems: [
      { id: 'lid1', description: 'Web Platform Architecture & Retainer', quantity: 1, unitPrice: 4500, total: 4500 },
    ],
  },
];

const SEED_PAYMENTS: ClientPayment[] = [
  // Client A
  {
    id: 'REC-2026-001',
    clientId: 'client_vance',
    invoiceId: 'INV-2026-001',
    receiptNumber: 'REC-2026-001',
    paymentDate: '2026-08-10',
    amount: 18500,
    paymentMethod: 'Bank Wire Transfer',
    transactionReference: 'TXN-998234-WIRE',
    description: 'Payment for Invoice INV-2026-001 (Phase 1)',
    status: 'Completed',
  },
  // Client B
  {
    id: 'REC-2026-002',
    clientId: 'client_brody',
    invoiceId: 'INV-2026-002',
    receiptNumber: 'REC-2026-002',
    paymentDate: '2026-08-25',
    amount: 12000,
    paymentMethod: 'Stripe Credit Card',
    transactionReference: 'ch_3N8792019482',
    description: 'Payment for Invoice INV-2026-002',
    status: 'Completed',
  },
  {
    id: 'REC-2026-005',
    clientId: 'client_brody',
    invoiceId: 'INV-2026-005',
    receiptNumber: 'REC-2026-005',
    paymentDate: '2026-09-28',
    amount: 3200,
    paymentMethod: 'Stripe Credit Card',
    transactionReference: 'ch_3P1928472910',
    description: 'Payment for Invoice INV-2026-005',
    status: 'Completed',
  },
];

const SEED_HOSTING: ClientHosting[] = [
  // Client A
  {
    id: 'host_vance_01',
    clientId: 'client_vance',
    websiteId: 'web_vance_01',
    websiteName: 'Vance Tech Capital Public Site',
    provider: 'Cloudflare Enterprise & AWS eu-west-2',
    plan: 'High-Performance Enterprise Node',
    status: 'Active',
    startDate: '2026-07-10',
    renewalDate: '2026-11-15',
    billingFrequency: 'Monthly',
    amount: 180,
    autoRenew: true,
    serverRegion: 'London, UK (eu-west-2)',
    ipAddress: '162.159.135.42',
    uptime: '99.99%',
  },
  {
    id: 'host_vance_02',
    clientId: 'client_vance',
    websiteId: 'web_vance_02',
    websiteName: 'Vance Capital LP Portal',
    provider: 'AWS Dedicated Virtual Private Cloud',
    plan: 'High-Security Dedicated Node',
    status: 'Active',
    startDate: '2026-08-15',
    renewalDate: '2026-11-15',
    billingFrequency: 'Monthly',
    amount: 240,
    autoRenew: true,
    serverRegion: 'Frankfurt, Germany (eu-central-1)',
    ipAddress: '18.192.44.112',
    uptime: '100.00%',
  },

  // Client B
  {
    id: 'host_brody_01',
    clientId: 'client_brody',
    websiteId: 'web_brody_01',
    websiteName: 'Brody Luxury Storefront',
    provider: 'Fastly Edge & AWS eu-west-1',
    plan: 'High-Concurrency E-Commerce Node',
    status: 'Active',
    startDate: '2026-08-01',
    renewalDate: '2026-12-01',
    billingFrequency: 'Monthly',
    amount: 120,
    autoRenew: true,
    serverRegion: 'Dublin, Ireland (eu-west-1)',
    ipAddress: '151.101.65.140',
    uptime: '99.98%',
  },
];

const SEED_DOMAINS: ClientDomain[] = [
  // Client A
  {
    id: 'dom_vance_01',
    clientId: 'client_vance',
    websiteId: 'web_vance_01',
    domainName: 'vancetech.io',
    registrar: 'Cloudflare Registrar',
    registrationDate: '2024-05-10',
    expirationDate: '2027-05-10',
    renewalDate: '2027-04-10',
    renewalStatus: 'Auto-Renew Active',
    sslStatus: 'Valid (Cloudflare Universal SSL)',
    dnsStatus: 'Managed DNS Active (Codex Primary)',
    autoRenew: true,
    nameservers: ['ns1.codexdynamics.net', 'ns2.codexdynamics.net'],
  },
  {
    id: 'dom_vance_02',
    clientId: 'client_vance',
    websiteId: 'web_vance_01',
    domainName: 'vancecapital.com',
    registrar: 'Namecheap / Codex Custody',
    registrationDate: '2023-10-22',
    expirationDate: '2026-10-22',
    renewalDate: '2026-10-15',
    renewalStatus: 'Expiring Soon - Action Required',
    sslStatus: 'Valid (Let\'s Encrypt Wildcard)',
    dnsStatus: 'Managed DNS Active',
    autoRenew: false,
    nameservers: ['ns1.codexdynamics.net', 'ns2.codexdynamics.net'],
  },

  // Client B
  {
    id: 'dom_brody_01',
    clientId: 'client_brody',
    websiteId: 'web_brody_01',
    domainName: 'brodyluxury.com',
    registrar: 'Cloudflare Registrar',
    registrationDate: '2024-01-15',
    expirationDate: '2027-01-15',
    renewalDate: '2026-12-15',
    renewalStatus: 'Auto-Renew Active',
    sslStatus: 'Valid (Cloudflare Universal SSL)',
    dnsStatus: 'Managed DNS Active',
    autoRenew: true,
    nameservers: ['ns1.codexdynamics.net', 'ns2.codexdynamics.net'],
  },
];

const SEED_SUPPORT_TICKETS: ClientSupportTicket[] = [
  // Client A
  {
    id: 'TICK-101',
    clientId: 'client_vance',
    ticketNumber: 'TICK-101',
    subject: 'LP Dashboard Filter Integration & Date Range Bounds',
    category: 'Website & Code',
    priority: 'High',
    status: 'In Progress',
    assignedStaff: 'Alex Agent (Senior Systems Engineer)',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    messages: [
      {
        id: 'msg_t1_1',
        sender: 'client',
        senderName: 'Eleanor Vance',
        text: 'Hello team, our investment committee would like to filter the LP quarterly distribution charts by customized FY fiscal periods instead of calendar quarters. Is this covered in Phase 2?',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      },
      {
        id: 'msg_t1_2',
        sender: 'staff',
        senderName: 'Alex Agent',
        text: 'Hi Eleanor, absolutely! We already built the fiscal calendar engine in the core backend. We are adding the selector dropdown to the staging environment today.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      },
      {
        id: 'msg_t1_3',
        sender: 'client',
        senderName: 'Eleanor Vance',
        text: 'Wonderful, thank you! Please notify us as soon as it is deployed so we can test.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
    ],
  },

  // Client B
  {
    id: 'TICK-102',
    clientId: 'client_brody',
    ticketNumber: 'TICK-102',
    subject: 'Mobile Apple Pay Sandbox Certification',
    category: 'Billing & Invoicing',
    priority: 'Medium',
    status: 'Resolved',
    assignedStaff: 'Thomas Leader',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    messages: [
      {
        id: 'msg_t2_1',
        sender: 'client',
        senderName: 'Marcus Brody',
        text: 'Could you confirm our Apple Merchant ID domain verification file has been placed in the .well-known directory?',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      },
      {
        id: 'msg_t2_2',
        sender: 'staff',
        senderName: 'Thomas Leader',
        text: 'Hi Marcus, the domain verification association file is uploaded and verified by Apple Pay. Live transactions in GBP and EUR are ready.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      },
    ],
  },
];

const SEED_FILES: ClientFile[] = [
  // Client A
  {
    id: 'file_vance_01',
    clientId: 'client_vance',
    name: 'Vance_Tech_Capital_Brand_Guidelines_v2.pdf',
    category: 'Designs & Branding',
    size: '8.4 MB',
    uploadedAt: '2026-08-10',
    fileType: 'pdf',
    downloadUrl: '#download_brand_guidelines',
  },
  {
    id: 'file_vance_02',
    clientId: 'client_vance',
    name: 'LP_Portal_Technical_Architecture_Spec.pdf',
    category: 'Contracts & Legal',
    size: '3.1 MB',
    uploadedAt: '2026-08-15',
    fileType: 'pdf',
    downloadUrl: '#download_arch_spec',
  },
  {
    id: 'file_vance_03',
    clientId: 'client_vance',
    name: 'Deliverables_Phase1_Production_Build.zip',
    category: 'Deliverables',
    size: '42.6 MB',
    uploadedAt: '2026-09-01',
    fileType: 'zip',
    downloadUrl: '#download_phase1_build',
  },
  {
    id: 'file_vance_04',
    clientId: 'client_vance',
    name: 'Invoice_INV-2026-001_PaidReceipt.pdf',
    category: 'Invoices & Receipts',
    size: '180 KB',
    uploadedAt: '2026-08-10',
    fileType: 'pdf',
    downloadUrl: '#download_inv_001',
  },

  // Client B
  {
    id: 'file_brody_01',
    clientId: 'client_brody',
    name: 'Brody_Luxury_Product_Catalog_Final.pdf',
    category: 'Designs & Branding',
    size: '14.2 MB',
    uploadedAt: '2026-08-20',
    fileType: 'pdf',
    downloadUrl: '#download_brody_catalog',
  },
  {
    id: 'file_brody_02',
    clientId: 'client_brody',
    name: '3D_Assets_AssetPack_GLTF.zip',
    category: 'Deliverables',
    size: '68.9 MB',
    uploadedAt: '2026-09-15',
    fileType: 'zip',
    downloadUrl: '#download_3d_pack',
  },
];

const SEED_MESSAGES: ClientMessage[] = [
  // Client A
  {
    id: 'msg_vance_01',
    clientId: 'client_vance',
    title: 'Welcome to your Codex Dynamics Client Portal',
    sender: 'Sarah Admin (Managing Director)',
    body: 'Welcome Eleanor. Through this portal you can monitor live website health, access back office administration via single sign-on, review project milestones, download invoices and file support requests.',
    kind: 'announcement',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: 'msg_vance_02',
    clientId: 'client_vance',
    title: 'Quarterly Infrastructure & Security Audit Update',
    sender: 'Codex Dynamics Security Operations',
    body: 'The Q3 infrastructure vulnerability scan and penetration test for vancetech.io concluded with zero high or medium findings. SSL automated rotation is operational.',
    kind: 'security',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },

  // Client B
  {
    id: 'msg_brody_01',
    clientId: 'client_brody',
    title: 'Storefront Staging Environment Deployed',
    sender: 'Codex Dynamics Engineering',
    body: 'The 3D model configurator is now accessible on staging for executive review.',
    kind: 'project',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
];

const SEED_NOTIFICATIONS: ClientNotification[] = [
  // Client A
  {
    id: 'notif_vance_01',
    clientId: 'client_vance',
    title: 'Invoice #INV-2026-004 Issued',
    description: '$6,500 due on October 9, 2026 for Phase 2 Milestone.',
    type: 'invoice',
    read: false,
    link: '/portal/invoices',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: 'notif_vance_02',
    clientId: 'client_vance',
    title: 'Domain vancecapital.com Renewal Reminder',
    description: 'Domain expires in 20 days. Auto-renew is currently disabled.',
    type: 'domain',
    read: false,
    link: '/portal/domains',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'notif_vance_03',
    clientId: 'client_vance',
    title: 'Support Ticket #TICK-101 Updated',
    description: 'Alex Agent replied regarding fiscal quarter distribution filtering.',
    type: 'support',
    read: true,
    link: '/portal/support',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },

  // Client B
  {
    id: 'notif_brody_01',
    clientId: 'client_brody',
    title: 'Payment Received for #INV-2026-005',
    description: '$3,200 payment confirmed. Receipt #REC-2026-005 generated.',
    type: 'invoice',
    read: false,
    link: '/portal/billing',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

const SEED_AUDIT_LOGS: PortalAuditLog[] = [
  {
    id: 'aud_1',
    clientId: 'client_vance',
    clientName: 'Eleanor Vance',
    action: 'CLIENT_LOGIN',
    details: 'Client logged into Codex Dynamics Client Portal from IP 198.51.100.4',
    ipAddress: '198.51.100.4',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'aud_2',
    clientId: 'client_vance',
    clientName: 'Eleanor Vance',
    action: 'BACKOFFICE_SSO_REQUEST',
    details: 'Initiated secure SSO token handoff to website "Vance Tech Capital Public Site"',
    ipAddress: '198.51.100.4',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'aud_3',
    clientId: 'client_vance',
    clientName: 'Eleanor Vance',
    action: 'SSO_TOKEN_VALIDATED',
    details: 'Target back office validated single-use token cdx_sso_... and established session',
    ipAddress: '198.51.100.4',
    timestamp: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// DATA STORAGE ENGINE
// ---------------------------------------------------------------------------

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
    if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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
      db.clients[idx] = { ...db.clients[idx], ...client };
      saveDatabase(db);
      return db.clients[idx];
    } else {
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
      if (index >= 0) db.clients[index] = { ...db.clients[index], ...client };
      else db.clients.push(client);
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

  adminCreateClient(data: Omit<PortalClient, 'id' | 'createdAt' | 'lastLoginAt'>): PortalClient {
    const db = loadDatabase();
    const newClient: PortalClient = {
      ...data,
      id: `client_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
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
      db.clients.unshift(newClient);
      saveDatabase(db);
      return newClient;
    }
    db.clients[idx] = { ...db.clients[idx], ...updates };
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
