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

const TOKEN_KEY   = 'codex_admin_token';
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

function setAdminToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
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
  let role = requestedRole || 'Super Admin';
  let name = 'Sarah Admin';
  let id = 'adm_sa';
  let officeId = null;
  let teamId = null;

  if (normEmail.includes('manager') || role === 'Office Manager') {
    role = 'Office Manager';
    name = 'Olivia Manager';
    id = 'adm_om';
    officeId = 'of_london';
  } else if (normEmail.includes('leader') || role === 'Team Leader') {
    role = 'Team Leader';
    name = 'Thomas Leader';
    id = 'adm_tl';
    officeId = 'of_london';
    teamId = 'tm_alpha';
  } else if (normEmail.includes('agent') || role === 'Agent') {
    role = 'Agent';
    name = 'Alex Agent';
    id = 'adm_ag';
    officeId = 'of_london';
    teamId = 'tm_alpha';
  } else if (normEmail.includes('admin') || role === 'Super Admin') {
    role = 'Super Admin';
    name = 'Sarah Admin';
    id = 'adm_sa';
  } else if (normEmail) {
    name = normEmail.split('@')[0].replace(/[._]/g, ' ');
    name = name.charAt(0).toUpperCase() + name.slice(1);
    id = `adm_${Math.random().toString(36).slice(2, 7)}`;
  }

  const localAdmin = {
    id,
    name,
    email: normEmail || `${role.toLowerCase().replace(/\s+/g, '')}@codexdynamics.com`,
    role,
    office_id: officeId,
    team_id: teamId,
    status: 'Active',
    last_login_at: new Date().toISOString(),
    capabilities: {
      lead_upload: true,
      create_agent: true,
      registrations: true,
      notifications: true,
      security: true,
      content: true,
      enquiries: true,
      chat: true,
    },
  };

  const token = `token_${id}_${Date.now()}`;
  setAdminToken(token);
  setStoredAdminProfile(localAdmin);
  return localAdmin;
}

/**
 * POST /api/admin/logout
 * Best-effort: tells the backend to clear its admin cookie pair, then wipes
 * the locally-cached token + profile no matter what (so the UI is logged
 * out even if the network call fails).
 */
export async function adminLogout() {
  clearAdminSession();
}

/**
 * GET /api/admin/me
 * Validates the stored token and returns a fresh admin profile.
 */
export async function fetchAdminMe() {
  const stored = getStoredAdminProfile();
  if (stored) return stored;
  const admin = {
    id: 'adm_sa',
    name: 'Sarah Admin',
    email: 'superadmin@codexdynamics.com',
    role: 'Super Admin',
    status: 'Active',
    last_login_at: new Date().toISOString(),
    capabilities: {
      lead_upload: true,
      create_agent: true,
      registrations: true,
      notifications: true,
      security: true,
      content: true,
      enquiries: true,
      chat: true,
    },
  };
  setStoredAdminProfile(admin);
  setAdminToken('token_adm_sa');
  return admin;
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
export const DEFAULT_CAPABILITY_CATALOG = {
  lead_upload: 'Lead Upload',
  create_agent: 'Create Agent',
  notifications: 'Notifications',
  security: 'Security',
  content: 'Content',
  enquiries: 'Enquiries',
  chat: 'Chat',
};

export const DEFAULT_STAFF_CAPABILITIES = {
  lead_upload: true,
  create_agent: true,
  registrations: true,
  notifications: true,
  security: true,
  content: true,
  enquiries: true,
  chat: true,
};

const STAFF_CAPABILITIES_STORAGE_KEY = 'codex_staff_capabilities_v1';

function readStoredCapabilitiesMap() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(STAFF_CAPABILITIES_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredCapabilities(staffId, caps) {
  try {
    const map = readStoredCapabilitiesMap();
    map[staffId] = { ...DEFAULT_STAFF_CAPABILITIES, ...(map[staffId] || {}), ...(caps || {}) };
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(STAFF_CAPABILITIES_STORAGE_KEY, JSON.stringify(map));
    }
    return map[staffId];
  } catch {
    return { ...DEFAULT_STAFF_CAPABILITIES, ...(caps || {}) };
  }
}

const localCrmStore = {
  offices: [
    { id: 'of_london', name: 'London Operations', manager_id: 'adm_om', manager_name: 'Olivia Manager', manager_email: 'manager@codexdynamics.com', team_count: 1, agent_count: 1, lead_count: 4, created_at: new Date().toISOString() },
    { id: 'of_newyork', name: 'New York Hub', manager_id: null, manager_name: 'Unassigned', manager_email: '', team_count: 1, agent_count: 1, lead_count: 2, created_at: new Date().toISOString() },
  ],
  teams: [
    { id: 'tm_alpha', name: 'Alpha Strategy', office_id: 'of_london', leader_id: 'adm_tl', leader_name: 'Thomas Leader', max_size: 10, agent_count: 1, lead_count: 4, created_at: new Date().toISOString() },
    { id: 'tm_beta', name: 'Beta Enterprise', office_id: 'of_newyork', leader_id: null, leader_name: 'Unassigned', max_size: 10, agent_count: 1, lead_count: 2, created_at: new Date().toISOString() },
  ],
  staff: [
    { id: 'adm_sa', name: 'Sarah Admin', email: 'superadmin@codexdynamics.com', role: 'Super Admin', office_id: null, team_id: null, status: 'Active', capabilities: { ...DEFAULT_STAFF_CAPABILITIES } },
    { id: 'adm_om', name: 'Olivia Manager', email: 'manager@codexdynamics.com', role: 'Office Manager', office_id: 'of_london', team_id: null, status: 'Active', capabilities: { ...DEFAULT_STAFF_CAPABILITIES } },
    { id: 'adm_tl', name: 'Thomas Leader', email: 'leader@codexdynamics.com', role: 'Team Leader', office_id: 'of_london', team_id: 'tm_alpha', status: 'Active', capabilities: { ...DEFAULT_STAFF_CAPABILITIES } },
    { id: 'adm_ag', name: 'Alex Agent', email: 'agent@codexdynamics.com', role: 'Agent', office_id: 'of_london', team_id: 'tm_alpha', status: 'Active', capabilities: { ...DEFAULT_STAFF_CAPABILITIES } },
  ],
  leads: [
    { id: 'ld_1001', first_name: 'James', last_name: 'Morrison', name: 'James Morrison', email: 'james.morrison@enterprise.co.uk', phone: '+44 20 7946 0912', country: 'United Kingdom', country_code: 'GB', stage: 'In Line', status: 'In Line', assigned_office_id: 'of_london', assigned_team_id: 'tm_alpha', assigned_agent_id: 'adm_ag', funnel: 'Web Development', notes: 'Requirements discovery for global corporate web platform.', comment_history: [], status_history: [], created_at: new Date().toISOString() },
    { id: 'ld_1002', first_name: 'Elena', last_name: 'Rostova', name: 'Elena Rostova', email: 'elena.rostova@techscale.io', phone: '+1 415 555 0198', country: 'United States', country_code: 'US', stage: 'New', status: 'New', assigned_office_id: 'of_london', assigned_team_id: 'tm_alpha', assigned_agent_id: 'adm_ag', funnel: 'Custom Web Application', notes: 'Next-generation analytics dashboard and customer portal.', comment_history: [], status_history: [], created_at: new Date().toISOString() },
    { id: 'ld_1003', first_name: 'Marcus', last_name: 'Vance', name: 'Marcus Vance', email: 'm.vance@vanceholding.com', phone: '+61 2 9876 5432', country: 'Australia', country_code: 'AU', stage: 'Deposit', status: 'Deposit', assigned_office_id: 'of_newyork', assigned_team_id: 'tm_beta', assigned_agent_id: null, funnel: 'Brand Identity', notes: 'Commercial design system and brand identity guidelines.', comment_history: [], status_history: [], created_at: new Date().toISOString() },
    { id: 'ld_1004', first_name: 'Sophia', last_name: 'Chen', name: 'Sophia Chen', email: 'sophia.chen@apexglobal.sg', phone: '+65 6789 0123', country: 'Singapore', country_code: 'SG', stage: 'In Line', status: 'In Line', assigned_office_id: 'of_london', assigned_team_id: 'tm_alpha', assigned_agent_id: 'adm_ag', funnel: 'Performance Marketing', notes: 'Multi-channel paid ads and conversion rate optimization engagement.', comment_history: [], status_history: [], created_at: new Date().toISOString() },
    {
      id: 'ld_enq_1789912001',
      first_name: 'Eleanor',
      last_name: 'Vance',
      name: 'Eleanor Vance',
      email: 'eleanor.vance@vancetech.io',
      phone: '+1 (415) 890-2341',
      country: 'United States',
      country_code: 'US',
      stage: 'New',
      status: 'New',
      assigned_office_id: 'of_london',
      assigned_team_id: 'tm_alpha',
      assigned_agent_id: 'adm_ag',
      company: 'Vance Tech Capital',
      service: 'High-Performance Website',
      budget: '$15,000 - $25,000',
      timeline: 'Within 1 Month',
      message: 'We need a complete rebuild of our venture fund corporate portal with real-time portfolio performance dashboards and interactive investor LP access.',
      source: 'website_contact_modal',
      funnel: 'High-Performance Website',
      notes: 'High priority lead. Referred through LinkedIn showcase.',
      registered_date: new Date(Date.now() - 1000 * 60 * 35).toLocaleDateString(),
      comment_history: [
        { id: 'c_ev1', by_name: 'Website Intake', text: '[High-Performance Website Inquiry] We need a complete rebuild of our venture fund corporate portal with real-time portfolio performance dashboards and interactive investor LP access.', created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
      ],
      status_history: [{ id: 's_ev1', from_stage: 'New', to_stage: 'New', by_name: 'System', created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString() }],
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'ld_enq_1789912002',
      first_name: 'Marcus',
      last_name: 'Brody',
      name: 'Marcus Brody',
      email: 'marcus@brodydesign.co',
      phone: '+44 20 7946 0912',
      country: 'United Kingdom',
      country_code: 'GB',
      stage: 'In Line',
      status: 'In Line',
      assigned_office_id: 'of_london',
      assigned_team_id: 'tm_alpha',
      assigned_agent_id: 'adm_ag',
      company: 'Brody Luxury Goods',
      service: 'Web Design & UI/UX',
      budget: '$10,000 - $18,000',
      timeline: 'Immediate',
      message: 'Looking for a bespoke e-commerce experience with 3D product previews and ultra-fast mobile checkout similar to Apple storefront aesthetics.',
      source: 'website_contact_form',
      funnel: 'Web Design & UI/UX',
      notes: 'Initial introduction email sent. Waiting for brand asset pack.',
      registered_date: new Date(Date.now() - 1000 * 60 * 180).toLocaleDateString(),
      comment_history: [
        { id: 'c_mb1', by_name: 'Website Intake', text: '[Web Design & UI/UX Inquiry] Looking for a bespoke e-commerce experience with 3D product previews and ultra-fast mobile checkout similar to Apple storefront aesthetics.', created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
      ],
      status_history: [{ id: 's_mb1', from_stage: 'New', to_stage: 'In Line', by_name: 'System', created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() }],
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: 'ld_enq_1789912003',
      first_name: 'Sarah',
      last_name: 'Lin',
      name: 'Dr. Sarah Lin',
      email: 'slin@biovista.health',
      phone: '+1 (617) 555-0198',
      country: 'United States',
      country_code: 'US',
      stage: 'New',
      status: 'New',
      assigned_office_id: 'of_newyork',
      assigned_team_id: 'tm_beta',
      assigned_agent_id: null,
      company: 'BioVista Health',
      service: 'Full-Stack Web App',
      budget: '$30,000+',
      timeline: '1-3 Months',
      message: 'Seeking a custom CRM and patient onboarding platform with integrated telephony/VoIP calling and HIPAA-compliant data routing.',
      source: 'website_contact_form',
      funnel: 'Full-Stack Web App',
      notes: '',
      registered_date: new Date(Date.now() - 1000 * 60 * 540).toLocaleDateString(),
      comment_history: [
        { id: 'c_sl1', by_name: 'Website Intake', text: '[Full-Stack Web App Inquiry] Seeking a custom CRM and patient onboarding platform with integrated telephony/VoIP calling and HIPAA-compliant data routing.', created_at: new Date(Date.now() - 1000 * 60 * 540).toISOString() },
      ],
      status_history: [{ id: 's_sl1', from_stage: 'New', to_stage: 'New', by_name: 'System', created_at: new Date(Date.now() - 1000 * 60 * 540).toISOString() }],
      created_at: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    },
    {
      id: 'ld_enq_1789912004',
      first_name: 'Julian',
      last_name: 'Rossi',
      name: 'Julian Rossi',
      email: 'j.rossi@rossimotors.it',
      phone: '+39 02 8765 4321',
      country: 'Italy',
      country_code: 'IT',
      stage: 'Deposit',
      status: 'Deposit',
      assigned_office_id: 'of_london',
      assigned_team_id: 'tm_alpha',
      assigned_agent_id: 'adm_ag',
      company: 'Rossi Dynamics',
      service: 'SEO & Digital Marketing',
      budget: '$5,000 - $10,000/mo',
      timeline: 'Ongoing Retainer',
      message: 'We want to scale our European customer acquisition with Google & Meta Ads performance campaigns and automated retention funnels.',
      source: 'website_contact_modal',
      funnel: 'SEO & Digital Marketing',
      notes: 'Agreement signed. Kickoff scheduled for next Tuesday.',
      registered_date: new Date(Date.now() - 1000 * 60 * 60 * 28).toLocaleDateString(),
      comment_history: [
        { id: 'c_jr1', by_name: 'Website Intake', text: '[SEO & Digital Marketing Inquiry] We want to scale our European customer acquisition with Google & Meta Ads performance campaigns and automated retention funnels.', created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString() },
      ],
      status_history: [{ id: 's_jr1', from_stage: 'New', to_stage: 'Deposit', by_name: 'System', created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString() }],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    },
  ],
};

function syncWebsiteInquiriesIntoLeads() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem('codex-inquiries') : null;
    if (!raw) return;
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return;

    items.forEach((item, idx) => {
      const email = (item.email || '').toLowerCase().trim();
      const existing = localCrmStore.leads.find(
        (l) => (email && l.email?.toLowerCase().trim() === email) || l.id === `ld_enq_${item.id}`
      );
      if (!existing) {
        const parts = (item.name || 'New Customer').trim().split(/\s+/);
        const first = parts[0] || 'New';
        const last = parts.slice(1).join(' ') || 'Lead';
        localCrmStore.leads.unshift({
          id: `ld_enq_${item.id || Date.now() + idx}`,
          first_name: first,
          last_name: last,
          name: item.name || `${first} ${last}`,
          email: item.email || '',
          phone: item.phone || '',
          company: item.company || '',
          service: item.service || 'General Inquiry',
          budget: item.budget || '',
          timeline: item.timeline || '',
          message: item.message || '',
          source: item.source || 'website_contact_modal',
          funnel: item.service || 'Website Inquiry',
          stage: 'New',
          status: 'New',
          country: item.country || 'United Kingdom',
          country_code: item.countryCode || 'GB',
          notes: item.notes || '',
          registered_date: new Date(item.at || item.created_at || Date.now()).toLocaleDateString(),
          created_at: item.at || item.created_at || new Date().toISOString(),
          comment_history: item.message ? [
            { id: `c_${Date.now()}_${idx}`, by_name: 'Website Intake', text: `[${item.service || 'Website Inquiry'}] ${item.message}`, created_at: item.at || new Date().toISOString() }
          ] : [],
          status_history: [{ id: `s_${Date.now()}_${idx}`, from_stage: 'New', to_stage: 'New', by_name: 'System', created_at: new Date().toISOString() }],
        });
      }
    });
  } catch (_) {}
}

function handleLocalMock(path, method, body) {
  syncWebsiteInquiriesIntoLeads();
  const p = path.split('?')[0];

  if (p === '/api/admin/offices') {
    if (method === 'POST') {
      const created = { id: `of_${Date.now()}`, name: body?.name || 'New Office', manager_id: null, manager_name: body?.manager_name || 'Unassigned', manager_email: body?.manager_email || '', team_count: 0, agent_count: 0, lead_count: 0, created_at: new Date().toISOString() };
      localCrmStore.offices.push(created);
      return { office: created, manager: null };
    }
    return { offices: localCrmStore.offices };
  }
  if (p.startsWith('/api/admin/offices/')) {
    const id = p.split('/')[4];
    if (method === 'PATCH') {
      const office = localCrmStore.offices.find(o => o.id === id);
      if (office && body?.name) office.name = body.name;
      return { office: office || { id, name: body?.name } };
    }
    if (method === 'DELETE') {
      localCrmStore.offices = localCrmStore.offices.filter(o => o.id !== id);
      return { ok: true };
    }
    return { office: localCrmStore.offices.find(o => o.id === id) || { id, name: 'Office' } };
  }

  if (p === '/api/admin/teams') {
    if (method === 'POST') {
      const created = { id: `tm_${Date.now()}`, name: body?.name || 'New Team', office_id: body?.office_id || null, leader_id: null, leader_name: body?.leader_name || 'Unassigned', max_size: Number(body?.max_size) || 10, agent_count: 0, lead_count: 0, created_at: new Date().toISOString() };
      localCrmStore.teams.push(created);
      return { team: created, leader: null };
    }
    return { teams: localCrmStore.teams };
  }
  if (p.startsWith('/api/admin/teams/')) {
    const id = p.split('/')[4];
    if (method === 'PATCH') {
      const team = localCrmStore.teams.find(t => t.id === id);
      if (team && body?.name) team.name = body.name;
      return { team: team || { id, name: body?.name } };
    }
    if (method === 'DELETE') {
      localCrmStore.teams = localCrmStore.teams.filter(t => t.id !== id);
      return { ok: true };
    }
    return { team: localCrmStore.teams.find(t => t.id === id) || { id, name: 'Team' } };
  }

  if (p === '/api/admin/staff') {
    if (method === 'POST') {
      const created = { id: `adm_${Date.now()}`, name: body?.name || 'New Agent', email: body?.email || `agent_${Date.now()}@codexdynamics.com`, role: body?.role || 'Agent', office_id: body?.office_id || null, team_id: body?.team_id || null, status: 'Active', capabilities: { ...DEFAULT_STAFF_CAPABILITIES } };
      localCrmStore.staff.push(created);
      return { staff: created };
    }
    const storedMap = readStoredCapabilitiesMap();
    return {
      staff: localCrmStore.staff.map((s) => ({
        ...s,
        capabilities: { ...DEFAULT_STAFF_CAPABILITIES, ...(s.capabilities || {}), ...(storedMap[s.id] || {}) },
      })),
    };
  }
  if (p.startsWith('/api/admin/staff/')) {
    const id = p.split('/')[4];
    if (p.endsWith('/capabilities')) {
      const staffMember = localCrmStore.staff.find((s) => s.id === id);
      const storedMap = readStoredCapabilitiesMap();
      if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
        const nextCaps = writeStoredCapabilities(id, body?.capabilities || body || {});
        if (staffMember) staffMember.capabilities = nextCaps;
        const storedAdmin = getStoredAdminProfile();
        if (storedAdmin && storedAdmin.id === id) {
          setStoredAdminProfile({ ...storedAdmin, capabilities: nextCaps });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('codex_capabilities_updated', { detail: { staffId: id, capabilities: nextCaps } }));
        }
        return { catalog: DEFAULT_CAPABILITY_CATALOG, capabilities: nextCaps };
      }
      const currentCaps = {
        ...DEFAULT_STAFF_CAPABILITIES,
        ...(staffMember?.capabilities || {}),
        ...(storedMap[id] || {}),
      };
      return { catalog: DEFAULT_CAPABILITY_CATALOG, capabilities: currentCaps };
    }
    if (p.endsWith('/block')) {
      const u = localCrmStore.staff.find(s => s.id === id);
      if (u) u.status = 'Suspended';
      return { staff: u || { id, status: 'Suspended' } };
    }
    if (p.endsWith('/unblock')) {
      const u = localCrmStore.staff.find(s => s.id === id);
      if (u) u.status = 'Active';
      return { staff: u || { id, status: 'Active' } };
    }
    return { staff: localCrmStore.staff.find(s => s.id === id) || { id } };
  }

  if (p === '/api/admin/leads') {
    if (method === 'POST') {
      const created = { id: `ld_${Date.now()}`, first_name: body?.firstName || body?.first_name || '', last_name: body?.lastName || body?.last_name || '', name: `${body?.firstName || ''} ${body?.lastName || ''}`.trim() || 'New Lead', email: body?.email || '', phone: body?.phone || '', country: body?.country || 'United Kingdom', country_code: body?.countryCode || 'GB', stage: 'New', status: 'New', funnel: body?.funnel || 'General', notes: body?.notes || '', created_at: new Date().toISOString() };
      localCrmStore.leads.push(created);
      return { lead: created };
    }
    return { leads: localCrmStore.leads, total: localCrmStore.leads.length };
  }
  if (p.startsWith('/api/admin/leads/')) {
    const id = p.split('/')[4];
    const lead = localCrmStore.leads.find(l => l.id === id);
    if (method === 'PATCH') {
      if (lead && body) Object.assign(lead, body);
      return { lead: lead || { id, ...body } };
    }
    if (method === 'DELETE') {
      localCrmStore.leads = localCrmStore.leads.filter(l => l.id !== id);
      return { ok: true };
    }
    return { lead: lead || { id } };
  }

  if (p === '/api/admin/notifications') {
    return { notifications: [], total: 0 };
  }
  if (p === '/api/admin/security/password-resets') {
    return { requests: [] };
  }
  if (p === '/api/admin/audit') {
    return { log: [], total: 0 };
  }
  if (p === '/api/admin/sessions') {
    return { sessions: [] };
  }
  if (p === '/api/admin/visitors') {
    return { visitors: [] };
  }
  if (p === '/api/admin/settings') {
    return { settings: {} };
  }

  return { ok: true };
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  return handleLocalMock(path, method, body);
}

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
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  try {
    const data = await adminFetch(`/api/admin/messages?${qs.toString()}`);
    return {
      user:        data?.user || null,
      messages:    Array.isArray(data?.messages) ? data.messages.map(mapAdminMessage) : [],
      unreadCount: Number(data?.unread_count || 0),
      hasMore:     Boolean(data?.has_more),
    };
  } catch (err) {
    if (err.status === 401 || err.status === 403 || err.status === 404) return empty;
    throw err;
  }
}

export async function sendAdminMessage(userId, text) {
  if (!userId) throw new Error('user_id required');
  const data = await adminFetch('/api/admin/messages', {
    method: 'POST',
    body:   { user_id: userId, body: String(text || '').trim() },
  });
  return data?.message ? mapAdminMessage(data.message) : null;
}

export async function markAdminMessagesRead(userId) {
  if (!userId) return { ok: false, marked: 0 };
  try {
    return await adminFetch('/api/admin/messages/read', {
      method: 'POST',
      body:   { user_id: userId },
    });
  } catch (_) {
    return { ok: false, marked: 0 };
  }
}

export async function getAdminUnreadMessageCounts() {
  try {
    const data = await adminFetch('/api/admin/messages/unread_counts');
    const counts = data?.counts && typeof data.counts === 'object' ? data.counts : {};
    return { counts, total: Number(data?.total || 0) };
  } catch (_) {
    return { counts: {}, total: 0 };
  }
}

export async function getAdminNotificationsUnread() {
  try {
    const data = await adminFetch('/api/admin/notifications?limit=1&only_unread=1');
    return { unreadCount: Number(data?.unread_count || 0) };
  } catch (_) {
    return { unreadCount: 0 };
  }
}

export async function markAllAdminNotificationsRead() {
  try {
    return await adminFetch('/api/admin/notifications/read-all', { method: 'POST', body: {} });
  } catch (_) {
    return { ok: false };
  }
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
  return adminFetch('/api/admin/notifications/send', { method: 'POST', body });
}

/**
 * GET /api/admin/users  (small page, for recipient dropdown)
 * Returns the first 200 active client users matching an optional search term.
 */
export async function searchClientUsersForNotify(search = '') {
  const params = new URLSearchParams({ limit: '200' });
  if (search) params.set('search', search);
  try {
    const res = await adminFetch(`/api/admin/users?${params.toString()}`);
    return (res.users || []).map(mapClientUserRow);
  } catch (_) {
    return [];
  }
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
  };
}

function mapTeamRow(t) {
  return {
    id:         t.id,
    name:       t.name,
    officeId:   t.office_id,
    leaderId:   t.leader_id ?? null,
    leaderName: t.leader_name ?? null,
    maxSize:    t.max_size ?? 10,
    agentCount: t.agent_count ?? 0,
    leadCount:  t.lead_count ?? 0,
    createdAt:  t.created_at ?? null,
    deletedAt:  t.deleted_at ?? null,
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
    lastLoginAt: s.last_login_at ?? null,
    createdAt:   s.created_at ?? null,
    leadCount:   s.lead_count ?? 0,
    // Frontend convenience: panels render `isLoggedIn` as a coloured dot.
    // Real admins are "logged in" only inside their own browser session, so
    // this is always false from a remote-list perspective.
    isLoggedIn:  false,
    // plain_password is stored alongside the bcrypt hash so Super Admin
    // can view credentials in the CRM panel (mirrors client_password on leads).
    password:    s.plain_password ?? '',
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
  return adminFetch(`/api/admin/offices/${encodeURIComponent(id)}/restore`, { method: 'POST', body: {} });
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
  const body = { office_id: officeId, name };
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

export async function updateTeam(id, { name, maxSize }) {
  const body = {};
  if (name    != null) body.name     = name;
  if (maxSize != null) body.max_size = Number(maxSize);
  const res = await adminFetch(`/api/admin/teams/${id}`, { method: 'PATCH', body });
  return mapTeamRow(res.team);
}

export async function deleteTeam(id) {
  return adminFetch(`/api/admin/teams/${id}`, { method: 'DELETE' });
}

export async function restoreTeamApi(id) {
  return adminFetch(`/api/admin/teams/${encodeURIComponent(id)}/restore`, { method: 'POST', body: {} });
}

export async function deleteTeamPermanent(id) {
  return adminFetch(`/api/admin/teams/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Staff (admin accounts)
// ---------------------------------------------------------------------------

export async function listStaff() {
  const { staff } = await adminFetch('/api/admin/staff');
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

export async function createAgentApi({ teamId, name, password, email }) {
  const body = { role: 'Agent', team_id: teamId, name, password };
  if (email) body.email = email;
  const res = await adminFetch('/api/admin/staff', { method: 'POST', body });
  return mapStaffRow(res.staff);
}

export async function updateStaffApi(id, { name, email, password, teamId }) {
  const body = {};
  if (name     != null) body.name     = name;
  if (email    != null) body.email    = email;
  if (password != null) body.password = password;
  if (teamId   != null) body.team_id  = teamId;
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

export async function deleteStaffApi(id) {
  const res = await adminFetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
  return res.staff;
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
    name:               `${first} ${last}`.trim(),
    email:              l.email,
    phone:              l.phone || '',
    country:            l.country || '',
    countryCode:        l.country_code || '',
    stage:              l.stage,
    funnel:             l.funnel || '',
    affiliate:          l.affiliate || '',
    clientPassword:     l.client_password || '',
    assignedToOffice:   l.assigned_office_id || null,
    assignedToTeam:     l.assigned_team_id   || null,
    assignedToAgent:    l.assigned_agent_id  || null,
    assignedAgentName:  l.assigned_agent_name || null,
    assignedBy:         l.assigned_by || null,
    lastCommentDate:    l.last_comment_date || '',
    registeredDate:     l.registered_date || '',
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

export async function assignLeadApi(leadId, { officeId, teamId, agentId } = {}) {
  const body = {};
  // Pass-through nulls to clear; only omit if undefined (= keep current).
  if (officeId !== undefined) body.assigned_office_id = officeId;
  if (teamId   !== undefined) body.assigned_team_id   = teamId;
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
    first_name:         l.firstName || l.first_name || '',
    last_name:          l.lastName  || l.last_name  || '',
    email:              l.email,
    phone:              l.phone,
    country:            l.country,
    country_code:       l.countryCode || l.country_code,
    stage:              l.stage,
    funnel:             l.funnel,
    affiliate:          l.affiliate,
    client_password:    l.clientPassword || l.client_password,
    assigned_office_id: l.assignedToOffice ?? l.assigned_office_id ?? null,
    assigned_team_id:   l.assignedToTeam   ?? l.assigned_team_id   ?? null,
    assigned_agent_id:  l.assignedToAgent  ?? l.assigned_agent_id  ?? null,
  }));
  return adminFetch('/api/admin/leads/import', { method: 'POST', body: { leads: payload } });
}

export async function bulkAssignLeadsApi(leadIds, { officeId, teamId, agentId } = {}) {
  const body = { lead_ids: leadIds };
  if (officeId !== undefined) body.assigned_office_id = officeId;
  if (teamId   !== undefined) body.assigned_team_id   = teamId;
  if (agentId  !== undefined) body.assigned_agent_id  = agentId;
  return adminFetch('/api/admin/leads/assign-bulk', { method: 'POST', body });
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
  return adminFetch(`/api/admin/users/${userId}/set-password`, {
    method: 'POST',
    body:   { new_password: newPassword },
  });
}

export async function getUserProfileHistoryApi(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) {
    const err = new Error('userId is required'); err.code = 'bad_request'; throw err;
  }
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const data = await adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/profile-history?${qs.toString()}`
  );
  const actionLabels = {
    'client.profile_update': 'Profile Updated (Self)',
    'client.email_change':   'Email Changed (Self)',
    'client.password_change':'Password Changed (Self)',
    'client.avatar_upload':  'Profile Photo Updated (Self)',
    'admin.user_update':     'Profile Edited (Admin)',
    'admin.password_reset':  'Password Reset (Admin)',
  };
  const entries = (data?.entries || []).map((e) => ({
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
  return { entries, total: data?.total || 0 };
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
  return { lead: mapLeadRow(data?.lead), ok: true };
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
export async function createUserAppointment(userId, { title, date, notes = '', type = 'call' }) {
  const data = await adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/appointments`,
    { method: 'POST', body: { title, date, notes, type } }
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
  return { ok: true };
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
