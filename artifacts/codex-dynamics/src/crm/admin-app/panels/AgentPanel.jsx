import React, { useState, useEffect, useRef } from 'react';
import { enterClientPortal } from '../clientImpersonation.js';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ROLE, LEAD_STATUSES, normalizeStage,
  getOfficeName, getTeamName, getUserName, getCountryFlag, statusClass,
  formatLeadId, EditLeadModal, CreateLeadModal, stageColor,
  StatusDropdown,
} from '../shared';
import { useConfirmDialog } from '../components/ConfirmModal/ConfirmModal';
import { SearchAutocomplete } from '../components/UserChrome.jsx';
import { searchAdminLeads, createUserAppointment } from '../adminApi';
import { getAdminMessages, sendAdminMessage, markAdminMessagesRead, getAdminUnreadMessageCounts, deleteAdminMessage, clearAdminChat, adminSetClientPassword, deleteLeadCommentApi, deleteLeadStatusEntryApi, getLeadNotificationsAsAdmin, fetchLeadById, postAdminPresence, getAdminMessageAttachmentUrl, getStaffCapabilities, fetchAdminMe, updateLeadApi, getClientProfilePermissionsAdmin } from '../adminApi';
import AdminNotificationsInbox from '../components/AdminNotificationsInbox/AdminNotificationsInbox.jsx';
import ReactCapabilityWorkspace from '../components/ReactCapabilityWorkspace.jsx';
import { getLeadProfilePath, getRoleScopedLeads, getRoleWorkspacePath } from '../leadProfileRouting';
import { portalDb } from '../../../services/portalDatabase';
import ClientAccessEditor from '../components/ClientAccessEditor.jsx';
import ClientAccountingPanel from '../components/ClientAccountingPanel.jsx';
import ClientProfilePermissionManager from '../components/ClientProfilePermissionManager.jsx';

// macOS-style funnel filter button + popover for column header filters.
function FilterPopover({ label, value, options, open, onToggle, onSelect, onClose, formatLabel }) {
  const popRef = useRef(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) { setSearch(''); return; }
    const handleClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const display = (opt) => (formatLabel ? formatLabel(opt) : (opt ?? '-'));
  const filtered = options.filter((opt) =>
    String(display(opt)).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        type="button"
        className="crm-column-filter-btn"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={`Filter ${label}`}
        title={`Filter ${label}`}
      />
      {open && (
        <div ref={popRef} className="crm-mac-popover" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            autoFocus
            className="crm-mac-popover-search"
            placeholder={`Filter ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="crm-mac-popover-list">
            <div
              className={`crm-mac-popover-item ${value === '' ? 'crm-selected' : ''}`}
              onClick={() => onSelect('')}
            >
              <span className="crm-mac-popover-check">{value === '' ? '✓' : ''}</span>
              <span>All</span>
            </div>
            {filtered.length === 0 ? (
              <div className="crm-mac-popover-empty">No matches</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={String(opt)}
                  className={`crm-mac-popover-item ${value === opt ? 'crm-selected' : ''}`}
                  onClick={() => onSelect(opt)}
                >
                  <span className="crm-mac-popover-check">{value === opt ? '✓' : ''}</span>
                  <span>{display(opt)}</span>
                </div>
              ))
            )}
          </div>
          {value !== '' && (
            <>
              <div className="crm-mac-popover-divider" />
              <div className="crm-mac-popover-footer">
                <button type="button" onClick={() => onSelect('')}>Clear filter</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// Inline SVG icons for the lead-profile action buttons.
const PA_ICONS = {
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  ),
  appointment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 1 1-3-6.2L21 4l-1 4-3.8 0" /><path d="M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  ),
  login: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
    </svg>
  ),
};
const PaIcon = ({ name }) => <span className="crm-pa-icon">{PA_ICONS[name]}</span>;

function AgentPanel({ data, currentUser, setData, setUserLoginState, createLead, showNotification }) {
  const navigate = useNavigate();
  const location = useLocation();
  const myLeads = data.leads.filter((lead) => lead.assignedToAgent === currentUser.id);
  // Per-lead unread chat-message counts, keyed by user/lead id. Polled in
  // one round-trip via /api/admin/messages/unread_counts so the lead list
  // can render a small red badge on each row that has new client replies
  // without firing N parallel fetches.
  const [unreadByLead, setUnreadByLead] = useState({});
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      const { counts } = await getAdminUnreadMessageCounts();
      if (!cancelled) setUnreadByLead(counts || {});
    };
    tick();
    const id = setInterval(tick, 5000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFunnel, setFilterFunnel] = useState('');
  const [filterAffiliate, setFilterAffiliate] = useState('');
  const [filterLastComment, setFilterLastComment] = useState('');
  const [filterRegistered, setFilterRegistered] = useState('');
  const [activeFilterDropdown, setActiveFilterDropdown] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const nativeTabs = ['leads', 'notifications'];
  const tabStorageKey = `agent_activeTab:${currentUser?.id || 'unknown'}`;
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem(tabStorageKey);
    return nativeTabs.includes(saved) ? saved : 'leads';
  });
  const [leadUploadEnabled, setLeadUploadEnabled] = useState(Boolean(currentUser?.capabilities?.lead_upload));
  const [leadUploadLoading, setLeadUploadLoading] = useState(true);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const nativeTabActive = ['leads', 'notifications'].includes(activeTab);
  useEffect(() => { sessionStorage.setItem(tabStorageKey, activeTab); }, [activeTab, tabStorageKey]);
  useEffect(() => {
    let cancelled = false;
    setLeadUploadLoading(true);
    const loadCapability = async () => {
      try {
        let result;
        try {
          result = await getStaffCapabilities(currentUser.id);
        } catch (_) {
          const profile = await fetchAdminMe();
          result = { capabilities: profile.capabilities || {} };
        }
        if (!cancelled) setLeadUploadEnabled(Boolean(result.capabilities?.lead_upload));
      } catch (_) {
        if (!cancelled) setLeadUploadEnabled(false);
      } finally {
        if (!cancelled) setLeadUploadLoading(false);
      }
    };
    if (currentUser?.id) loadCapability();
    return () => { cancelled = true; };
  }, [currentUser?.id]);
  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail.tab);
    window.addEventListener('admin:goto-tab', handler);
    return () => window.removeEventListener('admin:goto-tab', handler);
  }, []);
  const returnTo = location.state?.returnTo;
  const returnLabel = location.state?.returnLabel || 'Back to Team Leader';


  const handleFilterChange = (column, value) => {
    if (column === 'country') setFilterCountry(value);
    if (column === 'status') setFilterStatus(value);
    if (column === 'funnel') setFilterFunnel(value);
    if (column === 'affiliate') setFilterAffiliate(value);
    if (column === 'lastComment') setFilterLastComment(value);
    if (column === 'registered') setFilterRegistered(value);
    setActiveFilterDropdown('');
  };

  const handleClearAll = () => {
    setFilterCountry('');
    setFilterStatus('');
    setFilterFunnel('');
    setFilterAffiliate('');
    setFilterLastComment('');
    setFilterRegistered('');
    setSortColumn('');
    setSortDirection('asc');
    setSearch('');
    setPage(1);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const countries = Array.from(new Set(myLeads.map((lead) => lead.country || '').filter(Boolean))).sort();
  const statuses = Array.from(new Set(myLeads.map((lead) => normalizeStage(lead.stage || '')).filter(Boolean))).sort();
  const funnels = Array.from(new Set(myLeads.map((lead) => lead.funnel || '').filter(Boolean))).sort();
  const affiliates = Array.from(new Set(myLeads.map((lead) => lead.affiliate || '').filter(Boolean))).sort();
  const lastComments = Array.from(new Set(myLeads.map((lead) => lead.lastCommentDate || '').filter(Boolean))).sort();
  const registeredDates = Array.from(new Set(myLeads.map((lead) => lead.registeredDate || '').filter(Boolean))).sort();

  const filteredLeads = myLeads.filter((lead) => {
    const lower = search.toLowerCase();
    const stage = normalizeStage(lead.stage || '');

    if (filterCountry && lead.country !== filterCountry) return false;
    if (filterStatus && stage !== filterStatus) return false;
    if (filterFunnel && (lead.funnel || '') !== filterFunnel) return false;
    if (filterAffiliate && (lead.affiliate || '') !== filterAffiliate) return false;
    if (filterLastComment && (lead.lastCommentDate || '') !== filterLastComment) return false;
    if (filterRegistered && (lead.registeredDate || '') !== filterRegistered) return false;

    return (
      lead.id.toLowerCase().includes(lower) ||
      lead.firstName.toLowerCase().includes(lower) ||
      lead.lastName.toLowerCase().includes(lower) ||
      lead.phone.toLowerCase().includes(lower) ||
      lead.email.toLowerCase().includes(lower) ||
      lead.country.toLowerCase().includes(lower) ||
      (lead.funnel || '').toLowerCase().includes(lower) ||
      (lead.affiliate || '').toLowerCase().includes(lower) ||
      stage.toLowerCase().includes(lower)
    );
  });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (!sortColumn) return 0;
    let aVal, bVal;
    switch (sortColumn) {
      case 'firstName': aVal = a.firstName; bVal = b.firstName; break;
      case 'lastName': aVal = a.lastName; bVal = b.lastName; break;
      case 'country': aVal = a.country; bVal = b.country; break;
      case 'status': aVal = normalizeStage(a.stage); bVal = normalizeStage(b.stage); break;
      case 'funnel': aVal = a.funnel || ''; bVal = b.funnel || ''; break;
      case 'affiliate': aVal = a.affiliate || ''; bVal = b.affiliate || ''; break;
      case 'lastComment': aVal = a.lastCommentDate || ''; bVal = b.lastCommentDate || ''; break;
      case 'registered': aVal = a.registeredDate || ''; bVal = b.registeredDate || ''; break;
      default: return 0;
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const pendingAppointments = myLeads
    .flatMap((lead) => (lead.appointments || []).map((appt) => ({
      ...appt,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
    })))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [search, pageSize, myLeads.length]);

  const pagedLeads = sortedLeads.slice((page - 1) * pageSize, page * pageSize);

  if (!currentUser) {
    return (
      <div className="crm-card">
        <h2>Agent Portfolio</h2>
        <p>No agent data found. Please select or login as an Agent.</p>
      </div>
    );
  }

  return (
    <div className="crm-card crm-agent-portfolio">
      <div className="crm-agent-hero">
        <div>
          <h2>Agent Portfolio</h2>
          <p>{currentUser.name} - {getTeamName(currentUser.teamId, data.teams)} / {getOfficeName(currentUser.officeId, data.offices)}</p>
        </div>
        <div className="crm-agent-hero-actions">
          {returnTo && (
            <button className="crm-small-btn" onClick={() => navigate(returnTo)}>
              Back: {returnLabel}
            </button>
          )}
          {!leadUploadLoading && leadUploadEnabled && createLead && (
            <button className="crm-small-btn crm-pagination-btn-gold" onClick={() => setShowCreateLead(true)}>
              + New Lead
            </button>
          )}
          <div className="crm-agent-status-chip">{currentUser.isLoggedIn ? 'Online' : 'Offline'}</div>
        </div>
      </div>

      <div className="crm-super-admin-header crm-role-panel-header" style={{ marginBottom: 14 }}>
        <div className="crm-super-admin-tabs">
          {['leads', 'notifications'].map((tab) => (
            <button
              key={tab}
              className={`crm-super-admin-tab-btn ${activeTab === tab ? 'crm-active' : ''}`}
              onClick={() => setActiveTab(tab)}
              aria-label={`Switch to ${tab === 'leads' ? 'Client Management' : tab}`}
            >
              {tab === 'leads' ? 'Client Management' : (tab.charAt(0).toUpperCase() + tab.slice(1))}
            </button>
          ))}
        </div>
      </div>
      <ReactCapabilityWorkspace
        data={data}
        currentUser={currentUser}
        showNotification={showNotification}
        activeTab={activeTab}
        onActiveChange={setActiveTab}
        nativeTabKeys={nativeTabs}
        fallbackTab="leads"
        showPanel={!nativeTabActive}
      />
      {nativeTabActive && pendingAppointments.length > 0 && (
        <div className="crm-card" style={{ background: 'var(--crm-card)', marginBottom: 12 }}>
          <h3>Pending Appointments</h3>
          <ul className="crm-pending-appointments-list">
            {pendingAppointments.slice(0, 8).map((appt) => (
              <li key={`${appt.id}-${appt.leadId}`}>
                <strong>{appt.date} {appt.time}</strong> - {appt.title || 'Untitled'} for {appt.leadName}
              </li>
            ))}
          </ul>
          {pendingAppointments.length > 8 && <small>{pendingAppointments.length} upcoming appointments total</small>}
        </div>
      )}

      {nativeTabActive && activeTab === 'leads' && (
        <div className="crm-agent-leads-content">
          <div className="agent-tools-row" style={{ marginBottom: 12 }}>
            <SearchAutocomplete
              className="crm-input"
              placeholder="Search leads..."
              value={search}
              onChange={(v) => setSearch(v)}
              fetchSuggestions={searchAdminLeads}
              style={{ flex: 1, minWidth: 200 }}
              buildSuggestions={(q) => {
                const ql = q.toLowerCase();
                return myLeads
                  .filter(l => {
                    const full = `${l.firstName || ''} ${l.lastName || ''}`.toLowerCase();
                    return (
                      full.includes(ql) ||
                      String(l.id || '').toLowerCase().includes(ql) ||
                      (l.email || '').toLowerCase().includes(ql) ||
                      (l.phone || '').toLowerCase().includes(ql) ||
                      (l.country || '').toLowerCase().includes(ql) ||
                      (l.funnel || '').toLowerCase().includes(ql) ||
                      (l.affiliate || '').toLowerCase().includes(ql) ||
                      (l.stage || '').toLowerCase().includes(ql)
                    );
                  })
                  .slice(0, 8)
                  .map(l => ({
                    key: l.id,
                    value: `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.email || l.phone || String(l.id || ''),
                    label: `${l.firstName || ''} ${l.lastName || ''}`.trim() || '(no name)',
                    meta: [l.country, l.stage].filter(Boolean).join('  /  '),
                  }));
              }}
            />
            <label>
              Page size:
              <select className="small-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button className="crm-small-btn" onClick={handleClearAll}>Clear All Filters</button>
          </div>

          <div className="crm-lead-table-wrapper">
            <table className="crm-table crm-lead-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th onClick={() => handleSort('firstName')} className="crm-sortable">
                    First {sortColumn === 'firstName' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th onClick={() => handleSort('lastName')} className="crm-sortable">
                    Last {sortColumn === 'lastName' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th>Online</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th className={`crm-filter-column ${filterCountry ? 'crm-filtered' : ''}`}>
                    Country
                    <FilterPopover
                      label="Country"
                      value={filterCountry}
                      options={countries}
                      open={activeFilterDropdown === 'country'}
                      onToggle={() => setActiveFilterDropdown(activeFilterDropdown === 'country' ? '' : 'country')}
                      onSelect={(v) => handleFilterChange('country', v)}
                      onClose={() => setActiveFilterDropdown('')}
                    />
                  </th>
                  <th className={`crm-filter-column ${filterStatus ? 'crm-filtered' : ''}`}>
                    Status
                    <FilterPopover
                      label="Status"
                      value={filterStatus}
                      options={statuses}
                      open={activeFilterDropdown === 'status'}
                      onToggle={() => setActiveFilterDropdown(activeFilterDropdown === 'status' ? '' : 'status')}
                      onSelect={(v) => handleFilterChange('status', v)}
                      onClose={() => setActiveFilterDropdown('')}
                    />
                  </th>
                  <th className={`crm-filter-column ${filterFunnel ? 'crm-filtered' : ''}`}>
                    Funnel
                    <FilterPopover
                      label="Funnel"
                      value={filterFunnel}
                      options={funnels}
                      open={activeFilterDropdown === 'funnel'}
                      onToggle={() => setActiveFilterDropdown(activeFilterDropdown === 'funnel' ? '' : 'funnel')}
                      onSelect={(v) => handleFilterChange('funnel', v)}
                      onClose={() => setActiveFilterDropdown('')}
                    />
                  </th>
                  <th className={`crm-filter-column ${filterAffiliate ? 'crm-filtered' : ''}`}>
                    Affiliate
                    <FilterPopover
                      label="Affiliate"
                      value={filterAffiliate}
                      options={affiliates}
                      open={activeFilterDropdown === 'affiliate'}
                      onToggle={() => setActiveFilterDropdown(activeFilterDropdown === 'affiliate' ? '' : 'affiliate')}
                      onSelect={(v) => handleFilterChange('affiliate', v)}
                      onClose={() => setActiveFilterDropdown('')}
                    />
                  </th>
                  <th className={`crm-filter-column ${filterLastComment ? 'crm-filtered' : ''}`}>
                    Last Comment
                    <FilterPopover
                      label="Last comment"
                      value={filterLastComment}
                      options={lastComments}
                      open={activeFilterDropdown === 'lastComment'}
                      onToggle={() => setActiveFilterDropdown(activeFilterDropdown === 'lastComment' ? '' : 'lastComment')}
                      onSelect={(v) => handleFilterChange('lastComment', v)}
                      onClose={() => setActiveFilterDropdown('')}
                    />
                  </th>
                  <th className={`crm-filter-column ${filterRegistered ? 'crm-filtered' : ''}`}>
                    Registered
                    <FilterPopover
                      label="Registered"
                      value={filterRegistered}
                      options={registeredDates}
                      open={activeFilterDropdown === 'registered'}
                      onToggle={() => setActiveFilterDropdown(activeFilterDropdown === 'registered' ? '' : 'registered')}
                      onSelect={(v) => handleFilterChange('registered', v)}
                      onClose={() => setActiveFilterDropdown('')}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedLeads.map((lead) => {
                  const unread = unreadByLead[lead.id] || 0;
                  return (
                  <tr key={lead.id} onClick={() => navigate(getLeadProfilePath(ROLE.AGENT, currentUser.id, lead.id))}>
                    <td>
                      {formatLeadId(lead.id)}
                      {unread > 0 && (
                        <span
                          title={`${unread} unread message${unread === 1 ? '' : 's'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: 6,
                            background: '#f6465d',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            padding: '0 6px',
                            lineHeight: 1,
                          }}
                        >
                          <i className="fas fa-comment-dots" style={{ fontSize: '0.65rem', marginRight: 3 }} />
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </td>
                    <td>{lead.firstName}</td>
                    <td>{lead.lastName}</td>
                    <td>
                      <span className={`crm-online-dot ${lead.isOnline ? 'crm-online' : 'crm-offline'}`} title={lead.isOnline ? 'Online' : 'Offline'}></span>
                    </td>
                    <td>{lead.phone}</td>
                    <td>{lead.email}</td>
                    <td>{getCountryFlag(lead.countryCode, lead.country)}</td>
                    <td><span className={`crm-status-chip ${statusClass(normalizeStage(lead.stage))}`}>{normalizeStage(lead.stage)}</span></td>
                    <td>{lead.funnel || '-'}</td>
                    <td>{lead.affiliate || '-'}</td>
                    <td>{lead.lastCommentDate || '-'}</td>
                    <td>{lead.registeredDate || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-')}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredLeads.length === 0 && <div className="crm-empty-state">No assigned leads</div>}
          </div>

          <div className="crm-table-controls" style={{ marginTop: 0 }}>
            <span>Showing {pagedLeads.length} of {sortedLeads.length} leads</span>
            <button className="crm-small-btn crm-pagination-btn-gold" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span>Page {page}/{totalPages}</span>
            <button className="crm-small-btn crm-pagination-btn-gold" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      )}

      {nativeTabActive && activeTab === 'notifications' && (
        <div className="crm-card">
          <h3>Notifications</h3>
          <AdminNotificationsInbox pollMs={30000} />
        </div>
      )}

      {showCreateLead && createLead && (
        <CreateLeadModal
          scope={{ officeId: currentUser.officeId, teamId: currentUser.teamId, agentId: currentUser.id }}
          teamsForOffice={[]}
          agents={[]}
          onClose={() => setShowCreateLead(false)}
          onCreate={async (payload) => {
            const created = await createLead(payload);
            if (created) setShowCreateLead(false);
          }}
        />
      )}

    </div>
  );
}

function LeadProfilePage({ role, viewingUser, data, setData, updateLead, showNotification }) {
  const { leadId } = useParams();
  const currentUser = viewingUser;
  const isSuperAdmin = currentUser?.role === ROLE.SUPER_ADMIN;
  const navigate = useNavigate();
  const [confirmDialog, confirm] = useConfirmDialog();
  const workspacePath = getRoleWorkspacePath(role, currentUser?.id);
  const visibleLeads = getRoleScopedLeads(data, role, currentUser);
  const lead = visibleLeads.find((l) => l.id === leadId);
  const [profileSectionPermissions, setProfileSectionPermissions] = useState({});
  const [profilePermissionsError, setProfilePermissionsError] = useState('');
  const canReadAccessSection = isSuperAdmin || ['read', 'edit'].includes(profileSectionPermissions.access);
  const canEditAccessSection = isSuperAdmin || profileSectionPermissions.access === 'edit';
  const canReadAccountingSection = isSuperAdmin || ['read', 'edit'].includes(profileSectionPermissions.accounting);
  const canEditAccountingSection = isSuperAdmin || profileSectionPermissions.accounting === 'edit';
  const [status, setStatus] = useState(normalizeStage(lead?.stage || 'New'));
  const [comment, setComment] = useState(lead?.comment || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState('');
  // Live messages from the backend. The thread is keyed by lead.id (which
  // is the same as users.id since the unify-people migration). Sender is
  // 'agent' for staff replies, 'client' for the lead's own messages.
  const [clientChat, setClientChat] = useState([]);
  const [attachmentUrls, setAttachmentUrls] = useState({});
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [liveClientPassword, setLiveClientPassword] = useState(lead?.clientPassword || '');
  const [showChatModal, setShowChatModal] = useState(false);
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [isEditingRegistered, setIsEditingRegistered] = useState(false);
  const [registeredDateInput, setRegisteredDateInput] = useState('');

  useEffect(() => {
    if (lead) {
      const reg = lead.registeredDate || lead.registered_date || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '');
      setRegisteredDateInput(reg);
    }
  }, [lead?.id, lead?.registeredDate, lead?.createdAt]);

  useEffect(() => {
    let active = true;
    setProfileSectionPermissions({});
    setProfilePermissionsError('');
    if (!lead?.id || !currentUser?.id || isSuperAdmin) {
      return () => { active = false; };
    }

    getClientProfilePermissionsAdmin(lead.id)
      .then((result) => {
        if (active) setProfileSectionPermissions(result.myPermissions || {});
      })
      .catch(() => {
        if (active) setProfilePermissionsError('Could not verify access to this client’s account sections. They remain hidden until access can be checked.');
      });
    return () => { active = false; };
  }, [lead?.id, currentUser?.id, isSuperAdmin]);

  const displayRegisteredDate = (() => {
    const raw = lead?.registeredDate || lead?.registered_date || lead?.createdAt || lead?.created_at;
    if (!raw) return 'Recently';
    try {
      const d = new Date(raw);
      return !isNaN(d.getTime()) ? d.toLocaleDateString() : String(raw);
    } catch {
      return String(raw);
    }
  })();
  const chatEndRef       = useRef(null);
  const typingTimeoutRef = useRef(null);
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [clientChat, showChatModal]);

  // Pull the chat thread from the backend and poll while the chat modal is
  // open. Once closed we stop polling so we don't burn requests on every
  // open lead detail page that nobody is looking at. We also stamp every
  // unread CLIENT message as read on the very first load - opening the
  // chat IS the act of reading it, so the row badge clears in the same
  // tick the agent looks at the conversation.
  useEffect(() => {
    if (!lead?.id || !showChatModal) return undefined;
    let cancelled = false;
    let inFlight = false;
    let firstLoad = true;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await getAdminMessages(lead.id, { limit: 200 });
        if (cancelled) return;
        setClientChat(result.messages);
        if (firstLoad && result.unreadCount > 0) {
          markAdminMessagesRead(lead.id).catch(() => {});
        }
        firstLoad = false;
      } catch (err) {
        if (!cancelled) setChatError(err?.message || 'Could not load messages.');
      } finally {
        inFlight = false;
      }
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [lead?.id, showChatModal]);

  useEffect(() => {
    if (!showChatModal) return undefined;
    let cancelled = false;
    const loadAttachments = async () => {
      const rows = clientChat.filter(m => m.attachment && !attachmentUrls[m.id]);
      const loaded = await Promise.all(rows.map(async m => {
        try { return [m.id, await getAdminMessageAttachmentUrl(m.id)]; } catch (_) { return null; }
      }));
      const resolved = loaded.filter(Boolean);
      if (!cancelled && resolved.length > 0) {
        setAttachmentUrls(prev => ({ ...prev, ...Object.fromEntries(resolved) }));
      }
    };
    loadAttachments();
    return () => { cancelled = true; };
  }, [clientChat, showChatModal, attachmentUrls]);

  useEffect(() => {
    if (!showChatModal) setAttachmentUrls({});
  }, [lead?.id, showChatModal]);

  // Presence heartbeat: report agent as online while the chat modal is open.
  // Expires naturally on the client side (>60s = offline) when modal is closed.
  useEffect(() => {
    if (!lead?.id || !showChatModal) return undefined;
    const beat = () => postAdminPresence(lead.id, { isTyping: false }).catch(() => {});
    beat();
    const id = setInterval(beat, 20000);
    return () => clearInterval(id);
  }, [lead?.id, showChatModal]);

  // Typing indicator: fire is_typing=true on input change, then reset after 4s idle.
  useEffect(() => {
    if (!lead?.id || !showChatModal || !chatInput.trim()) return;
    postAdminPresence(lead.id, { isTyping: true }).catch(() => {});
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      postAdminPresence(lead.id, { isTyping: false }).catch(() => {});
    }, 4000);
  }, [chatInput, lead?.id, showChatModal]);

  // Delete a single message on both sides. Optimistically removes the
  // bubble locally, then asks the backend. Rollback on failure so the
  // agent never sees a "ghost-deleted" row reappear on the next poll.
  const handleDeleteMessage = async (messageId) => {
    if (!messageId || String(messageId).startsWith('tmp-')) return;
    const ok = await confirm({
      title: 'Delete message?',
      message: 'This removes the message for both the agent and the client. There will be no trace.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const snapshot = clientChat;
    setClientChat(prev => prev.filter(m => m.id !== messageId));
    try {
      await deleteAdminMessage(messageId);
    } catch (err) {
      setClientChat(snapshot);
      showNotification && showNotification(err?.message || 'Failed to delete message.');
    }
  };

  // Wipe the entire conversation on both sides. Same confirm-then-call
  // pattern. We close the modal afterwards because there's nothing left
  // to look at.
  const handleClearChat = async () => {
    if (!lead?.id) return;
    const ok = await confirm({
      title: 'Clear entire chat?',
      message: `This deletes every message between you and ${lead.firstName} ${lead.lastName} for both sides. There will be no trace.`,
      confirmLabel: 'Clear chat',
      tone: 'danger',
    });
    if (!ok) return;
    const snapshot = clientChat;
    setClientChat([]);
    try {
      await clearAdminChat(lead.id);
      showNotification && showNotification('Chat cleared.');
    } catch (err) {
      setClientChat(snapshot);
      showNotification && showNotification(err?.message || 'Failed to clear chat.');
    }
  };


  const handleSetLeadPassword = async () => {
    if (!lead || !passwordInput.trim()) return;
    const pwd = passwordInput.trim();
    try {
      await adminSetClientPassword(lead.id, pwd);
      updateLead(lead.id, { clientPassword: pwd, client_password: pwd });
      setLiveClientPassword(pwd);
      setPasswordInput('');
      showNotification(`Password updated for ${lead.firstName} ${lead.lastName}.`, 'success');
    } catch (err) {
      showNotification(`Failed to set password: ${err.message || 'unknown error'}`, 'error');
    }
  };

  useEffect(() => {
    if (lead) {
      setStatus(normalizeStage(lead.stage || 'New'));
      setComment(lead.comment || '');
      setPasswordInput('');
    }
  }, [lead?.id, lead?.stage]);

  useEffect(() => {
    if (!lead?.id) return;
    const initialPwd = lead?.clientPassword || lead?.client_password || portalDb.getClientPassword(lead.id) || '';
    setLiveClientPassword(initialPwd);
    if (!showSecurityModal) return;
    let cancelled = false;
    fetchLeadById(lead.id)
      .then((fresh) => {
        if (!cancelled && (fresh?.clientPassword || fresh?.client_password)) {
          setLiveClientPassword(fresh.clientPassword || fresh.client_password);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showSecurityModal, lead?.id]);

  const handleSendClientMessage = async () => {
    const text = chatInput.trim();
    if (!lead || !text || chatSending) return;
    setChatSending(true);
    setChatError('');
    clearTimeout(typingTimeoutRef.current);
    postAdminPresence(lead.id, { isTyping: false }).catch(() => {});
    // Optimistic insert so the agent sees their message immediately even
    // before the backend confirms. We tag it with a temp id and overwrite
    // the row when the saved message comes back.
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id:        tempId,
      sender:    'agent',
      text,
      body:      text,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      readAt:    null,
      pending:   true,
    };
    setClientChat(prev => [...prev, optimistic]);
    setChatInput('');
    try {
      const saved = await sendAdminMessage(lead.id, text);
      setClientChat(prev => prev.map(m => (m.id === tempId && saved ? saved : m)));
    } catch (err) {
      // Roll back the optimistic insert and put the text back so the
      // agent can retry without retyping.
      setClientChat(prev => prev.filter(m => m.id !== tempId));
      setChatInput(text);
      setChatError(err?.message || 'Failed to send message.');
      showNotification && showNotification(err?.message || 'Failed to send message.');
    } finally {
      setChatSending(false);
    }
  };

  if (!lead) {
    return (
      <div className="crm-card">
        <h2>Client Not Found</h2>
        <p>This client either does not exist or is not available to this admin.</p>
        <button className="crm-small-btn" onClick={() => navigate(workspacePath)}>Back to clients</button>
      </div>
    );
  }

  const currentIndex = visibleLeads.findIndex((l) => l.id === lead.id);
  const prevLead = visibleLeads[currentIndex - 1] || null;
  const nextLead = visibleLeads[currentIndex + 1] || null;

  const handleStatusChange = (newStatus) => {
    if (newStatus === status) return;
    setStatus(newStatus);
    updateLead(lead.id, { stage: newStatus, lastCommentDate: new Date().toISOString().slice(0, 10) });
    showNotification(`Lead status updated to ${newStatus}.`);
  };

  const actorName = currentUser?.name || 'Unknown';
  const handleAddComment = () => {
    if (!comment.trim()) return;
    updateLead(lead.id, { comment: comment.trim(), lastCommentDate: new Date().toISOString().slice(0, 10), _actorName: actorName, _actorId: currentUser?.id });
    showNotification('Comment posted successfully.');
    setComment('');
  };

  const handleDeleteComment = async (commentId) => {
    if (!isSuperAdmin) return;
    const ok = await confirm({
      title: 'Delete comment?',
      message: 'Delete this comment from the lead history? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await deleteLeadCommentApi(lead.id, commentId);
      if (updated && updated.id) {
        updateLead(lead.id, { commentHistory: updated.commentHistory, statusHistory: updated.statusHistory, _actorName: actorName, _actorId: currentUser?.id });
      }
      showNotification('Comment removed.');
    } catch (err) {
      console.error('[AgentPanel] deleteComment failed', err);
      showNotification('Failed to delete comment.');
    }
  };

  const handleDeleteStatusEntry = async (idx) => {
    if (!isSuperAdmin) return;
    const entry = (lead.statusHistory || [])[idx];
    if (!entry) return;
    const ok = await confirm({
      title: 'Delete status entry?',
      message: 'Delete this status-change entry from the lead history? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const serverLead = await deleteLeadStatusEntryApi(lead.id, entry.id);
      if (serverLead?.id) {
        updateLead(lead.id, { ...serverLead, _actorName: actorName, _actorId: currentUser?.id });
      }
      showNotification('Status entry removed.');
    } catch {
      showNotification('Failed to delete status entry - please try again.');
    }
  };

  const handleAddAppointment = async () => {
    if (!appointmentDate || !appointmentTime || !appointmentTitle.trim()) {
      showNotification('Date, time, and title are required to create appointment.');
      return;
    }
    setAppointmentSaving(true);
    try {
      const appointment = await createUserAppointment(lead.id, {
        title: appointmentTitle.trim(),
        date: appointmentDate,
        time: appointmentTime,
        notes: appointmentNotes.trim() || 'No additional notes',
        type: 'call',
      });
      if (!appointment?.id) throw new Error('The server did not return the saved appointment.');
      setData((previous) => ({
        ...previous,
        leads: previous.leads.map((item) =>
          item.id === lead.id
            ? { ...item, appointments: [...(item.appointments || []), appointment] }
            : item
        ),
      }));
      showNotification('Appointment scheduled successfully.');
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentTitle('');
      setAppointmentNotes('');
      setShowAppointmentModal(false);
    } catch (error) {
      showNotification(error?.message || 'Failed to save appointment.');
    } finally {
      setAppointmentSaving(false);
    }
  };

  const commentHistory = (lead.commentHistory || []).filter(
    (c) => c && c.text && !/^assigned to\b/i.test(String(c.text).trim())
  );
  const statusHistory = lead.statusHistory || [];
  const assignedByDisplay = (lead.assignedBy || '').split('→').pop().trim() || '-';

  return (
    <>
    {confirmDialog}
    <div className="crm-card crm-agent-profile-full">
      <div className="crm-panel-header">
        <div className="crm-nav-left">
          <button className="crm-small-btn" onClick={() => navigate(workspacePath)}>Back to clients</button>
        </div>
        <div className="crm-nav-right">
          <button className="crm-small-btn" onClick={() => prevLead && navigate(getLeadProfilePath(role, currentUser.id, prevLead.id))} disabled={!prevLead}>◀ Prev</button>
          <button className="crm-small-btn" onClick={() => nextLead && navigate(getLeadProfilePath(role, currentUser.id, nextLead.id))} disabled={!nextLead}>Next ▶</button>
        </div>
      </div>
      <div className="crm-section-title" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: lead.isOnline ? '#0ECB81' : 'var(--crm-text-secondary)', display: 'inline-block' }} />
            <span style={{ color: lead.isOnline ? '#0ECB81' : 'var(--crm-text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {lead.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <h2 style={{ margin: 0 }}>Client Profile: {lead.firstName || lead.name} {lead.lastName || ''}</h2>
        </div>
        <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
          <button
            className="crm-small-btn crm-action-btn crm-login-btn"
            style={{ whiteSpace: 'nowrap' }}
            onClick={async () => {
              if (!lead?.id) return;
              try {
                await enterClientPortal(lead.id);
              } catch (error) {
                showNotification(error?.message || 'Could not enter client account.');
              }
            }}
          >
            Enter Client Account
          </button>
        </div>
        <div className="crm-profile-action-buttons">
          <button type="button" className="crm-action-btn crm-activity-btn" onClick={() => setShowActivityModal(true)} title="View client activity"><PaIcon name="activity" />Activity</button>
          <button type="button" className="crm-action-btn crm-appointment-btn" onClick={() => setShowAppointmentModal(true)} title="Schedule appointment"><PaIcon name="appointment" />Appointments</button>
          <button type="button" className="crm-action-btn crm-security-btn" onClick={() => setShowSecurityModal(true)} title="Client security settings"><PaIcon name="security" />Client Security</button>
          <button type="button" className="crm-action-btn crm-support-btn" onClick={() => setShowChatModal(true)} title="Open support chat"><PaIcon name="support" />Client Support</button>
        </div>
      </div>

      {/* Quick Direct Communication Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 18px', flexWrap: 'wrap' }}>
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(10, 132, 255, 0.15)', color: '#0A84FF', border: '1px solid rgba(10, 132, 255, 0.3)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
            title="Send email"
          >
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span>Email: {lead.email}</span>
          </a>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(52, 199, 89, 0.15)', color: '#34C759', border: '1px solid rgba(52, 199, 89, 0.3)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
            title="Call lead"
          >
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            <span>Call: {lead.phone}</span>
          </a>
        )}
        {lead.phone && (
          <a
            href={`https://wa.me/${String(lead.phone).replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Hi ${lead.firstName || lead.name}, thank you for contacting Codex Dynamics.`)}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
            title="WhatsApp chat"
          >
            <span>WhatsApp Direct</span>
          </a>
        )}
      </div>

      <div className="crm-detail-grid crm-detail-grid-three">
        <div className="crm-detail-column">
          <div className="crm-detail-row"><span className="crm-label">ID</span><span className="crm-value">{formatLeadId(lead.id)}</span></div>
          <div className="crm-detail-row"><span className="crm-label">Name</span><span className="crm-value">{lead.firstName} {lead.lastName}</span></div>
          <div className="crm-detail-row"><span className="crm-label">Phone</span><span className="crm-value">{lead.phone} <button type="button" className="crm-copy-icon" onClick={() => { navigator.clipboard.writeText(lead.phone); showNotification('Phone copied to clipboard'); }} aria-label="Copy phone"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg></button></span></div>
          <div className="crm-detail-row"><span className="crm-label">Email</span><span className="crm-value">{lead.email} <button type="button" className="crm-copy-icon" onClick={() => { navigator.clipboard.writeText(lead.email); showNotification('Email copied to clipboard'); }} aria-label="Copy email"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg></button></span></div>
          <div className="crm-detail-row"><span className="crm-label">Country</span><span className="crm-value crm-country-value">{getCountryFlag(lead.countryCode, lead.country)}<span className="crm-country-name">{lead.country || '-'}</span></span></div>
        </div>
        <div className="crm-detail-column">
          <div className="crm-detail-row"><span className="crm-label">Company</span><span className="crm-value">{lead.company || '-'}</span></div>
          <div className="crm-detail-row"><span className="crm-label">Service</span><span className="crm-value" style={{ color: '#0A84FF', fontWeight: 600 }}>{lead.service || lead.funnel || '-'}</span></div>
          <div className="crm-detail-row"><span className="crm-label">Budget</span><span className="crm-value" style={{ color: '#34C759', fontWeight: 600 }}>{lead.budget || '-'}</span></div>
          <div className="crm-detail-row"><span className="crm-label">Timeline</span><span className="crm-value">{lead.timeline || '-'}</span></div>
          <div className="crm-detail-row"><span className="crm-label">Origin</span><span className="crm-value">{lead.source === 'website_contact_modal' ? 'Website Modal' : lead.source === 'website_contact_form' ? 'Website Form' : (lead.source || '-')}</span></div>
        </div>
        <div className="crm-detail-column">
          <div className="crm-detail-row"><span className="crm-label">Status</span><span className={`crm-status-chip ${statusClass(status)}`}>{status}</span></div>
          <div className="crm-field-group crm-status-dropdown-right">
            <label>Select Status</label>
            <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
              {LEAD_STATUSES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              type="button"
              className="crm-post-comment-btn"
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
              onClick={() => {
                if (status === lead.stage) {
                  showNotification('Status unchanged.');
                  return;
                }
                updateLead(lead.id, { stage: status, _actorName: actorName, _actorId: currentUser?.id });
                showNotification('Status saved to workflow.');
              }}
            >Save Status</button>
          </div>
          <div className="crm-detail-row"><span className="crm-label">Office / Team</span><span className="crm-value">{getOfficeName(lead.assignedToOffice, data.offices)} · {getTeamName(lead.assignedToTeam, data.teams)}</span></div>
          <div className="crm-detail-row">
            <span className="crm-label">Registered</span>
            <span className="crm-value">
              {isEditingRegistered ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={registeredDateInput ? (isNaN(new Date(registeredDateInput).getTime()) ? '' : new Date(registeredDateInput).toISOString().slice(0, 10)) : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-');
                        const dObj = new Date(Number(y), Number(m) - 1, Number(d));
                        setRegisteredDateInput(dObj.toLocaleDateString());
                      }
                    }}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--crm-border)',
                      borderRadius: 6,
                      color: 'var(--crm-text-primary)',
                      padding: '2px 8px',
                      fontSize: 12,
                    }}
                  />
                  <button
                    type="button"
                    className="crm-small-btn"
                    style={{ padding: '2px 8px', fontSize: 11, background: '#0A84FF', color: '#fff' }}
                    onClick={async () => {
                      if (!registeredDateInput) return;
                      await updateLead(lead.id, { registeredDate: registeredDateInput, registered_date: registeredDateInput });
                      setIsEditingRegistered(false);
                      showNotification && showNotification('Registered date updated.');
                    }}
                  >Save</button>
                  <button
                    type="button"
                    className="crm-small-btn"
                    style={{ padding: '2px 6px', fontSize: 11, opacity: 0.7 }}
                    onClick={() => setIsEditingRegistered(false)}
                  >✕</button>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>{displayRegisteredDate}</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingRegistered(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--crm-accent, #0A84FF)',
                      fontSize: 11,
                      cursor: 'pointer',
                      padding: '1px 4px',
                      textDecoration: 'underline',
                    }}
                    title="Click to edit registered date"
                  >
                    Edit
                  </button>
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Submission Message */}
      {lead.message && (
        <div style={{ background: '#2B2F38', border: '1px solid var(--crm-border)', borderRadius: 10, padding: 16, margin: '18px 0 22px' }}>
          <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            Customer Submission Message
          </div>
          <div style={{ color: 'var(--crm-text-primary)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic', background: 'rgba(0, 0, 0, 0.2)', padding: 14, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            "{lead.message}"
          </div>
        </div>
      )}

      {/* Internal Staff Follow-Up Notes */}
      {lead.notes && (
        <div style={{ background: '#2B2F38', border: '1px solid var(--crm-border)', borderRadius: 10, padding: 16, margin: '0 0 22px' }}>
          <div style={{ fontSize: 11, color: 'var(--crm-accent)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            Internal Staff Follow-Up Notes
          </div>
          <div style={{ color: 'var(--crm-text-primary)', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {lead.notes}
          </div>
        </div>
      )}

      {profilePermissionsError && !isSuperAdmin && (
        <div role="alert" style={{ background: '#2B2F38', border: '1px solid rgba(255, 113, 107, 0.35)', borderRadius: 10, padding: 14, margin: '0 0 18px', color: '#ff716b', fontSize: 12 }}>
          {profilePermissionsError}
        </div>
      )}

      {(canReadAccessSection || canReadAccountingSection || isSuperAdmin) && (
        <section aria-label="Client account sections" style={{ display: 'grid', gap: 16, margin: '22px 0' }}>
          <h3 style={{ margin: 0, color: 'var(--crm-text-primary)' }}>Client Account</h3>
          {canReadAccessSection && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border)', borderRadius: 12, padding: 18 }}>
              <ClientAccessEditor clientId={lead.id} showNotification={showNotification} canEdit={canEditAccessSection} />
            </div>
          )}
          {canReadAccountingSection && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border)', borderRadius: 12, padding: 18 }}>
              <ClientAccountingPanel clientId={lead.id} showNotification={showNotification} canEdit={canEditAccountingSection} />
            </div>
          )}
          {isSuperAdmin && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border)', borderRadius: 12, padding: 18 }}>
              <ClientProfilePermissionManager clientId={lead.id} showNotification={showNotification} />
            </div>
          )}
        </section>
      )}

      <div className="crm-profile-grid">
        <div className="crm-profile-column crm-comment-column">
          <div className="crm-comment-card">
            <h3>Comment</h3>
            <div className="crm-comment-input-area">
              <textarea rows={10} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note about this lead..." />
              <div className="crm-comment-input-actions">
                <button className="crm-post-comment-btn" onClick={handleAddComment} disabled={!comment.trim()}>Save</button>
              </div>
            </div>
          </div>

          <div className="crm-comment-history-card">
            <h3>Comment History</h3>
            {commentHistory.length === 0 ? (
              <p>No comments yet. Please add client interaction notes.</p>
            ) : (
              <div className="crm-comment-history-container">
                <ul className="crm-comment-history-list">
                  {commentHistory.map((entry, idx) => (
                    <li key={entry.date + '-' + idx} className="crm-comment-history-item">
                      <div className="crm-comment-meta">
                        <span className="crm-comment-author">{entry.by || 'Unknown'}</span>
                        <span className="crm-comment-date">
                          {entry.date}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(entry.id)}
                              style={{ marginLeft: 8, background: 'transparent', border: '1px solid #ff646440', color: '#ff6464', fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                              title="Delete comment (super admin)"
                            >✕</button>
                          )}
                        </span>
                      </div>
                      <div className="crm-comment-text">{entry.text}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="crm-status-workflow-column">
          <div className="crm-status-workflow-card">
            <h3>Status Workflow</h3>
            <div className="crm-status-timeline">
              {statusHistory.length === 0 ? (
                <div className="crm-status-timeline-empty">No status changes recorded yet. Update the status to start tracking the workflow.</div>
              ) : (
                statusHistory.map((entry, idx) => {
                  return (
                    <div key={idx} className="crm-status-timeline-row">
                      <div className="crm-status-timeline-arrow">
                        <span className="crm-status-pill" style={{ color: stageColor(entry.from), border: `1px solid ${stageColor(entry.from)}`, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'transparent' }}>{entry.from}</span>
                        <span className="crm-status-pill-arrow">→</span>
                        <span className="crm-status-pill" style={{ color: stageColor(entry.to), border: `1px solid ${stageColor(entry.to)}`, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'transparent' }}>{entry.to}</span>
                      </div>
                      <div className="crm-status-timeline-meta">
                      <span>By <span className="crm-by">{entry.byName || 'Unknown'}</span></span>
                      <span>{entry.at ? new Date(entry.at).toLocaleString() : ''}</span>
                    </div>
                    {isSuperAdmin && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" className="crm-delete-entry-btn" onClick={() => handleDeleteStatusEntry(idx)}>✕ Delete entry</button>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showAppointmentModal && (
        <div className="crm-modal-overlay" onClick={() => setShowAppointmentModal(false)}>
          <div className="crm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Schedule Appointment for {lead.firstName} {lead.lastName}</h3>
              <button className="crm-small-btn" onClick={() => setShowAppointmentModal(false)}>Close</button>
            </div>
            <div className="crm-field-group">
              <label>Title</label>
              <input className="crm-input" type="text" value={appointmentTitle} placeholder="e.g., Proposal meeting" onChange={(e) => setAppointmentTitle(e.target.value)} />
            </div>
            <div className="crm-field-group">
              <label>Date</label>
              <input className="crm-input" type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
            </div>
            <div className="crm-field-group">
              <label>Time</label>
              <input className="crm-input" type="time" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} />
            </div>
            <div className="crm-field-group">
              <label>Notes</label>
              <textarea className="crm-input" rows={4} value={appointmentNotes} placeholder="Optional notes" onChange={(e) => setAppointmentNotes(e.target.value)} />
            </div>
            <div className="crm-comment-input-actions" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="crm-post-comment-btn" onClick={handleAddAppointment} disabled={appointmentSaving || !appointmentDate || !appointmentTime || !appointmentTitle.trim()}>{appointmentSaving ? 'Saving…' : 'Save Appointment'}</button>
            </div>
          </div>
        </div>
      )}

      {showSecurityModal && (
        <div className="crm-modal-overlay" onClick={() => setShowSecurityModal(false)}>
          <div className="crm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Client Security - {lead.firstName} {lead.lastName}</h3>
              <button className="crm-small-btn" onClick={() => setShowSecurityModal(false)}>Close</button>
            </div>
            <div className="crm-field-group" style={{ marginBottom: 12 }}>
              <label>Current Password</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="crm-input"
                  type={showClientPassword ? 'text' : 'password'}
                  value={liveClientPassword}
                  readOnly
                  placeholder="Not set"
                  style={{ flex: 1 }}
                />
                <button
                  className="crm-small-btn"
                  type="button"
                  onClick={() => setShowClientPassword((prev) => !prev)}
                >
                  {showClientPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="crm-field-group" style={{ marginBottom: 12 }}>
              <label>New Password</label>
              <input className="crm-input" type="text" value={passwordInput} placeholder="Enter new password" onChange={(e) => setPasswordInput(e.target.value)} autoComplete="off" />
            </div>
            <div className="crm-row" style={{ gap: 8, marginBottom: 12 }}>
              <button className="crm-small-btn" onClick={handleSetLeadPassword} disabled={!passwordInput.trim()}>Save Password</button>
            </div>
          </div>
        </div>
      )}

      {showChatModal && (
        <div className="crm-modal-overlay" onClick={() => setShowChatModal(false)}>
          <div className="crm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Support Chat with {lead.firstName}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="crm-small-btn"
                  onClick={handleClearChat}
                  disabled={clientChat.length === 0}
                  style={{
                    background: '#f6465d',
                    color: '#fff',
                    borderColor: '#f6465d',
                    opacity: clientChat.length === 0 ? 0.5 : 1,
                  }}
                  title="Delete every message in this conversation, on both sides"
                >
                  <i className="fas fa-trash" style={{ marginRight: 4 }} /> Clear chat
                </button>
                <button className="crm-small-btn" onClick={() => setShowChatModal(false)}>Close</button>
              </div>
            </div>
            <div className="crm-chat-window">
              <div className="crm-chat-header">
                <span>{lead.firstName} {lead.lastName}</span>
                <span className={`crm-online-dot ${lead.isOnline ? 'crm-online' : 'crm-offline'}`} />
              </div>
              <div className="crm-chat-box">
                {clientChat.length === 0 && <div className="crm-chat-empty">No messages yet. Start the chat below.</div>}
                {clientChat.map((msg) => {
                  const canDelete = !msg.pending && !String(msg.id).startsWith('tmp-');
                  return (
                  <div key={msg.id} className={`crm-chat-message ${msg.sender === 'agent' ? 'crm-chat-agent' : 'crm-chat-client'}`}>
                    {canDelete && msg.sender === 'agent' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete message for both sides"
                        aria-label="Delete message"
                        className="crm-chat-delete-btn"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    )}
                    <div className="crm-chat-msg-col">
                      <div className="crm-chat-sender-label">
                        {msg.sender === 'agent'
                          ? (msg.name || currentUser?.name || 'Agent')
                          : `${lead.firstName} ${lead.lastName}`}
                      </div>
                      <div className="crm-chat-bubble">
                        <span>{msg.text}{msg.pending ? '  /  sending...' : ''}</span>
                        {msg.attachment && (attachmentUrls[msg.id]
                          ? (
                            <div className="crm-chat-attachment">
                              <img src={attachmentUrls[msg.id]} alt={msg.attachment.name || 'Client attached photo'} />
                              <a
                                href={attachmentUrls[msg.id]}
                                download={msg.attachment.name || 'client-photo'}
                                className="crm-chat-attachment-download"
                              >
                                <i className="fas fa-download" /> Download photo
                              </a>
                            </div>
                          )
                          : <small>Loading attached photo...</small>)}
                        <small>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}</small>
                      </div>
                    </div>
                    {canDelete && msg.sender !== 'agent' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete message for both sides"
                        aria-label="Delete message"
                        className="crm-chat-delete-btn"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    )}
                  </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              {chatError && (
                <div className="crm-chat-empty" role="alert" style={{ color: 'var(--danger, #c0392b)' }}>{chatError}</div>
              )}
              <div className="crm-chat-input-row">
                <input
                  type="text"
                  className="crm-input"
                  placeholder="Type a message (Enter to send)"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendClientMessage();
                    }
                  }}
                  disabled={chatSending}
                  autoComplete="off"
                />
                <button className="crm-small-btn" onClick={handleSendClientMessage} disabled={chatSending || !chatInput.trim()}>
                  {chatSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="crm-modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="crm-modal-content crm-extra-large-modal">
            <div className="crm-modal-header">
              <h3>[chart] Lead Activity - {lead.firstName} {lead.lastName}</h3>
              <button className="crm-close-btn" onClick={() => setShowActivityModal(false)}>×</button>
            </div>
            <div className="crm-modal-body">
              <div className="crm-activity-container">
                <div className="crm-activity-overview">
                  <div className="crm-activity-card">
                    <div className="crm-activity-icon">View</div>
                    <div className="crm-activity-value">{lead.activityRecord?.pageViews || 0}</div>
                    <div className="crm-activity-label">Page Views</div>
                  </div>
                  <div className="crm-activity-card">
                    <div className="crm-activity-icon">🔄</div>
                    <div className="crm-activity-value">{lead.activityRecord?.sessions || 0}</div>
                    <div className="crm-activity-label">Sessions</div>
                  </div>
                  <div className="crm-activity-card">
                    <div className="crm-activity-icon">📅</div>
                    <div className="crm-activity-value">
                      {lead.activityRecord?.lastLogin ?
                        Math.floor((new Date() - new Date(lead.activityRecord.lastLogin)) / (1000 * 60 * 60 * 24)) : 0
                      }
                    </div>
                    <div className="crm-activity-label">Days Since Login</div>
                  </div>
                  <div className="crm-activity-card">
                    <div className="crm-activity-icon">⚡</div>
                    <div className="crm-activity-value">
                      {lead.activityRecord?.pageViews && lead.activityRecord?.sessions ?
                        Math.round(lead.activityRecord.pageViews / lead.activityRecord.sessions) : 0
                      }
                    </div>
                    <div className="crm-activity-label">Avg Pages/Session</div>
                  </div>
                </div>

                <div className="crm-activity-chart">
                  <h4>Activity Timeline</h4>
                  <div className="crm-activity-timeline">
                    {lead.activityRecord ? (
                      <>
                        <div className="crm-timeline-item">
                          <div className="crm-timeline-icon">🔑</div>
                          <div className="crm-timeline-content">
                            <div className="crm-timeline-title">Last Login</div>
                            <div className="crm-timeline-description">Lead last accessed their account</div>
                            <div className="crm-timeline-time">{new Date(lead.activityRecord.lastLogin).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</div>
                          </div>
                        </div>
                        <div className="crm-timeline-item">
                          <div className="crm-timeline-icon">[chart]</div>
                          <div className="crm-timeline-content">
                            <div className="crm-timeline-title">Session Activity</div>
                            <div className="crm-timeline-description">{lead.activityRecord.sessions} sessions recorded</div>
                            <div className="crm-timeline-time">Total page views: {lead.activityRecord.pageViews}</div>
                          </div>
                        </div>
                        <div className="crm-timeline-item">
                          <div className="crm-timeline-icon">[agent]</div>
                          <div className="crm-timeline-content">
                            <div className="crm-timeline-title">Engagement Metrics</div>
                            <div className="crm-timeline-description">Lead engagement and platform usage</div>
                            <div className="crm-timeline-time">Average {Math.round(lead.activityRecord.pageViews / lead.activityRecord.sessions) || 0} pages per session</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="crm-timeline-item">
                        <div className="crm-timeline-icon"></div>
                        <div className="crm-timeline-content">
                          <div className="crm-timeline-title">No Activity Recorded</div>
                          <div className="crm-timeline-description">Activity data will appear here once the client starts using the platform</div>
                          <div className="crm-timeline-time">Monitoring started: {new Date().toLocaleDateString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="crm-export-section">
                  <button className="crm-export-btn" onClick={() => {
                    const data = lead.activityRecord ? [{
                      lastLogin: lead.activityRecord.lastLogin,
                      pageViews: lead.activityRecord.pageViews,
                      sessions: lead.activityRecord.sessions
                    }] : [];
                    const csv = 'Last Login,Page Views,Sessions\n' + data.map(d => `${d.lastLogin},${d.pageViews},${d.sessions}`).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `activity-report-${lead.firstName}-${lead.lastName}.csv`;
                    a.click();
                    showNotification('Activity report exported successfully');
                  }}>
                    [chart] Export Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditLeadModal && (
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEditLeadModal(false)}
          onSave={(updates) => {
            updateLead(lead.id, { ...updates, _actorName: actorName, _actorId: currentUser?.id });
            setShowEditLeadModal(false);
            showNotification(`Profile updated for ${updates.firstName || lead.firstName} ${updates.lastName || lead.lastName}`);
          }}
        />
      )}

    </div>
    </>
  );
}

export { LeadProfilePage };
export default AgentPanel;
