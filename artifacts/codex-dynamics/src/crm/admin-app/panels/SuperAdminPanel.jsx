import React, { useState, useEffect, useMemo, useRef } from 'react';
import { enterClientPortal } from '../clientImpersonation.js';
import { useNavigate } from 'react-router-dom';
import {
  ROLE, LEAD_STATUSES, normalizeStage, NotificationContext, DataContext,
  getOfficeName, getTeamName, getUserName, getCountryFlag, statusClass,
  EditLeadModal, makeLoginLink,
  EditOfficeModal, EditTeamModal, EditAgentModal,
  StatusDropdown,
} from '../shared';
import { useConfirmDialog } from '../components/ConfirmModal/ConfirmModal';
import Dashboard from '../components/Dashboard/Dashboard.jsx';
import SiteSettingsTab from '../components/SiteSettings/SiteSettingsTab.jsx';
import CrmSettingsTab from '../components/CrmSettings/CrmSettingsTab.jsx';
import ProjectsTab from '../components/Projects/ProjectsTab.jsx';
import SiteCrmWorkspace from '../components/SiteCrmWorkspace.jsx';
import LeadProfileModal from '../components/LeadProfileModal.jsx';
import StaffProfileModal from '../components/StaffProfileModal.jsx';
import AuditLog from '../components/AuditLog/AuditLog.jsx';
import Notifications from '../components/Notifications/Notifications.jsx';
import NotificationToast from '../components/NotificationToast/NotificationToast.jsx';
import AccountingWorkspace from '../components/AccountingWorkspace.jsx';
import SecurityRequests from '../components/SecurityRequests/SecurityRequests.jsx';
import Sessions from '../components/Sessions/Sessions.jsx';
import AgentAccess from '../components/AgentAccess.jsx';
import HealthIndicator from '../components/HealthIndicator/HealthIndicator.jsx';
import { SearchAutocomplete } from '../components/UserChrome.jsx';
import { CountrySelect, PhoneInput, buildStoredPhone } from '../components/CountryPhoneInput/CountryPhoneInput';
import { COUNTRY_LIST } from '../countryData';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell, faBuilding, faCog, faPalette, faHistory, faIdCard, faTachometerAlt, faTrash, faUser, faUserPlus, faUsers,
  faArrowDown, faArrowUp, faKey, faGlobe, faComments, faBriefcase, faFileInvoiceDollar,
} from '@fortawesome/free-solid-svg-icons';
import {
  getAdminToken, getUserProfileHistoryApi,
  bulkAssignLeadsApi, bulkAssignLeadAssignmentsApi, deleteOffice, deleteTeam, deleteStaffApi, updateOffice, updateTeam,
  createStaffApi, updateStaffApi, resetLeadStatusApi, clearLeadCommentsApi,
  updateLeadApi, deleteLeadApi, restoreLeadApi,
  getLeadNotificationsAsAdmin, getAdminPendingCounts,
  restoreOfficeApi, restoreTeamApi, restoreStaffApi, deleteOfficePermanent, deleteTeamPermanent,
  blockStaffApi, unblockStaffApi,
  listRecentAuditLog,
  deleteProfileHistoryEntryApi, clearProfileHistoryApi,
  importLeadsApi, bulkUpdateLeadStatusApi, cleanupBinApi, purgeBinLeads,
  sendHeartbeat,
  searchAdminLeads,
} from '../adminApi';
import { fetchAdminSettings } from '../../platformDefaults';
import { getLeadProfilePath } from '../leadProfileRouting';
import { matchesLeadOwnershipFilter, matchesStaffStructureFilter } from '../leadOwnership';
import { normalizeCsvHeader, parseCsvRows } from '../csvUtils';
import {
  createLogAdminAction,
  createLogActivity,
} from '../data/data';

function AllLeadsTable({ data, currentUser, setData, setLeadAssignment, showNotification, onOpenProfile }) {
  const navigate = useNavigate();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterTeamLeader, setFilterTeamLeader] = useState('');
  const [filterOwnership, setFilterOwnership] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [binPage, setBinPage] = useState(1);
  const pageSize = 20;
  const [view, setView] = useState('active'); // 'active' | 'bin'

  // Bulk selection & assignment state
  const [selected, setSelected] = useState([]);
  const [binSelected, setBinSelected] = useState([]);
  const [bulkMode, setBulkMode] = useState(null); // null | 'assign' | 'shuffle'
  const [bulkOfficeId, setBulkOfficeId] = useState('');
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkTeamLeaderId, setBulkTeamLeaderId] = useState('');
  const [bulkAgentId, setBulkAgentId] = useState('');
  const [shuffleScope, setShuffleScope] = useState('agents'); // 'offices' | 'teams' | 'agents'
  const [shuffleTargets, setShuffleTargets] = useState([]); // array of ids
  const [shuffleStatus, setShuffleStatus] = useState(''); // optional pre-filter

  // Lead profile modal state
  const [profileLead, setProfileLead] = useState(null);
  const [profileStage, setProfileStage] = useState('');
  const [profileComment, setProfileComment] = useState('');
  const [reassignOfficeId, setReassignOfficeId] = useState('');
  const [reassignTeamId, setReassignTeamId] = useState('');
  const [reassignAgentId, setReassignAgentId] = useState('');

  // Profile change history (fetched when lead profile modal opens)
  const [profileHistory, setProfileHistory] = useState([]);
  const [profileHistoryLoading, setProfileHistoryLoading] = useState(false);
  const [profileHistoryError, setProfileHistoryError] = useState('');

  // Edit modal state for inline row buttons
  const [editingLead, setEditingLead] = useState(null);

  // Quick per-row assign popover
  const [quickAssignLeadId, setQuickAssignLeadId] = useState(null);
  const [quickAssignAgentId, setQuickAssignAgentId] = useState('');

  // Client ID lookup
  const [idLookupQuery, setIdLookupQuery] = useState('');

  const handleLeadStatusChange = async (leadId, newStage) => {
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l => (l.id === leadId ? { ...l, stage: newStage, status: newStage } : l)),
    }));
    try {
      await updateLeadApi(leadId, { stage: newStage, status: newStage });
      showNotification(`Status updated to "${newStage}".`);
    } catch (err) {
      showNotification('Failed to update status.');
    }
  };

  const handleQuickAssign = (lead) => {
    const agentId = quickAssignAgentId || null;
    let officeId = null;
    let teamId = null;
    if (agentId) {
      const agent = data.users.find(u => u.id === agentId);
      if (agent) { officeId = agent.officeId || null; teamId = agent.teamId || null; }
    }
    setLeadAssignment({ leadId: lead.id, officeId, teamId, agentId });
    showNotification(`${lead.firstName} ${lead.lastName} assigned.`);
    setQuickAssignLeadId(null);
    setQuickAssignAgentId('');
  };

  // Enter client's own account (admin direct access - no password required)
  const enterLeadAccount = async (lead) => {
    if (!lead?.id) return showNotification('Invalid client.');
    try {
      await enterClientPortal(lead.id);
    } catch (err) {
      console.error('Failed to enter client account:', err);
      showNotification(err?.message || 'Could not enter client account.');
    }
  };

  // Bulk assign all selected leads to one specific office/team/agent
  const handleBulkAssign = async () => {
    if (selected.length === 0) { showNotification('Select at least one lead first.'); return; }
    if (!bulkOfficeId && !bulkTeamId && !bulkTeamLeaderId && !bulkAgentId) {
      showNotification('Pick a destination (office, team, Team Leader, or agent).');
      return;
    }
    let officeId = bulkOfficeId || null;
    let teamId = bulkTeamId || null;
    let teamLeaderId = bulkTeamLeaderId || null;
    let agentId = bulkAgentId || null;
    const previousLeads = data.leads;
    const previousSelection = [...selected];
    const previousBulkState = { mode: bulkMode, officeId: bulkOfficeId, teamId: bulkTeamId, teamLeaderId: bulkTeamLeaderId, agentId: bulkAgentId };
    if (agentId) {
      const agent = data.users.find(u => u.id === agentId);
      if (agent) { teamId = teamId || agent.teamId; officeId = officeId || agent.officeId; }
    }
    if (teamLeaderId) {
      const leader = data.users.find(u => u.id === teamLeaderId);
      if (leader) {
        teamId = teamId || leader.teamId || null;
        officeId = officeId || leader.officeId || null;
      }
      agentId = null;
    }
    if (teamId) {
      const team = data.teams.find(t => t.id === teamId);
      if (team) { officeId = officeId || team.officeId; }
    }
    // Optimistic update - all leads in one setData call
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l => selected.includes(l.id)
        ? { ...l, assignedToOffice: officeId, assignedToTeam: teamId, assignedToTeamLeader: teamLeaderId, assignedToAgent: agentId }
        : l
      ),
    }));
    setSelected([]);
    setBulkOfficeId(''); setBulkTeamId(''); setBulkTeamLeaderId(''); setBulkAgentId('');
    setBulkMode(null);
    try {
      const result = await bulkAssignLeadsApi(selected, { officeId, teamId, teamLeaderId, agentId });
      if (result.leads?.length) {
        const updatedIds = new Set(result.leads.map((lead) => lead.id));
        setData((prev) => ({
          ...prev,
          leads: [...prev.leads.filter((lead) => !updatedIds.has(lead.id)), ...result.leads],
        }));
      }
      showNotification(`${selected.length} lead(s) reassigned.`);
    } catch (err) {
      setData((prev) => ({ ...prev, leads: previousLeads }));
      setSelected(previousSelection);
      setBulkOfficeId(previousBulkState.officeId);
      setBulkTeamId(previousBulkState.teamId);
      setBulkTeamLeaderId(previousBulkState.teamLeaderId);
      setBulkAgentId(previousBulkState.agentId);
      setBulkMode(previousBulkState.mode || 'assign');
      showNotification(err.message || 'Bulk assign failed; no changes were saved.');
    }
  };

  // Bulk soft-delete selected leads → deletedLeads bin
  const handleBulkDelete = async () => {
    if (selected.length === 0) { showNotification('Select at least one lead first.'); return; }
    const count = selected.length;
    const ok = await confirm({
      title: `Move ${count} lead${count > 1 ? 's' : ''} to bin?`,
      message: `Move ${count} selected lead${count > 1 ? 's' : ''} to the recycle bin? You can restore them later.`,
      confirmLabel: 'Move to bin',
      tone: 'warning',
    });
    if (!ok) return;
    const now = new Date().toISOString();
    const toDelete = data.leads.filter(l => selected.includes(l.id));
    setData(prev => ({
      ...prev,
      leads: prev.leads.filter(l => !selected.includes(l.id)),
      deletedLeads: [...(prev.deletedLeads || []), ...toDelete.map(l => ({ ...l, deletedAt: now }))],
    }));
    showNotification(`${count} lead${count > 1 ? 's' : ''} moved to bin.`);
    setSelected([]);
    setBulkMode(null);
    Promise.allSettled(toDelete.map(l => deleteLeadApi(l.id))).then(results => {
      const failedResults = results.filter(r => r.status === 'rejected');
      if (failedResults.length > 0) {
        showNotification(`${failedResults.length} lead(s) could not be moved to the bin - reverting.`);
        const failedIds = new Set(
          toDelete
            .filter((_, i) => results[i].status === 'rejected')
            .map(l => l.id)
        );
        setData(prev => ({
          ...prev,
          leads: [
            ...prev.leads,
            ...toDelete.filter(l => failedIds.has(l.id)),
          ],
          deletedLeads: (prev.deletedLeads || []).filter(l => !failedIds.has(l.id)),
        }));
      }
    });
  };

  // Bulk permanent-delete directly from the active list (force=1 bypasses soft-delete requirement)
  const handleBulkPermanentDelete = async () => {
    if (selected.length === 0) { showNotification('Select at least one lead first.'); return; }
    const count = selected.length;
    const ok = await confirm({
      title: `Permanently delete ${count} lead${count > 1 ? 's' : ''}?`,
      message: `Permanently delete ${count} selected lead${count > 1 ? 's' : ''}? This cannot be undone - all account data will be erased.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
    });
    if (!ok) return;
    const toDelete = data.leads.filter(l => selected.includes(l.id));
    setData(prev => ({
      ...prev,
      leads: prev.leads.filter(l => !selected.includes(l.id)),
    }));
    showNotification(`${count} lead${count > 1 ? 's' : ''} permanently deleted.`);
    setSelected([]);
    setBulkMode(null);
    Promise.allSettled(toDelete.map(l => deleteLeadApi(l.id, { permanent: true, force: true }))).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) showNotification(`${failed.length} lead(s) could not be permanently deleted.`);
    });
  };

  // Bulk restore from bin
  const handleBinBulkRestore = () => {
    if (binSelected.length === 0) return;
    const ids = new Set(binSelected);
    const toRestore = (data.deletedLeads || []).filter(l => ids.has(l.id));
    const count = toRestore.length;
    setData(prev => {
      const restored = (prev.deletedLeads || [])
        .filter(l => ids.has(l.id))
        .map(({ deletedAt: _d, ...r }) => r);
      return {
        ...prev,
        deletedLeads: (prev.deletedLeads || []).filter(l => !ids.has(l.id)),
        leads: [...prev.leads, ...restored],
      };
    });
    showNotification(`${count} lead${count > 1 ? 's' : ''} restored.`);
    setBinSelected([]);
    Promise.allSettled(toRestore.map(l => restoreLeadApi(l.id))).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) showNotification(`${failed.length} lead(s) could not be restored on the server.`);
    });
  };

  // Bulk permanent-delete from bin
  const handleBinBulkPermanentDelete = async () => {
    if (binSelected.length === 0) return;
    const count = binSelected.length;
    const ok = await confirm({
      title: `Permanently delete ${count} lead${count > 1 ? 's' : ''}?`,
      message: `Permanently delete ${count} selected lead${count > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
    });
    if (!ok) return;
    const ids = new Set(binSelected);
    const toDelete = (data.deletedLeads || []).filter(l => ids.has(l.id));
    setData(prev => ({
      ...prev,
      deletedLeads: (prev.deletedLeads || []).filter(l => !ids.has(l.id)),
    }));
    showNotification(`${count} lead${count > 1 ? 's' : ''} permanently deleted.`);
    setBinSelected([]);
    Promise.allSettled(toDelete.map(l => deleteLeadApi(l.id, { permanent: true, force: true }))).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) showNotification(`${failed.length} lead(s) could not be permanently deleted.`);
    });
  };

  // Bulk suspend leads
  const handleBulkSuspend = async () => {
    if (selected.length === 0) return;
    const count = selected.length;
    const ok = await confirm({
      title: `Suspend ${count} lead${count > 1 ? 's' : ''}?`,
      message: `This will lock their accounts. They can be re-activated at any time.`,
      confirmLabel: 'Suspend',
      tone: 'danger',
    });
    if (!ok) return;
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l => selected.includes(l.id) ? { ...l, status: 'Suspended' } : l),
    }));
    showNotification(`${count} lead${count > 1 ? 's' : ''} suspended.`);
    setSelected([]);
    bulkUpdateLeadStatusApi(selected, 'Suspended').catch(() => {
      showNotification('Server error - some leads may not have been suspended.');
    });
  };

  // Bulk re-activate leads
  const handleBulkActivate = async () => {
    if (selected.length === 0) return;
    const count = selected.length;
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l => selected.includes(l.id) ? { ...l, status: 'Active' } : l),
    }));
    showNotification(`${count} lead${count > 1 ? 's' : ''} re-activated.`);
    setSelected([]);
    bulkUpdateLeadStatusApi(selected, 'Active').catch(() => {
      showNotification('Server error - some leads may not have been re-activated.');
    });
  };

  // CSV import state
  const [csvImportOpen,    setCsvImportOpen]    = useState(false);
  const [csvRawText,       setCsvRawText]       = useState('');
  const [csvFile,          setCsvFile]          = useState(null);
  const [csvParsed,        setCsvParsed]        = useState([]);
  const [csvParseError,    setCsvParseError]    = useState('');
  const [csvImporting,     setCsvImporting]     = useState(false);

  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const handleExportAllLeadsCsv = () => {
    const headers = [
      'Lead ID', 'Name', 'First Name', 'Last Name', 'Email', 'Phone',
      'Country', 'Status', 'Stage', 'Funnel',
      'Office', 'Team', 'Agent', 'Team Leader', 'assigned_team_leader_id',
      'Registered Date', 'Created At', 'Updated At',
    ];
    const rows = (data.leads || []).map(lead => {
      const office = (data.offices || []).find(item => item.id === lead.assignedToOffice);
      const team = (data.teams || []).find(item => item.id === lead.assignedToTeam);
      const agent = (data.users || []).find(item => item.id === lead.assignedToAgent);
      const teamLeader = (data.users || []).find(item => item.id === lead.assignedToTeamLeader);
      const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
      return [
        lead.id, name, lead.firstName, lead.lastName, lead.email, lead.phone,
        lead.country, lead.status, lead.stage, lead.funnel,
        office?.name, team?.name, agent?.name, teamLeader?.name, lead.assignedToTeamLeader,
        lead.registeredDate, lead.createdAt, lead.updatedAt,
      ].map(csvCell).join(',');
    });
    const csv = `\uFEFF${[headers.map(csvCell).join(','), ...rows].join('\r\n')}\r\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotification(`Downloaded ${data.leads.length} lead${data.leads.length === 1 ? '' : 's'} as CSV.`);
  };

  const parseCsvLeads = (text) => {
    const table = parseCsvRows(text);
    if (table.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };
    const header = table[0].map(normalizeCsvHeader);
    const required = ['first_name', 'last_name', 'email'];
    const missing = required.filter(r => !header.includes(r));
    if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(', ')}` };
    const rows = [];
    const errors = [];
    table.slice(1).forEach((cols, i) => {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = String(cols[idx] ?? '').trim(); });
      if (!obj.email || !obj.email.includes('@')) {
        errors.push(`Row ${i + 2}: invalid email`);
      } else {
        rows.push(obj);
      }
    });
    if (errors.length > 0) return { rows, error: errors.slice(0, 5).join('\n') };
    return { rows, error: '' };
  };

  const handleCsvFilePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = ev => setCsvRawText(ev.target.result || '');
    reader.readAsText(file);
  };

  const handleCsvParse = () => {
    setCsvParseError('');
    setCsvParsed([]);
    const { rows, error } = parseCsvLeads(csvRawText);
    if (error && rows.length === 0) { setCsvParseError(error); return; }
    if (error) setCsvParseError(error);
    setCsvParsed(rows);
  };

  const handleCsvImport = async () => {
    if (csvParsed.length === 0) return;
    setCsvImporting(true);
    try {
      const result = await importLeadsApi(csvParsed);
      const imported = result?.imported ?? csvParsed.length;
      const newLeads = result?.leads || [];
      if (newLeads.length > 0) {
        setData(prev => ({ ...prev, leads: [...newLeads, ...prev.leads] }));
      }
      setCsvImportOpen(false);
      setCsvRawText(''); setCsvFile(null); setCsvParsed([]); setCsvParseError('');
      showNotification(`${imported} lead${imported !== 1 ? 's' : ''} imported successfully.`);
    } catch (err) {
      setCsvParseError(err?.message || 'Import failed.');
    } finally {
      setCsvImporting(false);
    }
  };

  // Bin auto-cleanup state
  const [binCleanupDays, setBinCleanupDays] = useState(30);
  const [binCleanupBusy, setBinCleanupBusy] = useState(false);

  const handleBinCleanup = async () => {
    const ok = await confirm({
      title: `Auto-clean bin?`,
      message: `Permanently delete all bin entries older than ${binCleanupDays} day${binCleanupDays !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Clean up',
      tone: 'danger',
    });
    if (!ok) return;
    setBinCleanupBusy(true);
    try {
      const { deleted } = await cleanupBinApi(binCleanupDays);
      const cutoff = Date.now() - (binCleanupDays * 86400 * 1000);
      setData(prev => ({
        ...prev,
        deletedLeads: (prev.deletedLeads || []).filter(l =>
          !l.deletedAt || new Date(l.deletedAt).getTime() > cutoff
        ),
      }));
      showNotification(`${deleted} lead${deleted !== 1 ? 's' : ''} permanently removed from bin.`);
    } catch (err) {
      showNotification(`Cleanup failed: ${err?.message || 'server error'}`);
    } finally {
      setBinCleanupBusy(false);
    }
  };

  // Shuffle (round-robin) selected leads among chosen targets
  const handleShuffle = async () => {
    if (shuffleTargets.length === 0) { showNotification('Pick at least one target to shuffle into.'); return; }
    let pool = selected.length > 0 ? data.leads.filter(l => selected.includes(l.id)) : data.leads.filter(l => !l.assignedToAgent);
    if (shuffleStatus) pool = pool.filter(l => normalizeStage(l.stage) === shuffleStatus);
    if (pool.length === 0) { showNotification('No leads match the shuffle pool.'); return; }

    // Build per-target groups (round-robin) - one bulk call per group instead of one call per lead
    const groups = new Map(); // targetId → { leadIds, officeId, teamId, teamLeaderId, agentId }
    pool.forEach((lead, idx) => {
      const targetId = shuffleTargets[idx % shuffleTargets.length];
      if (!groups.has(targetId)) {
        let officeId = null, teamId = null, teamLeaderId = null, agentId = null;
        if (shuffleScope === 'offices') {
          officeId = targetId;
        } else if (shuffleScope === 'teams') {
          const team = data.teams.find(t => t.id === targetId);
          teamId = targetId;
          officeId = team ? team.officeId : null;
        } else if (shuffleScope === 'agents') {
          const agent = data.users.find(u => u.id === targetId);
          agentId = targetId;
          teamId = agent ? agent.teamId : null;
          officeId = agent ? agent.officeId : null;
        } else if (shuffleScope === 'team-leaders') {
          const leader = data.users.find(u => u.id === targetId);
          teamLeaderId = targetId;
          teamId = leader ? leader.teamId : null;
          officeId = leader ? leader.officeId : null;
        }
        groups.set(targetId, { leadIds: [], officeId, teamId, teamLeaderId, agentId });
      }
      groups.get(targetId).leadIds.push(lead.id);
    });

    // Capture current lead state for rollback if the API calls fail
    const prevLeads = data.leads.slice();

    // Optimistic update - single setData call covering all affected leads
    setData(prev => {
      const assignMap = new Map();
      groups.forEach(({ leadIds, officeId, teamId, teamLeaderId, agentId }) => {
        leadIds.forEach(id => assignMap.set(id, { officeId, teamId, teamLeaderId, agentId }));
      });
      return {
        ...prev,
        leads: prev.leads.map(l => {
          const a = assignMap.get(l.id);
          return a ? { ...l, assignedToOffice: a.officeId, assignedToTeam: a.teamId, assignedToTeamLeader: a.teamLeaderId, assignedToAgent: a.agentId } : l;
        }),
      };
    });

    setSelected([]);
    setShuffleTargets([]);
    setShuffleStatus('');
    setBulkMode(null);

    // Send every shuffled destination in one transaction so a partial network
    // failure cannot leave only some groups assigned.
    try {
      const assignments = [...groups.values()].flatMap(({ leadIds, officeId, teamId, teamLeaderId, agentId }) =>
        leadIds.map((leadId) => ({ leadId, officeId, teamId, teamLeaderId, agentId }))
      );
      const result = await bulkAssignLeadAssignmentsApi(assignments);
      if (result.leads?.length) {
        const savedById = new Map(result.leads.map((lead) => [lead.id, lead]));
        setData((prev) => ({
          ...prev,
          leads: prev.leads.map((lead) => savedById.get(lead.id) || lead),
        }));
      }
      showNotification(`Shuffled ${pool.length} lead(s) across ${shuffleTargets.length} ${shuffleScope}.`);
    } catch (err) {
      // Roll back the optimistic update so the UI reflects actual server state
      setData(prev => ({ ...prev, leads: prevLeads }));
      showNotification('Shuffle failed - changes reverted. Please try again.');
    }
  };

  const toggleShuffleTarget = (id) => {
    setShuffleTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const openProfile = (lead) => {
    if (onOpenProfile) {
      onOpenProfile(lead);
      return;
    }
    setProfileLead(lead);
    setProfileStage(lead.stage || '');
    setProfileComment(lead.comment || '');
    setReassignOfficeId(lead.assignedToOffice || '');
    setReassignTeamId(lead.assignedToTeam || '');
    setReassignAgentId(lead.assignedToAgent || '');
    // Fetch profile change history for this lead
    setProfileHistory([]);
    setProfileHistoryError('');
    setProfileHistoryLoading(true);
    getUserProfileHistoryApi(lead.id)
      .then(({ entries }) => { setProfileHistory(entries); })
      .catch((err) => { setProfileHistoryError(err?.message || 'Failed to load change history.'); })
      .finally(() => { setProfileHistoryLoading(false); });
  };

  const closeProfile = () => {
    setProfileLead(null);
    setProfileHistory([]);
    setProfileHistoryError('');
  };

  const saveProfile = async () => {
    if (!profileLead) return;
    // Assignment changes go through setLeadAssignment which calls the assign API.
    setLeadAssignment({ leadId: profileLead.id, officeId: reassignOfficeId || null, teamId: reassignTeamId || null, agentId: reassignAgentId || null });

    // Stage and comment must be sent to the backend separately via updateLeadApi.
    const apiUpdates = {};
    if (profileStage !== profileLead.stage) apiUpdates.stage = profileStage;
    if (profileComment.trim()) apiUpdates.comment = profileComment.trim();

    if (Object.keys(apiUpdates).length > 0) {
      // Optimistic local update so the list reflects changes immediately.
      const now = new Date().toISOString();
      const optimisticHistory = [...(profileLead.commentHistory || [])];
      if (apiUpdates.comment) {
        optimisticHistory.push({ text: apiUpdates.comment, by: 'You', date: now.slice(0, 10), createdAt: now });
      }
      setData(prev => ({
        ...prev,
        leads: prev.leads.map(l => l.id === profileLead.id
          ? { ...l, stage: profileStage, commentHistory: optimisticHistory }
          : l
        ),
      }));
      updateLeadApi(profileLead.id, apiUpdates).then((serverLead) => {
        if (!serverLead || !serverLead.id) return;
        setData(prev => ({
          ...prev,
          leads: prev.leads.map(l => l.id === serverLead.id ? { ...l, ...serverLead } : l),
        }));
      }).catch((err) => {
        console.error('[saveProfile] updateLeadApi failed', err);
        showNotification('Could not save stage/comment to the server.');
      });
    }

    showNotification(`${profileLead.firstName} ${profileLead.lastName} updated.`);
    closeProfile();
  };

  const unassignLead = () => {
    if (!profileLead) return;
    setLeadAssignment({ leadId: profileLead.id, officeId: null, teamId: null, agentId: null });
    showNotification(`${profileLead.firstName} ${profileLead.lastName} returned to pool.`);
    closeProfile();
  };

  const resetLeadStatus = async () => {
    if (!profileLead) return;
    const ok = await confirm({
      title: 'Reset Status Workflow?',
      message: `This will reset "${profileLead.firstName} ${profileLead.lastName}" back to New and permanently erase the entire status history. This cannot be undone.`,
      confirmLabel: 'Reset & Erase',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await resetLeadStatusApi(profileLead.id);
      setProfileLead(updated);
      setProfileStage('New');
      setData(prev => ({ ...prev, leads: prev.leads.map(l => l.id === updated.id ? updated : l) }));
      showNotification(`Status reset to New for ${updated.firstName} ${updated.lastName}.`);
    } catch (err) {
      console.error('[SuperAdminPanel] resetLeadStatus failed', err);
      showNotification('Could not reset status - please try again.');
    }
  };

  const clearLeadComments = async () => {
    if (!profileLead) return;
    const ok = await confirm({
      title: 'Delete All Comments?',
      message: `This will permanently delete every comment on "${profileLead.firstName} ${profileLead.lastName}"'s profile. This cannot be undone.`,
      confirmLabel: 'Delete All Comments',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await clearLeadCommentsApi(profileLead.id);
      setProfileLead(updated);
      setData(prev => ({ ...prev, leads: prev.leads.map(l => l.id === updated.id ? updated : l) }));
      showNotification(`All comments deleted for ${updated.firstName} ${updated.lastName}.`);
    } catch (err) {
      console.error('[SuperAdminPanel] clearLeadComments failed', err);
      showNotification('Could not delete comments - please try again.');
    }
  };

  // Soft-delete: move from leads → deletedLeads optimistically, then call
  // the backend. On failure we roll back so the bin doesn't show ghosts.
  const deleteLead = async (lead) => {
    const ok = await confirm({
      title: 'Move lead to bin?',
      message: `Move "${lead.firstName} ${lead.lastName}" to the recycle bin? You can restore it later from the bin.`,
      confirmLabel: 'Move to bin',
      tone: 'warning',
    });
    if (!ok) return;
    const now = new Date().toISOString();
    setData(prev => ({
      ...prev,
      leads: prev.leads.filter(l => l.id !== lead.id),
      deletedLeads: [...(prev.deletedLeads || []), { ...lead, deletedAt: now }],
    }));
    showNotification(`${lead.firstName} ${lead.lastName} moved to bin.`);
    if (profileLead?.id === lead.id) closeProfile();
    deleteLeadApi(lead.id).catch((error) => {
      console.error('[SuperAdminPanel] deleteLead failed', error);
      showNotification('Could not delete lead on the server.');
      setData(prev => ({
        ...prev,
        leads: [...prev.leads, lead],
        deletedLeads: (prev.deletedLeads || []).filter(l => l.id !== lead.id),
      }));
    });
  };

  const restoreLead = (lead) => {
    const { deletedAt: _drop, ...restoredLead } = lead;
    setData(prev => ({
      ...prev,
      deletedLeads: (prev.deletedLeads || []).filter(l => l.id !== lead.id),
      leads: [...prev.leads, restoredLead],
    }));
    showNotification(`${lead.firstName} ${lead.lastName} restored.`);
    restoreLeadApi(lead.id).catch((error) => {
      console.error('[SuperAdminPanel] restoreLead failed', error);
      showNotification('Could not restore lead on the server.');
      // Roll back: put it back in the bin and remove from live.
      setData(prev => ({
        ...prev,
        leads: prev.leads.filter(l => l.id !== lead.id),
        deletedLeads: [...(prev.deletedLeads || []), lead],
      }));
    });
  };

  const permanentDelete = async (lead) => {
    const ok = await confirm({
      title: 'Permanently delete lead?',
      message: `Permanently delete "${lead.firstName} ${lead.lastName}"? This cannot be undone.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
    });
    if (!ok) return;
    setData(prev => ({ ...prev, deletedLeads: (prev.deletedLeads || []).filter(l => l.id !== lead.id) }));
    showNotification(`${lead.firstName} ${lead.lastName} permanently deleted.`);
    deleteLeadApi(lead.id, { permanent: true, force: true }).catch((error) => {
      console.error('[SuperAdminPanel] permanentDelete failed', error);
      showNotification('Could not permanently delete lead on the server.');
      setData(prev => ({ ...prev, deletedLeads: [...(prev.deletedLeads || []), lead] }));
    });
  };

  const idLookupResults = useMemo(() => {
    const q = idLookupQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const allLeads = [...data.leads, ...(data.deletedLeads || [])];
    return allLeads.filter(l => l.id && String(l.id).toLowerCase().includes(q)).slice(0, 10);
  }, [idLookupQuery, data.leads, data.deletedLeads]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.leads.filter(lead => {
      if (showUnassignedOnly && !matchesLeadOwnershipFilter(lead, 'unassigned')) return false;
      if (filterOffice && lead.assignedToOffice !== filterOffice) return false;
      if (filterTeam && lead.assignedToTeam !== filterTeam) return false;
      if (filterAgent && lead.assignedToAgent !== filterAgent) return false;
      if (filterTeamLeader && lead.assignedToTeamLeader !== filterTeamLeader) return false;
      if (filterOwnership && !matchesLeadOwnershipFilter(lead, filterOwnership)) return false;
      if (filterStatus && normalizeStage(lead.stage) !== filterStatus) return false;
      if (q && !(
        (lead.firstName || '').toLowerCase().includes(q) ||
        (lead.lastName || '').toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        (lead.country || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [data.leads, search, filterOffice, filterTeam, filterAgent, filterTeamLeader, filterOwnership, filterStatus, showUnassignedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const deletedLeads = data.deletedLeads || [];
  const binTotalPages = Math.max(1, Math.ceil(deletedLeads.length / pageSize));
  const pagedBin = deletedLeads.slice((binPage - 1) * pageSize, binPage * pageSize);
  const allBinPageSelected = pagedBin.length > 0 && pagedBin.every(l => binSelected.includes(l.id));

  const teamsForFilter = filterOffice ? data.teams.filter(t => t.officeId === filterOffice) : data.teams;
  const agentsForFilter = filterTeam ? data.users.filter(u => u.role === ROLE.AGENT && u.teamId === filterTeam) : data.users.filter(u => u.role === ROLE.AGENT);

  const unassignedCount = data.leads.filter(l => !l.assignedToOffice).length;
  const poolCount = data.leads.filter(l => l.assignedToOffice && !l.assignedToTeam).length;
  const pendingAgentCount = data.leads.filter(l => l.assignedToTeam && !l.assignedToAgent).length;
  const assignedCount = data.leads.filter(l => l.assignedToAgent).length;

  const profileOffice = profileLead ? data.offices.find(o => o.id === profileLead.assignedToOffice) : null;
  const profileTeam = profileLead ? data.teams.find(t => t.id === profileLead.assignedToTeam) : null;
  const profileAgent = profileLead ? data.users.find(u => u.id === profileLead.assignedToAgent) : null;

  return (
    <>
    {confirmDialog}

    {/* CSV Import Modal */}
    {csvImportOpen && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={() => !csvImporting && setCsvImportOpen(false)}>
        <div style={{ background: '#1E2329', border: '1px solid #2B3139', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--crm-text-primary)' }}>[upload] Import Leads from CSV</h3>
            <button onClick={() => setCsvImportOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--crm-text-secondary)', fontSize: 18, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
          </div>
          <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: 'var(--crm-text-secondary)' }}>
            Required columns: <code style={{ color: 'var(--crm-accent)' }}>first_name</code>, <code style={{ color: 'var(--crm-accent)' }}>last_name</code>, <code style={{ color: 'var(--crm-accent)' }}>email</code>. Optional: <code>phone</code>, <code>country</code>, <code>password</code>, <code>assigned_team_leader_id</code>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--crm-border)', background: 'var(--crm-bg)', cursor: 'pointer', fontSize: 12, color: 'var(--crm-text-primary)' }}>
              [file] Upload .csv file
              <input type="file" accept=".csv,text/plain" onChange={handleCsvFilePick} style={{ display: 'none' }} />
            </label>
            {csvFile && <span style={{ fontSize: 11, color: '#0ECB81', alignSelf: 'center' }}>OK {csvFile.name}</span>}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Or paste CSV text</label>
            <textarea
              rows={6}
              value={csvRawText}
              onChange={e => setCsvRawText(e.target.value)}
              placeholder="first_name,last_name,email,phone,country&#10;John,Smith,john@example.com,+1234567890,US"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--crm-border)', background: '#0B0E11', color: 'var(--crm-text-primary)', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }}
            />
          </div>
          <button
            type="button"
            onClick={handleCsvParse}
            disabled={!csvRawText.trim()}
            style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--crm-accent)', background: 'color-mix(in srgb, var(--crm-accent) 10%, transparent)', color: 'var(--crm-accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 12 }}
          >[search] Parse &amp; Preview</button>
          {csvParseError && (
            <div style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid #F6465D50', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#F6465D', whiteSpace: 'pre-line' }}>
              {csvParseError}
            </div>
          )}
          {csvParsed.length > 0 && (
            <>
              <div style={{ background: 'rgba(14,203,129,0.08)', border: '1px solid #0ECB8140', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#0ECB81' }}>
                OK {csvParsed.length} lead{csvParsed.length !== 1 ? 's' : ''} ready to import
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 12, border: '1px solid #2B3139', borderRadius: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#0B0E11' }}>
                      {['First', 'Last', 'Email', 'Phone', 'Country'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--crm-text-secondary)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvParsed.slice(0, 20).map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #2B3139' }}>
                        <td style={{ padding: '5px 10px', color: 'var(--crm-text-primary)' }}>{row.first_name}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--crm-text-primary)' }}>{row.last_name}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--crm-text-secondary)' }}>{row.email}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--crm-text-secondary)' }}>{row.phone || '-'}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--crm-text-secondary)' }}>{row.country || '-'}</td>
                      </tr>
                    ))}
                    {csvParsed.length > 20 && (
                      <tr><td colSpan={5} style={{ padding: '5px 10px', color: 'var(--crm-text-secondary)', textAlign: 'center' }}>...and {csvParsed.length - 20} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleCsvImport}
                disabled={csvImporting}
                style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none', background: csvImporting ? 'var(--crm-border)' : 'var(--crm-accent)', color: csvImporting ? 'var(--crm-text-secondary)' : '#1A1D23', fontWeight: 700, fontSize: 14, cursor: csvImporting ? 'not-allowed' : 'pointer' }}
              >
                {csvImporting ? 'Importing...' : `⬆ Import ${csvParsed.length} Lead${csvParsed.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    )}

    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className="crm-super-admin-btn"
          onClick={handleExportAllLeadsCsv}
          disabled={data.leads.length === 0}
          title="Download every active lead, not just the current page"
        >
          Export All Leads CSV
        </button>
      </div>

      {/* View toggle: Active | Bin */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`crm-super-admin-btn crm-super-admin-btn-small${view === 'active' ? '' : ' crm-super-admin-btn-secondary'}`}
          onClick={() => setView('active')}
          style={view === 'active' ? { background: 'var(--crm-accent, #0A84FF)', color: '#fff', borderColor: 'transparent' } : {}}
        >
          Active Leads ({data.leads.length})
        </button>
        <button
          className={`crm-super-admin-btn crm-super-admin-btn-small${view === 'bin' ? '' : ' crm-super-admin-btn-secondary'}`}
          onClick={() => setView('bin')}
          style={view === 'bin' ? { background: '#F6465D', color: '#fff', borderColor: 'transparent' } : {}}
        >
          Recycle Bin ({deletedLeads.length})
        </button>
      </div>

      {/* ── Client ID Lookup Bar ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--crm-card, #23242A)', border: '1px solid ' + (idLookupQuery.trim().length >= 3 ? 'var(--crm-accent, #0A84FF)' : 'var(--crm-border, rgba(255, 255, 255, 0.08))'), borderRadius: 9999, padding: '8px 16px', transition: 'border-color 0.2s' }}>
          <i className="fas fa-fingerprint" style={{ color: idLookupQuery.trim().length >= 3 ? 'var(--crm-accent, #0A84FF)' : 'var(--crm-text-secondary, #8E8E93)', fontSize: 15, flexShrink: 0, transition: 'color 0.2s' }} />
          <input
            className="crm-super-admin-input"
            style={{ flex: 1, background: 'transparent', border: 'none', padding: 0, fontFamily: 'monospace', fontSize: 13, outline: 'none', color: 'var(--crm-text-primary, #FFFFFF)' }}
            placeholder="Find client by ID - paste or type any part of the ID..."
            value={idLookupQuery}
            onChange={e => setIdLookupQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {idLookupQuery && (
            <button
              onClick={() => setIdLookupQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary, #8E8E93)', fontSize: 14, padding: '2px 4px', lineHeight: 1, borderRadius: 3, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-text-primary, #FFFFFF)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary, #8E8E93)'}
              title="Clear"
            >✕</button>
          )}
          <span style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {idLookupQuery.trim().length >= 2
              ? idLookupResults.length > 0 ? `${idLookupResults.length} match${idLookupResults.length !== 1 ? 'es' : ''}` : 'No matches'
              : 'type 2+ chars'}
          </span>
        </div>

        {idLookupQuery.trim().length >= 2 && idLookupResults.length > 0 && (
          <div style={{ marginTop: 6, background: 'var(--crm-card, #23242A)', border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.1))', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {idLookupResults.map((lead, idx) => {
              const isDeleted = !!(lead.deletedAt);
              const office = data.offices.find(o => o.id === lead.assignedToOffice);
              const team = data.teams.find(t => t.id === lead.assignedToTeam);
              const agent = data.users.find(u => u.id === lead.assignedToAgent);
              const q = idLookupQuery.trim();
              const idStr = lead.id || '';
              const matchStart = idStr.toLowerCase().indexOf(q.toLowerCase());
              const highlightedId = matchStart >= 0
                ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {idStr.slice(0, matchStart)}
                    <mark style={{ background: 'var(--crm-accent, #0A84FF)', color: '#FFFFFF', borderRadius: 2, padding: '0 2px' }}>{idStr.slice(matchStart, matchStart + q.length)}</mark>
                    {idStr.slice(matchStart + q.length)}
                  </span>
                : <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{idStr}</span>;
              return (
                <div
                  key={lead.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: idx > 0 ? '1px solid var(--crm-border, rgba(255, 255, 255, 0.06))' : 'none', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--crm-text-primary)', fontSize: 13 }}>{lead.firstName} {lead.lastName}</span>
                      {isDeleted && <span style={{ fontSize: 10, background: '#c0392b20', color: '#ff6464', border: '1px solid #ff646440', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>DELETED</span>}
                      <span style={{ fontSize: 11, background: 'color-mix(in srgb, var(--crm-accent) 9%, transparent)', color: 'var(--crm-accent)', border: '1px solid color-mix(in srgb, var(--crm-accent) 19%, transparent)', borderRadius: 3, padding: '1px 6px' }}>{normalizeStage(lead.stage) || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--crm-text-secondary)', fontSize: 11 }}>{highlightedId}</span>
                      {lead.email && <span style={{ color: 'var(--crm-text-secondary)', fontSize: 11 }}>{lead.email}</span>}
                      {office && <span style={{ color: 'var(--crm-text-secondary)', fontSize: 11 }}>Office: {office.name}</span>}
                      {team && <span style={{ color: 'var(--crm-text-secondary)', fontSize: 11 }}>Team: {team.name}</span>}
                      {agent && <span style={{ color: '#30D158', fontSize: 11 }}>Agent: {agent.name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="crm-super-admin-btn crm-super-admin-btn-small"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => { openProfile(lead); setIdLookupQuery(''); }}
                    >Quick View</button>
                    {!isDeleted && (
                      <button
                        className="crm-super-admin-btn crm-super-admin-btn-small"
                        style={{ fontSize: 11, padding: '4px 10px', background: '#3a7bd5', color: '#fff' }}
                        onClick={() => navigate(getLeadProfilePath(ROLE.SUPER_ADMIN, currentUser.id, lead.id))}
                      >Open Profile</button>
                    )}
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '4px 6px', lineHeight: 1, borderRadius: 3, fontSize: 12 }}
                      title="Copy full ID"
                      onClick={() => { navigator.clipboard.writeText(lead.id); showNotification('Client ID copied!'); }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}
                    ><i className="fas fa-copy"></i></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {view === 'bin' ? (
        /* ── BIN VIEW ── */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--crm-text-secondary)' }}>Deleted leads can be restored or permanently removed.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>Auto-clean entries older than</span>
              <select
                value={binCleanupDays}
                onChange={e => setBinCleanupDays(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--crm-border)', background: 'var(--crm-bg)', color: 'var(--crm-text-primary)', fontSize: 12 }}
              >
                {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
              <button
                className="crm-super-admin-btn crm-super-admin-btn-small"
                style={{ background: 'rgba(246,70,93,0.15)', color: '#F6465D', border: '1px solid #F6465D40' }}
                onClick={handleBinCleanup}
                disabled={binCleanupBusy}
              >
                {binCleanupBusy ? 'Cleaning...' : '🧹 Clean Up Bin'}
              </button>
            </div>
          </div>
          {binSelected.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '8px 12px', background: 'var(--crm-card)', borderRadius: 6, border: '1px solid var(--crm-accent)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--crm-accent)', fontSize: 12, fontWeight: 600 }}>{binSelected.length} selected</span>
              <button className="crm-super-admin-btn crm-super-admin-btn-small" onClick={handleBinBulkRestore}>Restore Selected</button>
              <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ background: '#c0392b', color: '#fff' }} onClick={handleBinBulkPermanentDelete}>✕ Delete Selected Forever</button>
              <button onClick={() => setBinSelected([])} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--crm-border)', color: 'var(--crm-text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}>Clear</button>
            </div>
          )}
          {pagedBin.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--crm-text-secondary)' }}>The bin is empty.</div>
          ) : (
            <div className="crm-admin-table-container">
              <table className="crm-admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>
                      <input type="checkbox"
                        checked={allBinPageSelected}
                        onChange={e => {
                          if (e.target.checked) setBinSelected(prev => [...new Set([...prev, ...pagedBin.map(l => l.id)])]);
                          else setBinSelected(prev => prev.filter(id => !pagedBin.find(l => l.id === id)));
                        }}
                      />
                    </th>
                    <th>Client ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Country</th>
                    <th>Last Assignment</th>
                    <th>Deleted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBin.map(lead => (
                    <tr key={lead.id} style={{ background: binSelected.includes(lead.id) ? 'var(--crm-card)' : undefined }}>
                      <td>
                        <input type="checkbox"
                          checked={binSelected.includes(lead.id)}
                          onChange={e => setBinSelected(e.target.checked ? [...binSelected, lead.id] : binSelected.filter(id => id !== lead.id))}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--crm-text-primary)' }}>
                            {lead.id ? lead.id.slice(0, 6) : '-'}
                          </span>
                          {lead.id && (
                            <button
                              title={lead.id}
                              onClick={() => navigator.clipboard.writeText(lead.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}
                            >
                              <i className="fas fa-copy" style={{ fontSize: 11 }}></i>
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</td>
                      <td style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>{lead.email}</td>
                      <td>{getCountryFlag(lead.countryCode, lead.country)} {lead.country}</td>
                      <td style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>
                        {lead.assignedToAgent ? getUserName(lead.assignedToAgent, data.users) :
                          lead.assignedToTeam ? getTeamName(lead.assignedToTeam, data.teams) :
                          lead.assignedToOffice ? getOfficeName(lead.assignedToOffice, data.offices) : 'Pool'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.deletedAt ? new Date(lead.deletedAt).toLocaleDateString() : '-'}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="crm-super-admin-btn crm-super-admin-btn-small" onClick={() => restoreLead(lead)}>Restore</button>
                        <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ background: '#c0392b', color: '#fff' }} onClick={() => permanentDelete(lead)}>✕ Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {binTotalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={binPage === 1} onClick={() => setBinPage(1)}>«</button>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={binPage === 1} onClick={() => setBinPage(p => p - 1)}>‹ Prev</button>
              <span style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>Page {binPage} of {binTotalPages}</span>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={binPage >= binTotalPages} onClick={() => setBinPage(p => p + 1)}>Next ›</button>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={binPage >= binTotalPages} onClick={() => setBinPage(binTotalPages)}>»</button>
            </div>
          )}
        </div>
      ) : (
        /* ── ACTIVE LEADS VIEW ── */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            {[
              { label: 'Unassigned Pool', value: unassignedCount, color: '#FF9F0A' },
              { label: 'Pending Team', value: poolCount, color: '#86868B' },
              { label: 'Pending Agent', value: pendingAgentCount, color: '#0A84FF' },
              { label: 'With Agents', value: assignedCount, color: '#30D158' },
              { label: 'Total Leads', value: data.leads.length, color: 'var(--crm-text-primary, #F5F5F7)' },
            ].map(s => (
              <div
                key={s.label}
                title={s.title}
                onClick={s.onClick}
                style={{
                  background: 'var(--crm-card, #181A20)',
                  border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: 'var(--crm-radius, 14px)',
                  padding: '14px 16px',
                  cursor: s.onClick ? 'pointer' : 'default',
                  transition: 'all 0.16s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--crm-text-secondary, #86868B)', marginBottom: 6, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}80` }} />
                  <span>{s.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <SearchAutocomplete
              className="crm-super-admin-input"
              placeholder="Search name, email, phone, country..."
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              fetchSuggestions={searchAdminLeads}
              style={{ flex: 2, minWidth: 180 }}
              buildSuggestions={(q) => {
                const ql = q.toLowerCase();
                return data.leads
                  .filter(l => {
                    const full = `${l.firstName || ''} ${l.lastName || ''}`.toLowerCase();
                    return (
                      full.includes(ql) ||
                      (l.email || '').toLowerCase().includes(ql) ||
                      (l.phone || '').toLowerCase().includes(ql) ||
                      (l.country || '').toLowerCase().includes(ql)
                    );
                  })
                  .slice(0, 8)
                  .map(l => ({
                    key: l.id,
                    value: `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.email || l.phone || '',
                    label: `${l.firstName || ''} ${l.lastName || ''}`.trim() || '(no name)',
                    meta: [l.email, l.country].filter(Boolean).join('  /  '),
                  }));
              }}
            />
            <select className="crm-super-admin-select" value={filterOffice} onChange={e => { setFilterOffice(e.target.value); setFilterTeam(''); setFilterAgent(''); setPage(1); }} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All Offices</option>
              {data.offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select className="crm-super-admin-select" value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setFilterAgent(''); setPage(1); }} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All Teams</option>
              {teamsForFilter.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="crm-super-admin-select" value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All Agents</option>
              {agentsForFilter.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select className="crm-super-admin-select" value={filterTeamLeader} onChange={e => { setFilterTeamLeader(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 150 }}>
              <option value="">All Team Leaders</option>
              {data.users.filter(u => u.role === ROLE.TEAM_LEADER).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select className="crm-super-admin-select" value={filterOwnership} onChange={e => { setFilterOwnership(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 150 }}>
              <option value="">All Ownership Types</option>
              <option value="team-leader-owned">Direct Team Leader</option>
              <option value="office-only">Office only</option>
              <option value="team-no-agent">Team, no agent</option>
              <option value="agent-assigned">Agent assigned</option>
              <option value="unassigned">Completely unassigned</option>
            </select>
            <select className="crm-super-admin-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All Statuses</option>
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(search || filterOffice || filterTeam || filterAgent || filterTeamLeader || filterOwnership || filterStatus) && (
              <button className="crm-super-admin-btn crm-super-admin-btn-small" onClick={() => { setSearch(''); setFilterOffice(''); setFilterTeam(''); setFilterAgent(''); setFilterTeamLeader(''); setFilterOwnership(''); setFilterStatus(''); setPage(1); }}>Clear</button>
            )}
          </div>

          {/* Quick action toolbar: Unassigned filter + bulk / shuffle entry */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <button
              className={`crm-super-admin-btn crm-super-admin-btn-small${showUnassignedOnly ? '' : ' crm-super-admin-btn-secondary'}`}
              onClick={() => { setShowUnassignedOnly(v => !v); setPage(1); }}
              style={showUnassignedOnly ? { background: 'var(--crm-accent, #0A84FF)', color: '#fff', borderColor: 'transparent' } : {}}
            >
              {showUnassignedOnly ? '✓ Showing Completely Unassigned' : 'Show Completely Unassigned'}
            </button>
            <button
              className={`crm-super-admin-btn crm-super-admin-btn-small${bulkMode === 'assign' ? '' : ' crm-super-admin-btn-secondary'}`}
              onClick={() => setBulkMode(bulkMode === 'assign' ? null : 'assign')}
            >
              Bulk Assign
            </button>
            <button
              className={`crm-super-admin-btn crm-super-admin-btn-small${bulkMode === 'shuffle' ? '' : ' crm-super-admin-btn-secondary'}`}
              onClick={() => setBulkMode(bulkMode === 'shuffle' ? null : 'shuffle')}
            >
              Shuffle / Distribute
            </button>
            <button
              className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
              onClick={() => { setCsvImportOpen(true); setCsvRawText(''); setCsvFile(null); setCsvParsed([]); setCsvParseError(''); }}
            >
              Import CSV
            </button>
            {selected.length > 0 && (
              <>
                <span style={{ color: 'var(--crm-accent)', fontSize: 12, fontWeight: 600 }}>
                  {selected.length} selected
                  <button onClick={() => setSelected([])} style={{ marginLeft: 8, background: 'transparent', border: '1px solid var(--crm-border)', color: 'var(--crm-text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}>clear</button>
                </span>
                <span style={{ width: 1, height: 22, background: 'var(--crm-border)' }} />
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: 'rgba(246,70,93,0.15)', color: '#F6465D', border: '1px solid #F6465D40' }}
                  onClick={handleBulkDelete}
                  title={`Move ${selected.length} lead(s) to bin`}
                >
                  🗑 Move to Bin
                </button>
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: '#c0392b', color: '#fff' }}
                  onClick={handleBulkPermanentDelete}
                  title={`Permanently delete ${selected.length} lead(s) - cannot be undone`}
                >
                  ✕ Delete Forever
                </button>
                <span style={{ width: 1, height: 22, background: 'var(--crm-border)' }} />
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: 'rgba(246,70,93,0.15)', color: '#F6465D', border: '1px solid #F6465D40' }}
                  onClick={handleBulkSuspend}
                  title={`Suspend ${selected.length} lead(s)`}
                >
                  🔒 Suspend
                </button>
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: 'rgba(14,203,129,0.12)', color: '#0ECB81', border: '1px solid #0ECB8140' }}
                  onClick={handleBulkActivate}
                  title={`Re-activate ${selected.length} lead(s)`}
                >
                  OK Activate
                </button>
              </>
            )}
          </div>

          {/* Bulk Assign / Reassign panel */}
          {bulkMode === 'assign' && (
            <div style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-accent)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--crm-accent)', fontWeight: 600, marginBottom: 10 }}>
                Bulk Assign / Reassign - {selected.length} lead(s) selected
              </div>

              {/* Quick agent pick */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Quick assign to Agent (auto-fills office & team)</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select
                    className="crm-super-admin-select"
                    style={{ flex: 1 }}
                    value={bulkAgentId}
                    onChange={e => {
                      const agId = e.target.value;
                      setBulkAgentId(agId);
                      setBulkTeamLeaderId('');
                      if (agId) {
                        const agent = data.users.find(u => u.id === agId);
                        if (agent) { setBulkOfficeId(agent.officeId || ''); setBulkTeamId(agent.teamId || ''); }
                      } else {
                        setBulkAgentId('');
                      }
                    }}
                  >
                    <option value="">- No agent -</option>
                    {data.offices.map(office => {
                      const officeAgents = data.users.filter(u => u.role === ROLE.AGENT && u.officeId === office.id);
                      if (!officeAgents.length) return null;
                      return (
                        <optgroup key={office.id} label={`[office] ${office.name}`}>
                          {officeAgents.map(agent => {
                            const team = data.teams.find(t => t.id === agent.teamId);
                            return <option key={agent.id} value={agent.id}>{agent.name}{team ? ` (${team.name})` : ''}</option>;
                          })}
                        </optgroup>
                      );
                    })}
                    {data.users.filter(u => u.role === ROLE.AGENT && !u.officeId).map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name} (unassigned)</option>
                    ))}
                  </select>
                  <button className="crm-super-admin-btn" onClick={handleBulkAssign} disabled={selected.length === 0}>Apply</button>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Or assign directly to a Team Leader</div>
                <select
                  className="crm-super-admin-select"
                  style={{ width: '100%' }}
                  value={bulkTeamLeaderId}
                  onChange={e => {
                    const leaderId = e.target.value;
                    const leader = data.users.find(u => u.id === leaderId);
                    setBulkTeamLeaderId(leaderId);
                    setBulkAgentId('');
                    setBulkOfficeId(leader?.officeId || '');
                    setBulkTeamId(leader?.teamId || '');
                  }}
                >
                  <option value="">- No direct Team Leader -</option>
                  {data.offices.map(office => {
                    const leaders = data.users.filter(u => u.role === ROLE.TEAM_LEADER && u.officeId === office.id);
                    if (!leaders.length) return null;
                    return (
                      <optgroup key={office.id} label={`${office.name} - Team Leaders`}>
                        {leaders.map(leader => <option key={leader.id} value={leader.id}>{leader.name}{leader.teamId ? ` (${getTeamName(leader.teamId, data.teams)})` : ' (standalone)'}</option>)}
                      </optgroup>
                    );
                  })}
                  {data.users.filter(u => u.role === ROLE.TEAM_LEADER && !u.officeId).map(leader => (
                    <option key={leader.id} value={leader.id}>{leader.name} (standalone)</option>
                  ))}
                </select>
              </div>

              {/* Or office/team only */}
              <div style={{ borderTop: '1px solid var(--crm-border)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>Or assign to Office / Team only</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Office</div>
                    <select className="crm-super-admin-select" style={{ width: '100%' }} value={bulkOfficeId} onChange={e => { setBulkOfficeId(e.target.value); setBulkTeamId(''); setBulkTeamLeaderId(''); setBulkAgentId(''); }}>
                      <option value="">- None (Pool) -</option>
                      {data.offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Team</div>
                    <select className="crm-super-admin-select" style={{ width: '100%' }} value={bulkTeamId} onChange={e => { setBulkTeamId(e.target.value); setBulkTeamLeaderId(''); setBulkAgentId(''); }} disabled={!bulkOfficeId}>
                      <option value="">- None -</option>
                      {data.teams.filter(t => t.officeId === bulkOfficeId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button className="crm-super-admin-btn" onClick={handleBulkAssign} disabled={selected.length === 0}>Apply</button>
                </div>
              </div>
            </div>
          )}

          {/* Shuffle / Distribute panel */}
          {bulkMode === 'shuffle' && (
            <div style={{ background: 'var(--crm-card)', border: '1px solid #0A84FF', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#0A84FF', fontWeight: 600, marginBottom: 10 }}>
                Shuffle / Distribute - {selected.length > 0 ? `${selected.length} selected lead(s)` : 'all leads with no agent'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Distribute among</div>
                  <select className="crm-super-admin-select" value={shuffleScope} onChange={e => { setShuffleScope(e.target.value); setShuffleTargets([]); }}>
                    <option value="offices">Offices</option>
                    <option value="teams">Teams</option>
                    <option value="agents">Agents</option>
                    <option value="team-leaders">Team Leaders (direct)</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Filter by status (optional)</div>
                  <select className="crm-super-admin-select" value={shuffleStatus} onChange={e => setShuffleStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>
                Pick targets ({shuffleTargets.length} selected):
              </div>
              <div style={{ maxHeight: 140, overflowY: 'auto', background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', borderRadius: 6, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {(shuffleScope === 'offices' ? data.offices.map(o => ({ id: o.id, label: o.name })) :
                  shuffleScope === 'teams' ? data.teams.map(t => ({ id: t.id, label: `${t.name} (${getOfficeName(t.officeId, data.offices)})` })) :
                  shuffleScope === 'team-leaders' ? data.users.filter(u => u.role === ROLE.TEAM_LEADER).map(u => ({
                    id: u.id,
                    label: `${u.name}  /  ${u.teamId ? getTeamName(u.teamId, data.teams) : 'standalone'}`,
                  })) :
                  data.users.filter(u => u.role === ROLE.AGENT).map(u => ({ id: u.id, label: `${u.name}  /  ${getTeamName(u.teamId, data.teams)}` }))
                ).map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleShuffleTarget(t.id)}
                    style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                      background: shuffleTargets.includes(t.id) ? '#0A84FF' : 'var(--crm-card)',
                      color: shuffleTargets.includes(t.id) ? 'var(--crm-bg)' : 'var(--crm-text-primary)',
                      border: '1px solid var(--crm-border)', fontWeight: shuffleTargets.includes(t.id) ? 600 : 400,
                    }}
                  >{t.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="crm-super-admin-btn" style={{ background: '#0A84FF', color: '#FFFFFF' }} onClick={handleShuffle} disabled={shuffleTargets.length === 0}>🔀 Shuffle Now</button>
                <button className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary" onClick={() => setShuffleTargets([])}>Clear targets</button>
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
            Click any row to open the client profile. Showing {paged.length} of {filtered.length} clients (page {page}/{totalPages})
          </div>

          <div className="crm-admin-table-container">
            <table className="crm-admin-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      checked={paged.length > 0 && paged.every(l => selected.includes(l.id))}
                      onChange={e => {
                        if (e.target.checked) setSelected([...new Set([...selected, ...paged.map(l => l.id)])]);
                        else setSelected(selected.filter(id => !paged.find(l => l.id === id)));
                      }}
                    />
                  </th>
                  <th>Client ID</th>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Office</th>
                  <th>Team</th>
                  <th>Direct Team Leader</th>
                  <th>Agent</th>
                  <th>Registered</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', padding: 20, color: 'var(--crm-text-secondary)' }}>No leads match your filters.</td></tr>
                ) : paged.map(lead => (
                  <React.Fragment key={lead.id}>
                  <tr style={{ cursor: 'pointer', background: selected.includes(lead.id) ? 'var(--crm-card)' : undefined }} onClick={() => openProfile(lead)}>
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(lead.id)}
                        onChange={e => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter(id => id !== lead.id))}
                      />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--crm-text-primary)' }}>
                          {lead.id ? lead.id.slice(0, 6) : '-'}
                        </span>
                        {lead.id && (
                          <button
                            title={lead.id}
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(lead.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}
                          >
                            <i className="fas fa-copy" style={{ fontSize: 11 }}></i>
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--crm-accent, #0A84FF), #5E5CE6)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 11,
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                        }}>
                          {((lead.firstName?.[0] || '') + (lead.lastName?.[0] || '')).toUpperCase() || 'L'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--crm-text-primary, #F5F5F7)', fontSize: 13 }}>{lead.firstName} {lead.lastName}</div>
                          <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #86868B)' }}>{lead.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{getCountryFlag(lead.countryCode, lead.country)} {lead.country}</td>
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <StatusDropdown
                        value={normalizeStage(lead.stage)}
                        options={LEAD_STATUSES}
                        onChange={(newStage) => handleLeadStatusChange(lead.id, newStage)}
                      />
                    </td>
                    <td style={{ color: lead.assignedToOffice ? 'var(--crm-text-primary)' : 'var(--crm-accent)', fontSize: 12 }}>
                      {lead.assignedToOffice ? getOfficeName(lead.assignedToOffice, data.offices) : 'Pool'}
                    </td>
                    <td style={{ color: lead.assignedToTeam ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)', fontSize: 12 }}>
                      {lead.assignedToTeam ? getTeamName(lead.assignedToTeam, data.teams) : '-'}
                    </td>
                    <td style={{ color: lead.assignedToTeamLeader ? 'var(--crm-accent)' : 'var(--crm-text-secondary)', fontSize: 12 }}>
                      {lead.assignedToTeamLeader ? getUserName(lead.assignedToTeamLeader, data.users) : '-'}
                    </td>
                    <td style={{ color: lead.assignedToAgent ? '#0ECB81' : 'var(--crm-text-secondary)', fontSize: 12 }}>
                      {lead.assignedToAgent ? getUserName(lead.assignedToAgent, data.users) : '-'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.registeredDate || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {(() => {
                        const raw = lead.lastCommentDate;
                        if (!raw) return <span style={{ color: '#555', fontSize: 11 }}>Never</span>;
                        const diffMs = Date.now() - new Date(raw).getTime();
                        const days = Math.floor(diffMs / 86400000);
                        const label = days === 0 ? 'Today' : days === 1 ? '1d ago' : `${days}d ago`;
                        const color = days === 0 ? '#0ECB81' : days <= 3 ? '#0ECB81' : days <= 7 ? 'var(--crm-accent)' : days <= 30 ? '#FF9F0A' : '#F6465D';
                        return (
                          <span style={{
                            display: 'inline-block', padding: '2px 7px', borderRadius: 10,
                            background: `${color}18`, color, fontSize: 11, fontWeight: 600,
                            border: `1px solid ${color}33`,
                          }}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="crm-super-admin-btn crm-super-admin-btn-small"
                        style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(48, 209, 88, 0.15)', color: '#30D158', border: '1px solid rgba(48, 209, 88, 0.3)', fontWeight: 600, marginRight: 4 }}
                        onClick={() => enterLeadAccount(lead)}
                        title="Enter client portal directly (no password needed)"
                      >🚀 Enter Portal</button>
                      <button
                        className="crm-super-admin-btn crm-super-admin-btn-small"
                        style={{ fontSize: 11, padding: '4px 10px', background: '#3a7bd5', color: '#fff', fontWeight: 600 }}
                        onClick={() => { setEditingLead(lead); }}
                        title="Edit client profile fields"
                      > Edit</button>
                      <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ fontSize: 11, padding: '4px 10px', marginLeft: 4, background: '#c0392b', color: '#fff' }} onClick={() => deleteLead(lead)} title="Move to Recycle Bin">🗑 Bin</button>
                    </td>
                  </tr>
                  {quickAssignLeadId === lead.id && (
                    <tr style={{ background: 'var(--crm-bg)' }}>
                      <td colSpan={11} style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--crm-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Assign "{lead.firstName} {lead.lastName}" to:</span>
                          <select
                            className="crm-super-admin-select"
                            style={{ flex: '1 1 220px', minWidth: 180 }}
                            value={quickAssignAgentId}
                            onChange={e => setQuickAssignAgentId(e.target.value)}
                            autoFocus
                          >
                            <option value="">- Unassign (return to pool) -</option>
                            {data.offices.map(office => {
                              const officeAgents = data.users.filter(u => u.role === ROLE.AGENT && u.officeId === office.id);
                              if (!officeAgents.length) return null;
                              return (
                                <optgroup key={office.id} label={`[office] ${office.name}`}>
                                  {officeAgents.map(agent => {
                                    const team = data.teams.find(t => t.id === agent.teamId);
                                    return (
                                      <option key={agent.id} value={agent.id}>
                                        {agent.name}{team ? `  /  ${team.name}` : ''}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              );
                            })}
                            {data.users.filter(u => u.role === ROLE.AGENT && !u.officeId).map(agent => (
                              <option key={agent.id} value={agent.id}>{agent.name} (no office)</option>
                            ))}
                          </select>
                          <button
                            className="crm-super-admin-btn crm-super-admin-btn-small"
                            style={{ background: '#0ECB81', color: '#FFFFFF', fontWeight: 700, whiteSpace: 'nowrap' }}
                            onClick={() => handleQuickAssign(lead)}
                          >✓ Apply</button>
                          <button
                            className="crm-super-admin-btn crm-super-admin-btn-small"
                            style={{ background: 'var(--crm-border)', color: 'var(--crm-text-primary)' }}
                            onClick={() => { setQuickAssignLeadId(null); setQuickAssignAgentId(''); }}
                          >✕ Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>Page {page} of {totalPages}</span>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              <button className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          )}
        </div>
      )}

      {/* ── LEAD PROFILE MODAL ── */}
      {profileLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }} onClick={closeProfile}>
          <div style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 12, width: '100%', maxWidth: 860, padding: 28, position: 'relative' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: profileLead.isOnline ? '#0ECB81' : 'var(--crm-text-secondary)', display: 'inline-block' }} />
                  <span style={{ color: profileLead.isOnline ? '#0ECB81' : 'var(--crm-text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {profileLead.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <h2 style={{ margin: '0 0 4px', color: 'var(--crm-text-primary)', fontSize: 20, fontWeight: 700 }}>{profileLead.firstName} {profileLead.lastName}</h2>
                <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>{profileLead.email}  /  {profileLead.phone}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', marginLeft: 'auto', flexWrap: 'nowrap' }}>
                <button
                  style={{ background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 600, padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', minWidth: 120 }}
                  onClick={() => navigate(getLeadProfilePath(ROLE.SUPER_ADMIN, currentUser.id, profileLead.id))}
                  title="Open the full lead profile page"
                >
                  Open Profile
                </button>
                <button
                  style={{ background: '#0ECB81', color: '#FFFFFF', fontWeight: 600, padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', minWidth: 120 }}
                  onClick={() => enterLeadAccount(profileLead)}
                  title="Log in to this lead's own account"
                >
                  Enter Account
                </button>
                <button
                  style={{ background: '#5B4FBE', color: '#fff', fontWeight: 600, padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', minWidth: 120 }}
                  onClick={() => {
                    closeProfile();
                    const el = document.getElementById('bulk-assign-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  title="Reassign this lead to an agent"
                >
                  ⇄ Reassign
                </button>
                <button
                  onClick={closeProfile}
                  style={{ background: 'none', border: '1px solid var(--crm-border)', color: 'var(--crm-text-secondary)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  aria-label="Close"
                >✕</button>
              </div>
            </div>

            {/* Quick Reach Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              {profileLead.email && (
                <a
                  href={`mailto:${profileLead.email}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(10, 132, 255, 0.15)', color: '#0A84FF', border: '1px solid rgba(10, 132, 255, 0.3)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
                  title="Send email"
                >
                  <i className="fas fa-envelope"></i>
                  <span>Email: {profileLead.email}</span>
                </a>
              )}
              {profileLead.phone && (
                <a
                  href={`tel:${profileLead.phone}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(52, 199, 89, 0.15)', color: '#34C759', border: '1px solid rgba(52, 199, 89, 0.3)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
                  title="Call lead"
                >
                  <i className="fas fa-phone"></i>
                  <span>Call: {profileLead.phone}</span>
                </a>
              )}
              {profileLead.phone && (
                <a
                  href={`https://wa.me/${String(profileLead.phone).replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Hi ${profileLead.firstName || profileLead.name}, thank you for contacting Codex Dynamics.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
                  title="WhatsApp chat"
                >
                  <i className="fab fa-whatsapp"></i>
                  <span>WhatsApp Direct</span>
                </a>
              )}
            </div>

            {/* Lead Info Grid - 3 Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#2B2F38', borderRadius: 8, padding: 16, border: '1px solid var(--crm-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>Client Details</div>
                {[
                  ['Country', profileLead.country || '-'],
                  ['Funnel', profileLead.funnel || '-'],
                  ['Affiliate', profileLead.affiliate || '-'],
                  ['Registered', profileLead.registeredDate || (profileLead.createdAt ? new Date(profileLead.createdAt).toLocaleDateString() : '-')],
                  ['Last Comment', profileLead.lastCommentDate || '-'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--crm-text-secondary)' }}>{label}</span>
                    <span style={{ color: 'var(--crm-text-primary)' }}>
                      {label === 'Country' && getCountryFlag(profileLead.countryCode, profileLead.country)}
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ background: '#2B2F38', borderRadius: 8, padding: 16, border: '1px solid var(--crm-border)' }}>
                <div style={{ fontSize: 11, color: '#0A84FF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>Customer Intake & Scope</div>
                {[
                  ['Company / Org', profileLead.company || 'Individual / None'],
                  ['Service Selected', profileLead.service || profileLead.funnel || 'General Inquiry'],
                  ['Estimated Budget', profileLead.budget || '-'],
                  ['Target Timeline', profileLead.timeline || 'Flexible'],
                  ['Entry Origin', profileLead.source === 'website_contact_modal' ? 'Website Modal' : profileLead.source === 'website_contact_form' ? 'Website Form' : (profileLead.source || 'Direct')],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--crm-text-secondary)' }}>{label}</span>
                    <span style={{ color: label === 'Estimated Budget' ? '#34C759' : label === 'Service Selected' ? '#0A84FF' : 'var(--crm-text-primary)', fontWeight: label === 'Estimated Budget' || label === 'Service Selected' ? 600 : 400 }}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ background: '#2B2F38', borderRadius: 8, padding: 16, border: '1px solid var(--crm-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>Assignment Chain</div>
                {[
                  ['Office', profileOffice?.name || 'Unassigned (Pool)', !!profileLead.assignedToOffice],
                  ['Team', profileTeam?.name || '-', !!profileLead.assignedToTeam],
                  ['Agent', profileAgent?.name || '-', !!profileLead.assignedToAgent],
                  ['Assigned By', profileLead.assignedBy || '-', false],
                ].map(([label, val, active]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--crm-text-secondary)' }}>{label}</span>
                    <span style={{ color: active ? 'var(--crm-accent)' : 'var(--crm-text-primary)' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Submission Message */}
            {profileLead.message && (
              <div style={{ background: '#232730', border: '1px solid var(--crm-border)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-comment-dots" style={{ color: '#0A84FF' }}></i>
                  <span>Customer Submission Message</span>
                </div>
                <div style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic', background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  "{profileLead.message}"
                </div>
              </div>
            )}

            {/* Internal Staff Notes */}
            {profileLead.notes && (
              <div style={{ background: '#232730', border: '1px solid var(--crm-border)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-accent)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-sticky-note"></i>
                  <span>Internal Staff Follow-Up Notes</span>
                </div>
                <div style={{ color: 'var(--crm-text-primary)', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {profileLead.notes}
                </div>
              </div>
            )}

            {/* Stage & Comment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 6 }}>Select Status</label>
                <select className="crm-super-admin-select" style={{ width: '100%' }} value={profileStage} onChange={e => setProfileStage(e.target.value)}>
                  {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 6 }}>Comment</label>
                <textarea
                  value={profileComment}
                  onChange={e => setProfileComment(e.target.value)}
                  rows={3}
                  style={{ width: '100%', background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 6, color: 'var(--crm-text-primary)', padding: '8px 10px', resize: 'vertical', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Reassign Controls */}
            <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Reassign</div>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 12 }}>
                Pick an agent directly - office and team are filled automatically. Or assign to just an office or team.
              </div>

              {/* Quick assign: agent picker (all agents, grouped by team/office) */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-accent)', fontWeight: 600, marginBottom: 4 }}>Quick Assign to Agent</div>
                <select
                  className="crm-super-admin-select"
                  style={{ width: '100%' }}
                  value={reassignAgentId}
                  onChange={e => {
                    const agentId = e.target.value;
                    setReassignAgentId(agentId);
                    if (agentId) {
                      const agent = data.users.find(u => u.id === agentId);
                      if (agent) {
                        setReassignTeamId(agent.teamId || '');
                        setReassignOfficeId(agent.officeId || '');
                      }
                    } else {
                      setReassignAgentId('');
                    }
                  }}
                >
                  <option value="">- No agent (assign to office/team only) -</option>
                  {data.offices.map(office => {
                    const officeAgents = data.users.filter(u => u.role === ROLE.AGENT && u.officeId === office.id);
                    if (officeAgents.length === 0) return null;
                    return (
                      <optgroup key={office.id} label={`[office] ${office.name}`}>
                        {officeAgents.map(agent => {
                          const team = data.teams.find(t => t.id === agent.teamId);
                          return (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}{team ? ` (${team.name})` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    );
                  })}
                  {data.users.filter(u => u.role === ROLE.AGENT && !u.officeId).map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name} (unassigned office)</option>
                  ))}
                </select>
              </div>

              {/* Manual office/team override */}
              <div style={{ borderTop: '1px solid var(--crm-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, marginBottom: 8 }}>Or assign to Office / Team only</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Office</div>
                    <select className="crm-super-admin-select" style={{ width: '100%' }} value={reassignOfficeId} onChange={e => { setReassignOfficeId(e.target.value); setReassignTeamId(''); setReassignAgentId(''); }}>
                      <option value="">None (Pool)</option>
                      {data.offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Team</div>
                    <select className="crm-super-admin-select" style={{ width: '100%' }} value={reassignTeamId} onChange={e => { setReassignTeamId(e.target.value); setReassignAgentId(''); }} disabled={!reassignOfficeId}>
                      <option value="">None</option>
                      {data.teams.filter(t => t.officeId === reassignOfficeId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Comment History */}
            {profileLead.commentHistory && profileLead.commentHistory.length > 0 && (
              <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 16, marginBottom: 20, maxHeight: 180, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Comment History</div>
                {[...profileLead.commentHistory].reverse().map((entry, i) => (
                  <div key={i} style={{ borderBottom: '1px solid var(--crm-border)', paddingBottom: 8, marginBottom: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: 'var(--crm-accent)', fontWeight: 600 }}>{entry.by}</span>
                      <span style={{ color: 'var(--crm-text-secondary)' }}>{entry.date}</span>
                    </div>
                    <div style={{ color: 'var(--crm-text-primary)' }}>{entry.text}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Profile Change History */}
            <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Profile Change History</span>
                  {profileHistoryLoading && (
                    <span style={{ fontSize: 10, color: 'var(--crm-accent)', fontWeight: 400 }}>Loading...</span>
                  )}
                </div>
                {profileHistory.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('Clear all profile history for this user?')) return;
                      try {
                        await clearProfileHistoryApi(profileLead.id);
                        setProfileHistory([]);
                      } catch (err) {
                        showNotification('Could not clear profile history: ' + (err.message || 'error'));
                      }
                    }}
                    style={{ background: 'rgba(246,70,93,0.12)', border: '1px solid #F6465D55', color: '#F6465D', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'none' }}
                  >
                    🗑 Clear All
                  </button>
                )}
              </div>
              {profileHistoryError && (
                <div style={{ color: '#F6465D', fontSize: 12 }}>{profileHistoryError}</div>
              )}
              {!profileHistoryLoading && !profileHistoryError && profileHistory.length === 0 && (
                <div style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>No profile changes recorded yet.</div>
              )}
              {profileHistory.length > 0 && (
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {profileHistory.map((entry) => {
                    const isClientAction = !entry.actorAdminId;
                    const changedFields = entry.after ? Object.keys(entry.after) : [];
                    const date = entry.createdAt
                      ? new Date(entry.createdAt.endsWith('Z') ? entry.createdAt : entry.createdAt + 'Z').toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                      : '-';
                    return (
                      <div key={entry.id} style={{ borderBottom: '1px solid var(--crm-border)', paddingBottom: 10, marginBottom: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              background: isClientAction ? '#1E3A5F' : '#2D3B22',
                              color: isClientAction ? '#3B82F6' : '#0ECB81',
                              borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0,
                            }}>
                              {isClientAction ? 'SELF' : 'ADMIN'}
                            </span>
                            <span style={{ color: 'var(--crm-text-primary)', fontWeight: 600 }}>{entry.actionLabel}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--crm-text-secondary)', whiteSpace: 'nowrap' }}>{date}</span>
                            <button
                              title="Delete this entry"
                              onClick={async () => {
                                try {
                                  await deleteProfileHistoryEntryApi(profileLead.id, entry.id);
                                  setProfileHistory(prev => prev.filter(e => e.id !== entry.id));
                                } catch (err) {
                                  showNotification('Could not delete entry: ' + (err.message || 'error'));
                                }
                              }}
                              style={{ background: 'none', border: '1px solid #F6465D44', color: '#F6465D', borderRadius: 3, padding: '1px 5px', fontSize: 10, cursor: 'pointer' }}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                        <div style={{ color: 'var(--crm-text-secondary)', marginBottom: 4 }}>
                          By: <span style={{ color: isClientAction ? 'var(--crm-text-primary)' : 'var(--crm-accent)' }}>{entry.actorName}</span>
                          {entry.ip && <span style={{ color: 'var(--crm-text-secondary)', marginLeft: 8 }}> /  IP: {entry.ip}</span>}
                        </div>
                        {changedFields.length > 0 && changedFields.filter(k => k !== 'avatar_url').map((field) => {
                          const before = entry.before?.[field];
                          const after  = entry.after?.[field];
                          const fieldLabel = {
                            name: 'Name', email: 'Email', phone: 'Phone',
                            status: 'Status',
                          }[field] || field;
                          if (field === 'password') return (
                            <div key={field} style={{ color: 'var(--crm-text-secondary)', fontStyle: 'italic' }}>Password changed</div>
                          );
                          if (before === undefined && after !== undefined) return (
                            <div key={field} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--crm-text-secondary)' }}>{fieldLabel}:</span>
                              <span style={{ color: '#0ECB81' }}>{String(after)}</span>
                            </div>
                          );
                          return (
                            <div key={field} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--crm-text-secondary)' }}>{fieldLabel}:</span>
                              <span style={{ color: '#F6465D', textDecoration: 'line-through' }}>{before !== undefined && before !== null ? String(before) : '-'}</span>
                              <span style={{ color: 'var(--crm-text-secondary)' }}>→</span>
                              <span style={{ color: '#0ECB81' }}>{after !== undefined && after !== null ? String(after) : '-'}</span>
                            </div>
                          );
                        })}
                        {changedFields.includes('avatar_url') && (
                          <div style={{ color: 'var(--crm-text-secondary)', fontStyle: 'italic' }}>Profile photo updated</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="crm-super-admin-btn crm-super-admin-btn-small" onClick={saveProfile}>💾 Save Changes</button>
                <button className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary" onClick={unassignLead}>Return to Pool</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: '#7B2FBE', color: '#fff' }}
                  onClick={resetLeadStatus}
                  title="Reset stage to New and erase all status history"
                >
                  🔄 Reset Status
                </button>
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: '#8B3A1E', color: '#fff' }}
                  onClick={clearLeadComments}
                  title="Permanently delete all comments on this lead"
                >
                  🗨 Clear Comments
                </button>
                <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ background: '#c0392b', color: '#fff' }} onClick={() => deleteLead(profileLead)}>🗑 Move to Bin</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={(updates) => {
            const targetId = editingLead.id;
            setData(prev => ({
              ...prev,
              leads: prev.leads.map(l => l.id === targetId ? { ...l, ...updates } : l),
            }));
            setProfileLead(prev => prev?.id === targetId ? { ...prev, ...updates } : prev);
            showNotification(`Profile updated for ${updates.firstName} ${updates.lastName}.`);
            setEditingLead(null);
            updateLeadApi(targetId, updates).catch((err) => {
              console.error('[SuperAdminPanel] EditLeadModal save failed', err);
              showNotification('Could not save profile changes to the server.');
            });
          }}
        />
      )}

    </div>
    </>
  );
}

function RecycleBin({ data, setData, showNotification }) {
  const [confirmDialog, confirm] = useConfirmDialog();
  const deletedLeads = data.deletedLeads || [];
  const recycleBin = data.recycleBin || [];

  // RecycleBin tab - same backend wiring as the AllLeadsTable bin actions.
  const restoreLead = (lead) => {
    setData(prev => ({
      ...prev,
      leads: [...(prev.leads || []), lead],
      deletedLeads: (prev.deletedLeads || []).filter(l => l.id !== lead.id),
    }));
    showNotification(`Restored lead "${lead.firstName} ${lead.lastName}".`);
    restoreLeadApi(lead.id).catch((error) => {
      console.error('[RecycleBin] restoreLead failed', error);
      showNotification('Could not restore lead on the server.');
      setData(prev => ({
        ...prev,
        leads: (prev.leads || []).filter(l => l.id !== lead.id),
        deletedLeads: [...(prev.deletedLeads || []), lead],
      }));
    });
  };
  const purgeLead = async (lead) => {
    const ok = await confirm({
      title: 'Permanently delete lead?',
      message: `Permanently delete "${lead.firstName} ${lead.lastName}"? This cannot be undone.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
    });
    if (!ok) return;
    setData(prev => ({ ...prev, deletedLeads: (prev.deletedLeads || []).filter(l => l.id !== lead.id) }));
    showNotification('Lead permanently removed.');
    deleteLeadApi(lead.id, { permanent: true, force: true }).catch((error) => {
      console.error('[RecycleBin] purgeLead failed', error);
      showNotification('Could not permanently delete lead on the server.');
      setData(prev => ({ ...prev, deletedLeads: [...(prev.deletedLeads || []), lead] }));
    });
  };
  const restoreItem = async (entry) => {
    try {
      let restored;
      if (entry.type === 'office') restored = await restoreOfficeApi(entry.id);
      else if (entry.type === 'team') restored = await restoreTeamApi(entry.id);
      else if (entry.type === 'agent' || entry.type === 'user') restored = await restoreStaffApi(entry.id);
      else return;
      setData((prev) => {
        const mergeById = (current, additions) => {
          const rows = new Map((current || []).map((row) => [row.id, row]));
          (additions || []).forEach((row) => rows.set(row.id, row));
          return [...rows.values()];
        };
        const leads = restored.leads || [];
        const restoredLeadIds = new Set(leads.map((lead) => lead.id));
        const restoredStaff = Array.isArray(restored.staff)
          ? restored.staff
          : restored.staff ? [restored.staff] : [];
        return {
          ...prev,
          recycleBin: (prev.recycleBin || []).filter((item) => item.id !== entry.id),
          offices: restored.office ? mergeById(prev.offices, [restored.office]) : prev.offices,
          teams: mergeById(prev.teams, restored.teams || (restored.team ? [restored.team] : [])),
          users: mergeById(prev.users, restoredStaff),
          leads: leads.length
            ? [...(prev.leads || []).filter((lead) => !restoredLeadIds.has(lead.id)), ...leads]
            : prev.leads,
        };
      });
      showNotification(`Restored ${entry.type}.`);
    } catch (err) {
      console.error('[RecycleBin] restoreItem failed', err);
      showNotification(`Could not restore ${entry.type} on the server.`);
    }
  };
  const purgeItem = async (entry) => {
    const ok = await confirm({
      title: `Permanently delete ${entry.type}?`,
      message: `Permanently delete this ${entry.type}? This cannot be undone.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      if (entry.type === 'office') await deleteOfficePermanent(entry.id);
      else if (entry.type === 'team') await deleteTeamPermanent(entry.id);
      else if (entry.type === 'agent' || entry.type === 'user') await deleteStaffApi(entry.id, { permanent: true });
      setData(prev => ({ ...prev, recycleBin: (prev.recycleBin || []).filter(e => e.id !== entry.id) }));
      showNotification(`${entry.type} permanently removed.`);
    } catch (err) {
      console.error('[RecycleBin] purgeItem backend failed', err);
      showNotification(`Could not permanently delete ${entry.type} on the server.`);
    }
  };
  const emptyAll = async () => {
    const ok = await confirm({
      title: 'Empty the recycle bin?',
      message: 'Permanently delete ALL items in the bin? This cannot be undone.',
      confirmLabel: 'Empty bin',
      tone: 'danger',
    });
    if (!ok) return;
    const toPurgeLeads = (data.deletedLeads || []).map((l) => l.id);
    const toPurgeBin   = [...(data.recycleBin  || [])];
    const leadPurge = toPurgeLeads.length > 0 ? purgeBinLeads(toPurgeLeads) : Promise.resolve();
    const binDeletes = toPurgeBin.map((entry) => {
      if (entry.type === 'office') return deleteOfficePermanent(entry.id);
      if (entry.type === 'team') return deleteTeamPermanent(entry.id);
      if (entry.type === 'agent' || entry.type === 'user') return deleteStaffApi(entry.id, { permanent: true });
      return Promise.resolve();
    });
    const [leadResult, ...binResults] = await Promise.allSettled([leadPurge, ...binDeletes]);
    const failedEntries = toPurgeBin.filter((_, index) => binResults[index]?.status === 'rejected');
    setData((prev) => ({
      ...prev,
      deletedLeads: leadResult.status === 'rejected' ? (prev.deletedLeads || []) : [],
      recycleBin: failedEntries,
    }));
    const failedCount = failedEntries.length + (leadResult.status === 'rejected' ? 1 : 0);
    if (failedCount) {
      console.error('[RecycleBin] emptyAll: some items failed to purge');
      showNotification(`Failed to permanently delete ${failedCount} item${failedCount > 1 ? 's' : ''}.`);
    } else {
      showNotification('Recycle bin emptied.');
    }
  };
  const totalCount = deletedLeads.length + recycleBin.length;

  return (
    <>
    {confirmDialog}
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--crm-text-primary)' }}>🗑 Recycle Bin</h2>
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginTop: 4 }}>{totalCount} item{totalCount !== 1 ? 's' : ''} pending permanent deletion.</div>
        </div>
        {totalCount > 0 && (
          <button className="crm-super-admin-btn" style={{ background: '#c0392b', color: '#fff' }} onClick={emptyAll}>Empty Bin</button>
        )}
      </div>

      <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deleted Leads ({deletedLeads.length})</h3>
        {deletedLeads.length === 0 ? (
          <div style={{ color: 'var(--crm-text-secondary)', fontSize: 13, padding: 12, textAlign: 'center' }}>No deleted leads.</div>
        ) : (
          <div className="crm-super-admin-table-wrapper">
            <table className="crm-super-admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Country</th><th>Status</th><th>Deleted</th><th>Actions</th></tr></thead>
              <tbody>
                {deletedLeads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</td>
                    <td style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>{lead.email}</td>
                    <td>{lead.country}</td>
                    <td><span className={`crm-status-badge ${statusClass(lead.stage)}`}>{normalizeStage(lead.stage)}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.deletedAt ? new Date(lead.deletedAt).toLocaleString() : '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ background: '#0ECB81', color: '#FFFFFF' }} onClick={() => restoreLead(lead)}>↻ Restore</button>
                      <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ marginLeft: 4, background: '#c0392b', color: '#fff' }} onClick={() => purgeLead(lead)}>✕ Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="crm-super-admin-card">
        <h3 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deleted Offices  /  Teams  /  Agents ({recycleBin.length})</h3>
        {recycleBin.length === 0 ? (
          <div style={{ color: 'var(--crm-text-secondary)', fontSize: 13, padding: 12, textAlign: 'center' }}>No deleted offices, teams, or agents.</div>
        ) : (
          <div className="crm-super-admin-table-wrapper">
            <table className="crm-super-admin-table">
              <thead><tr><th>Type</th><th>Name</th><th>Deleted</th><th>Actions</th></tr></thead>
              <tbody>
                {recycleBin.map(entry => (
                  <tr key={entry.id}>
                    <td><span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--crm-card)', color: 'var(--crm-accent)', fontSize: 11, textTransform: 'uppercase' }}>{entry.type}</span></td>
                    <td style={{ fontWeight: 600 }}>{entry.item?.name || entry.item?.firstName || entry.id}</td>
                    <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{entry.deletedAt ? new Date(entry.deletedAt).toLocaleString() : '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ background: '#0ECB81', color: '#FFFFFF' }} onClick={() => restoreItem(entry)}>↻ Restore</button>
                      <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ marginLeft: 4, background: '#c0392b', color: '#fff' }} onClick={() => purgeItem(entry)}>✕ Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function SuperAdminPanel({ data, currentUser, setData, assignOfficeManager, createOfficeWithManager, createTeamLeader, createStandaloneTeamLeader, createAgent, toggleStaffBlocked, setLeadAssignment, setUserLoginState, createLead, showNotification }) {
  const navigate = useNavigate();
  const [activeProfileLead, setActiveProfileLead] = useState(null);
  const openLeadProfile = (lead) => {
    setActiveProfileLead(lead);
  };
  const closeLeadProfile = () => {
    setActiveProfileLead(null);
  };
  const [activeProfileStaff, setActiveProfileStaff] = useState(null);
  const openStaffProfile = (staffMember) => {
    setActiveProfileStaff(staffMember);
  };
  const closeStaffProfile = () => {
    setActiveProfileStaff(null);
  };
  const [officeId, setOfficeId] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [newManager, setNewManager] = useState(null);
  // Team Leader creation states
  const [tlOfficeId, setTlOfficeId] = useState('');
  const [tlStandaloneLeader, setTlStandaloneLeader] = useState(false);
  const [tlTeamName, setTlTeamName] = useState('');
  const [tlLeaderName, setTlLeaderName] = useState('');
  const [tlLeaderPassword, setTlLeaderPassword] = useState('');
  const [tlTeamSize, setTlTeamSize] = useState('');
  const [newTeamLeader, setNewTeamLeader] = useState(null);
  // Agent creation states
  const [agTeamId, setAgTeamId] = useState('');
  const [agOfficeId, setAgOfficeId] = useState('');
  const [agAgentName, setAgAgentName] = useState('');
  const [agAgentPassword, setAgAgentPassword] = useState('');
  const [newAgent, setNewAgent] = useState(null);
  // Hierarchy expansion states (used for inline create-form toggles)
  const [expandedOffices, setExpandedOffices] = useState(new Set());
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  // Search state for Offices / Teams / Agents tabs
  const [officeSearch, setOfficeSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');

  // Unified staff search (Staff tab)
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState(''); // '' | 'Office Manager' | 'Team Leader' | 'Agent'
  const [staffStructureFilter, setStaffStructureFilter] = useState('all');
  const [showCreateSuperAdmin, setShowCreateSuperAdmin] = useState(false);
  const [newSuperAdmin, setNewSuperAdmin] = useState({ name: '', email: '', password: '' });
  const [creatingSuperAdmin, setCreatingSuperAdmin] = useState(false);

  // Staff blocking
  // Derived from data.users so the badge always reflects backend truth
  // (status === 'Suspended' or 'Disabled'). The legacy local-state map has
  // been removed - block/unblock now persists through toggleStaffBlocked.
  const staffBlockedStatus = useMemo(
    () => Object.fromEntries(
      (data.users || []).map((u) => [
        u.id,
        u.status === 'Suspended' || u.status === 'Disabled',
      ])
    ),
    [data.users]
  );

  const handleCreateSuperAdmin = async (event) => {
    event.preventDefault();
    if (creatingSuperAdmin) return;
    setCreatingSuperAdmin(true);
    try {
      const staff = await createStaffApi({
        role: ROLE.SUPER_ADMIN,
        name: newSuperAdmin.name.trim(),
        email: newSuperAdmin.email.trim(),
        password: newSuperAdmin.password,
      });
      setData((prev) => ({ ...prev, users: [...prev.users.filter((user) => user.id !== staff.id), staff] }));
      setNewSuperAdmin({ name: '', email: '', password: '' });
      setShowCreateSuperAdmin(false);
      showNotification('Super Admin account created.');
    } catch (error) {
      showNotification(error?.message || 'Could not create the Super Admin account.');
    } finally {
      setCreatingSuperAdmin(false);
    }
  };
  // Info modal: { type: 'office' | 'team', id }
  const [infoModal, setInfoModal] = useState(null);

  // Edit modal state for renaming staff or changing their password
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editModalType, setEditModalType] = useState('name'); // 'name' | 'password'
  const [editModalTitle, setEditModalTitle] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [staffMemberName, setStaffMemberName] = useState('');
  const [editPasswordShown, setEditPasswordShown] = useState(false);

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingStaffId(null);
    setEditingValue('');
    setStaffMemberName('');
    setEditModalTitle('');
    setEditPasswordShown(false);
  };

  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const pool = upper + lower + digits + symbols;
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
    for (let i = 0; i < 10; i += 1) pwd += pick(pool);
    pwd = pwd.split('').sort(() => Math.random() - 0.5).join('');
    setEditingValue(pwd);
    setEditPasswordShown(true);
  };

  const passwordStrength = (pw) => {
    if (!pw) return { level: 0, label: 'Empty' };
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    return { level: score, label: labels[score] };
  };

  const saveStaffEdit = async () => {
    if (!editingStaffId) return;
    const value = (editingValue || '').trim();
    if (!value) {
      showNotification(editModalType === 'password' ? 'Password cannot be empty.' : 'Name cannot be empty.');
      return;
    }
    const staff = data.users.find(u => u.id === editingStaffId);
    if (!staff) return;
    const updates = editModalType === 'password'
      ? { password: value }
      : { name: value };
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === editingStaffId ? { ...u, ...updates } : u)),
    }));
    closeEditModal();
    showNotification(
      editModalType === 'password'
        ? `Password updated for ${staffMemberName}.`
        : `Renamed to "${value}".`
    );
    try {
      const updated = await updateStaffApi(editingStaffId, updates);
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => (
          u.id === editingStaffId
            ? { ...u, ...updated, password: updated.password || updates.password || u.password }
            : u
        )),
      }));
    } catch (err) {
      console.error('[SuperAdminPanel] saveStaffEdit failed', err);
      showNotification('Could not save staff changes on the server.');
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => (u.id === editingStaffId ? staff : u)),
      }));
    }
  };

  /**
   * Block / unblock a staff member through the real backend. The data.users
   * array is updated by the parent App.jsx via toggleStaffBlocked, which
   * means the badge re-derives automatically on the next render.
   *
   * Falls back to a no-op + notification if the parent didn't wire the prop
   * (e.g. when the panel is mounted in a non-real-auth test harness).
   */
  const blockUnblockStaff = async (staffId) => {
    const staffMember = data.users.find(u => u.id === staffId);
    if (!staffMember) return;
    if (typeof toggleStaffBlocked !== 'function') {
      showNotification('Block/unblock is unavailable in this view.');
      return;
    }
    const currentlyBlocked = staffBlockedStatus[staffId];
    const updated = await toggleStaffBlocked(staffId, currentlyBlocked);
    if (updated) {
      const isBlocked = updated.status === 'Suspended' || updated.status === 'Disabled';
      showNotification(`${staffMember.name} has been ${isBlocked ? 'blocked' : 'unblocked'}`);
    }
  };

  const [panelActivityLog, setPanelActivityLog] = useState([]);
  const [panelAuditLog, setPanelAuditLog] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listRecentAuditLog({ limit: 30 }).then((entries) => {
      if (cancelled || !entries.length) return;
      const mapped = entries.map((e) => {
        const actor = e.actor_admin_name ? `by ${e.actor_admin_name}` : '';
        const target = e.target_user_name
          ? `on ${e.target_user_name}`
          : e.target_admin_name
          ? `on ${e.target_admin_name}`
          : '';
        const details = `${e.action.replace(/_/g, ' ')} ${actor} ${target}`.trim();
        const action = e.action || '';
        const type = action.includes('login') ? 'login'
          : action.includes('password') ? 'password-change'
          : action.includes('appointment') ? 'appointment'
          : 'admin-action';
        return {
          userId: e.target_user_id || e.target_admin_id || '',
          type,
          details,
          timestamp: new Date(e.created_at),
        };
      });
      setPanelActivityLog((prev) => (prev.length === 0 ? mapped : prev));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const notificationRef = useRef(null);
  const showPanelNotification = (message, type) => {
    notificationRef.current.show(message, type);
  };
  const logAdminAction = createLogAdminAction(setPanelAuditLog);
  const logActivity = createLogActivity(setPanelActivityLog);
  const leadAccounts = data.leads.map(lead => ({
    ...lead,
    name: lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
    officeId: lead.assignedToOffice,
    teamId: lead.assignedToTeam,
    agentId: lead.assignedToAgent,
    leadStatus: lead.stage,
    password: lead.clientPassword || '',
    accountStatus: lead.accountStatus || 'active',
  }));

  const setLeadAccounts = (updater) => {
    setData(prev => {
      const mapped = prev.leads.map(l => ({
        ...l,
        name: l.name || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Unknown',
        officeId: l.assignedToOffice,
        teamId: l.assignedToTeam,
        agentId: l.assignedToAgent,
        leadStatus: l.stage,
        password: l.clientPassword || '',
        accountStatus: l.accountStatus || 'active',
      }));
      const updated = typeof updater === 'function' ? updater(mapped) : updater;
      const changedLeadUpdates = [];
      const updatedById = Object.fromEntries(updated.map(u => [u.id, u]));
      const nextState = {
        ...prev,
        leads: prev.leads.map(l => {
          const u = updatedById[l.id];
          if (!u) return l;
          const nextLead = {
            ...l,
            name: u.name ?? l.name,
            email: u.email ?? l.email,
            phone: u.phone ?? l.phone,
            country: u.country ?? l.country,
            funnel: u.funnel ?? l.funnel,
            affiliate: u.affiliate ?? l.affiliate,
            registeredDate: u.registeredDate ?? l.registeredDate,
            lastCommentDate: u.lastContactedAt ?? u.lastCommentDate ?? l.lastCommentDate,
            assignedToOffice: u.assignedToOffice ?? u.officeId ?? null,
            assignedToTeam: u.assignedToTeam ?? u.teamId ?? null,
            assignedToAgent: u.assignedToAgent ?? u.agentId ?? null,
            stage: u.stage ?? u.leadStatus ?? l.stage,
            status: u.status ?? l.status,
            clientPassword: u.clientPassword ?? u.password ?? l.clientPassword,
            accountStatus: u.accountStatus || 'active',
          };
          if (
            l.name !== nextLead.name ||
            l.email !== nextLead.email ||
            l.phone !== nextLead.phone ||
            l.country !== nextLead.country ||
            l.funnel !== nextLead.funnel ||
            l.affiliate !== nextLead.affiliate ||
            l.stage !== nextLead.stage ||
            l.clientPassword !== nextLead.clientPassword
          ) {
            changedLeadUpdates.push({
              id: l.id,
              updates: {
                name: nextLead.name,
                email: nextLead.email,
                phone: nextLead.phone,
                country: nextLead.country,
                funnel: nextLead.funnel,
                affiliate: nextLead.affiliate,
                stage: nextLead.stage,
                clientPassword: nextLead.clientPassword,
              },
            });
          }
          return nextLead;
        }),
      };
      changedLeadUpdates.forEach(({ id, updates }) => {
        updateLeadApi(id, updates).catch((error) => {
          console.error('[SuperAdminPanel] failed to persist lead account fields', error);
          showNotification('Could not persist lead account update.');
        });
      });
      return nextState;
    });
  };

  useEffect(() => {
    fetchAdminSettings(getAdminToken()).catch((error) => {
      console.error('[SuperAdminPanel] Failed to load saved platform settings:', error);
      showNotification(error?.message || 'Could not load saved platform settings.');
    });
  }, []);

  const dataContextValue = {
    leads: leadAccounts, setLeads: setLeadAccounts,
    users: leadAccounts, setUsers: setLeadAccounts,
    activityLog: panelActivityLog, setActivityLog: setPanelActivityLog,
    auditLog: panelAuditLog, setAuditLog: setPanelAuditLog,
    logAdminAction,
    logActivity,
  };
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('sa_activeTab');
    return saved === 'Settings' ? 'Site Settings' : (saved || 'Dashboard');
  });
  const [staffSubTab, setStaffSubTab] = useState('Staff');
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const saved = sessionStorage.getItem('sa_activeSubTab');
    const allowed = ['Client Management', 'Lead Management', 'Lead Upload', 'Notifications'];
    return allowed.includes(saved) ? (saved === 'Lead Management' ? 'Client Management' : saved) : 'Client Management';
  });
  const tabsScrollRef = useRef(null);
  const scrollTabs = (dir) => {
    const el = tabsScrollRef.current;
    if (el) el.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };
  useEffect(() => { sessionStorage.setItem('sa_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { sessionStorage.setItem('sa_activeSubTab', activeSubTab); }, [activeSubTab]);
  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail.tab);
    window.addEventListener('admin:goto-tab', handler);
    return () => window.removeEventListener('admin:goto-tab', handler);
  }, []);

  const [pendingCounts, setPendingCounts] = useState({ password_resets: 0, signups: 0 });
  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      try {
        const counts = await getAdminPendingCounts();
        if (alive) setPendingCounts(counts);
      } catch (_) {}
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  // Heartbeat - keeps this admin's session marked as "online".
  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    sendHeartbeat(token);
    const id = setInterval(() => sendHeartbeat(token), 30000);
    return () => clearInterval(id);
  }, []);

  const tabs = [
    { name: 'Dashboard', icon: faTachometerAlt },
    { name: 'Client Management', icon: faUsers },
    { name: 'Sessions', icon: faUsers },
    { name: 'Staff', icon: faUsers },
    { name: 'Agent Access', icon: faKey },
    { name: 'Accounting', icon: faFileInvoiceDollar },
    { name: 'Mail', icon: faComments },
    { name: 'Security & System', icon: faKey },
    { name: 'SEO & Search', icon: faGlobe },
    { name: 'Site Settings', icon: faCog },
    { name: 'CRM Settings', icon: faPalette },
    { name: 'Projects', icon: faBriefcase },
    { name: 'Audit Log', icon: faHistory },
    { name: 'Recycle Bin', icon: faTrash },
  ];

  const [uploadOfficeId, setUploadOfficeId] = useState('');
  const [uploadTeamId, setUploadTeamId] = useState('');
  const [uploadTeamLeaderId, setUploadTeamLeaderId] = useState('');
  const [uploadAgentId, setUploadAgentId] = useState('');
  const [manualLead, setManualLead] = useState({ firstName: '', lastName: '', email: '', funnel: '', affiliate: '' });
  const [manualCountry, setManualCountry] = useState(null);
  const [manualPhoneCountryCode, setManualPhoneCountryCode] = useState('');
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');
  const [csvPreview, setCsvPreview] = useState([]);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const [saConfirmDialog, saConfirm] = useConfirmDialog();

  // Edit modals for Office / Team / Agent
  const [editingOffice, setEditingOffice] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);

  const saveOfficeEdit = async ({ officeName, managerName, managerEmail, managerPassword }) => {
    const office = editingOffice;
    const mgr = office._mgr || null;
    setEditingOffice(null);

    // Optimistic update
    setData(prev => ({
      ...prev,
      offices: prev.offices.map(o => o.id === office.id ? { ...o, name: officeName } : o),
      users: mgr
        ? prev.users.map(u => {
            if (u.id !== mgr.id) return u;
            return { ...u, ...(managerName ? { name: managerName } : {}), ...(managerEmail ? { email: managerEmail } : {}) };
          })
        : prev.users,
    }));
    showNotification(`Office "${officeName}" updated.`);

    // Backend: office name
    updateOffice(office.id, { name: officeName }).catch(err => {
      console.error('[SuperAdminPanel] saveOfficeEdit (office) failed', err);
      showNotification('Could not save office name on the server.');
      setData(prev => ({ ...prev, offices: prev.offices.map(o => o.id === office.id ? { id: office.id, name: office.name, managerId: office.managerId } : o) }));
    });

    // Backend: manager name / email / password
    if (mgr && (managerName || managerEmail || managerPassword)) {
      const mgrUpdates = {};
      if (managerName) mgrUpdates.name = managerName;
      if (managerEmail) mgrUpdates.email = managerEmail;
      if (managerPassword) mgrUpdates.password = managerPassword;
      updateStaffApi(mgr.id, mgrUpdates)
        .then(updated => {
          setData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === mgr.id ? { ...u, ...updated, password: updated.password || managerPassword } : u),
          }));
        })
        .catch(err => {
          console.error('[SuperAdminPanel] saveOfficeEdit (manager) failed', err);
          showNotification('Could not save manager details on the server.');
          setData(prev => ({ ...prev, users: prev.users.map(u => u.id === mgr.id ? mgr : u) }));
        });
    }
  };

  const saveTeamEdit = async ({ leaderName, leaderEmail, leaderPassword, ...teamUpdates }) => {
    const team = editingTeam;
    const leader = team._ldr || null;
    setEditingTeam(null);

    setData(prev => ({
      ...prev,
      teams: prev.teams.map(t => t.id === team.id ? { ...t, ...teamUpdates } : t),
      users: leader
        ? prev.users.map(u => {
            if (u.id !== leader.id) return u;
            return { ...u, ...(leaderName ? { name: leaderName } : {}), ...(leaderEmail ? { email: leaderEmail } : {}) };
          })
        : prev.users,
    }));
    showNotification(`Team "${teamUpdates.name}" updated.`);

    updateTeam(team.id, teamUpdates).catch(err => {
      console.error('[SuperAdminPanel] saveTeamEdit failed', err);
      showNotification('Could not save team changes on the server.');
      setData(prev => ({ ...prev, teams: prev.teams.map(t => t.id === team.id ? { id: team.id, name: team.name, officeId: team.officeId, leaderId: team.leaderId, maxSize: team.maxSize } : t) }));
    });

    if (leader && (leaderName || leaderEmail || leaderPassword)) {
      const ldrUpdates = {};
      if (leaderName) ldrUpdates.name = leaderName;
      if (leaderEmail) ldrUpdates.email = leaderEmail;
      if (leaderPassword) ldrUpdates.password = leaderPassword;
      updateStaffApi(leader.id, ldrUpdates)
        .then(updated => {
          setData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === leader.id ? { ...u, ...updated, password: updated.password || leaderPassword } : u),
          }));
        })
        .catch(err => {
          console.error('[SuperAdminPanel] saveTeamEdit (leader) failed', err);
          showNotification('Could not save leader details on the server.');
          setData(prev => ({ ...prev, users: prev.users.map(u => u.id === leader.id ? leader : u) }));
        });
    }
  };

  const saveAgentEdit = async (updates) => {
    const agent = editingAgent;
    setEditingAgent(null);
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === agent.id ? { ...u, ...updates } : u),
    }));
    showNotification(`Agent "${updates.name}" updated.`);
    updateStaffApi(agent.id, updates).catch(err => {
      console.error('[SuperAdminPanel] saveAgentEdit failed', err);
      showNotification('Could not save agent changes on the server.');
      setData(prev => ({ ...prev, users: prev.users.map(u => u.id === agent.id ? agent : u) }));
    });
  };

  const softDeleteOffice = async (office) => {
    const ok = await saConfirm({
      title: 'Move office to the recycle bin?',
      message: `Move "${office.name}" and its teams and staff to the recycle bin? Their leads will be unassigned and can be restored with the office.`,
      confirmLabel: 'Move to bin',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      const result = await deleteOffice(office.id);
      const staffIds = new Set(result.staff_ids || []);
      const teamIds = new Set(result.team_ids || []);
      const leadIds = new Set(result.lead_ids || []);
      setData(prev => ({
        ...prev,
        offices: prev.offices.filter(item => item.id !== office.id),
        teams: prev.teams.filter(item => !teamIds.has(item.id)),
        users: prev.users.filter(item => !staffIds.has(item.id)),
        leads: prev.leads.map(lead => leadIds.has(lead.id) ? {
          ...lead,
          assignedToAgent: null,
          assignedToTeam: null,
          assignedToTeamLeader: null,
          assignedToOffice: null,
          assignedAgentName: null,
          assignedTeamName: null,
          assignedOfficeName: null,
        } : lead),
        recycleBin: [...(prev.recycleBin || []).filter(item => item.id !== office.id), {
          id: office.id,
          type: 'office',
          item: office,
          deletedAt: result.deleted_at,
        }],
      }));
      showNotification(`Office "${office.name}" moved to the recycle bin.`);
    } catch (err) {
      console.error('[SuperAdminPanel] softDeleteOffice failed', err);
      showNotification(err.message || 'Could not delete office on the server.');
    }
  };

  const softDeleteTeam = async (team) => {
    const ok = await saConfirm({
      title: 'Move team to the recycle bin?',
      message: `Move "${team.name}" and its staff to the recycle bin? Their leads will be unassigned and can be restored with the team.`,
      confirmLabel: 'Move to bin',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      const result = await deleteTeam(team.id);
      const staffIds = new Set(result.staff_ids || []);
      const leadIds = new Set(result.lead_ids || []);
      setData(prev => ({
        ...prev,
        teams: prev.teams.filter(item => item.id !== team.id),
        users: prev.users.filter(item => !staffIds.has(item.id)),
        leads: prev.leads.map(lead => leadIds.has(lead.id) ? {
          ...lead,
          assignedToAgent: null,
          assignedToTeam: null,
          assignedToTeamLeader: null,
          assignedToOffice: null,
          assignedAgentName: null,
          assignedTeamName: null,
          assignedOfficeName: null,
        } : lead),
        recycleBin: [...(prev.recycleBin || []).filter(item => item.id !== team.id), {
          id: team.id,
          type: 'team',
          item: team,
          deletedAt: result.deleted_at,
        }],
      }));
      showNotification(`Team "${team.name}" moved to the recycle bin.`);
    } catch (err) {
      console.error('[SuperAdminPanel] softDeleteTeam failed', err);
      showNotification(err.message || 'Could not delete team on the server.');
    }
  };

  const softDeleteAgent = async (agent) => {
    const ok = await saConfirm({
      title: 'Move staff member to the recycle bin?',
      message: `Move "${agent.name}" to the recycle bin? Their leads will be unassigned and can be restored with this account.`,
      confirmLabel: 'Move to bin',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      const result = await deleteStaffApi(agent.id);
      const leadIds = new Set(result.lead_ids || []);
      setData(prev => ({
        ...prev,
        users: prev.users.filter(user => user.id !== agent.id),
        leads: prev.leads.map(lead => leadIds.has(lead.id) ? {
          ...lead,
          assignedToAgent: null,
          assignedToTeam: null,
          assignedToTeamLeader: null,
          assignedToOffice: null,
          assignedAgentName: null,
          assignedTeamName: null,
          assignedOfficeName: null,
        } : lead),
        recycleBin: [...(prev.recycleBin || []).filter(item => item.id !== agent.id), {
          id: agent.id,
          type: 'user',
          item: agent,
          deletedAt: result.deleted_at,
        }],
      }));
      showNotification(`${agent.name} moved to the recycle bin.`);
    } catch (err) {
      console.error('[SuperAdminPanel] softDeleteAgent failed', err);
      showNotification(err.message || 'Could not delete staff on the server.');
    }
  };

  const copyToClipboard = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      showNotification('Login link copied to clipboard');
    } catch {
      showNotification('Copy failed, please copy manually');
    }
  };

  // Staff tab - computed before JSX return so they're available in the ternary
  const staffRows = data.users.filter(u => {
    const isStaff = u.role === ROLE.OFFICE_MANAGER || u.role === ROLE.TEAM_LEADER || u.role === ROLE.AGENT;
    if (!isStaff) return false;
    if (u.status === 'Disabled') return false;
    if (staffRoleFilter && u.role !== staffRoleFilter) return false;
    if (!matchesStaffStructureFilter(u, staffStructureFilter)) return false;
    if (!staffSearch.trim()) return true;
    const q = staffSearch.toLowerCase();
    const office = data.offices.find(o => o.id === u.officeId);
    const team = data.teams.find(t => t.id === u.teamId);
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q) ||
      (office && office.name.toLowerCase().includes(q)) ||
      (team && team.name.toLowerCase().includes(q))
    );
  });
  const staffRoleLabel = { [ROLE.OFFICE_MANAGER]: 'Office Manager', [ROLE.TEAM_LEADER]: 'Team Leader', [ROLE.AGENT]: 'Agent' };
  const staffRoleBadgeStyle = {
    [ROLE.OFFICE_MANAGER]: { background: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)', color: 'var(--crm-accent)', border: '1px solid color-mix(in srgb, var(--crm-accent) 25%, transparent)' },
    [ROLE.TEAM_LEADER]:    { background: 'rgba(69,210,160,0.15)', color: '#45d2a0', border: '1px solid #45d2a040' },
    [ROLE.AGENT]:          { background: 'rgba(52,152,219,0.15)', color: '#3498db', border: '1px solid #3498db40' },
  };
  const renderLeadWorkspaceTabs = () => (
    <div className="crm-tab-row">
      <button className={"crm-tab-btn " + ((activeTab === 'Client Management' || activeTab === 'Leads') && (activeSubTab === 'Client Management' || activeSubTab === 'Lead Management') ? 'crm-active' : '')} onClick={() => { setActiveTab('Client Management'); setActiveSubTab('Client Management'); }}>
        Client Management
      </button>
      <button className={"crm-tab-btn " + ((activeTab === 'Client Management' || activeTab === 'Leads') && activeSubTab === 'Lead Upload' ? 'crm-active' : '')} onClick={() => { setActiveTab('Client Management'); setActiveSubTab('Lead Upload'); }}>
        Client Import
      </button>
      <button className={"crm-tab-btn " + ((activeTab === 'Client Management' || activeTab === 'Leads') && activeSubTab === 'Notifications' ? 'crm-active' : '')} onClick={() => { setActiveTab('Client Management'); setActiveSubTab('Notifications'); }}>
        Notifications
      </button>
      <button className={"crm-tab-btn " + (activeTab === 'Enquiries' ? 'crm-active' : '')} onClick={() => setActiveTab('Enquiries')}>
        Enquiries
      </button>
      <button className={"crm-tab-btn " + (activeTab === 'Content' ? 'crm-active' : '')} onClick={() => setActiveTab('Content')}>
        Content
      </button>
      <button className={"crm-tab-btn " + (activeTab === 'Chat' ? 'crm-active' : '')} onClick={() => setActiveTab('Chat')}>
        Chat
      </button>
    </div>
  );

  return (
    <NotificationContext.Provider value={showPanelNotification}>
      <DataContext.Provider value={dataContextValue}>
        <div className="crm-super-admin-container">
          {saConfirmDialog}
          {editingOffice && (() => {
            const _mgr = editingOffice._mgr || null;
            return <EditOfficeModal office={editingOffice} officeManager={_mgr} isManagerBlocked={_mgr ? !!staffBlockedStatus[_mgr.id] : false} onBlock={_mgr ? () => blockUnblockStaff(_mgr.id, ROLE.OFFICE_MANAGER) : undefined} onClose={() => setEditingOffice(null)} onSave={saveOfficeEdit} />;
          })()}
          {editingTeam && (() => {
            const _ldr = editingTeam._ldr || null;
            return <EditTeamModal team={editingTeam} offices={data.offices} teamLeader={_ldr} isLeaderBlocked={_ldr ? !!staffBlockedStatus[_ldr.id] : false} onBlock={_ldr ? () => blockUnblockStaff(_ldr.id, ROLE.TEAM_LEADER) : undefined} onClose={() => setEditingTeam(null)} onSave={saveTeamEdit} />;
          })()}
          {editingAgent && <EditAgentModal agent={editingAgent} teams={data.teams} isBlocked={!!staffBlockedStatus[editingAgent.id]} onBlock={() => blockUnblockStaff(editingAgent.id, ROLE.AGENT)} onClose={() => setEditingAgent(null)} onSave={saveAgentEdit} />}
          <div className="crm-super-admin-header crm-role-panel-header">
            <div className="crm-super-admin-header-top">
              <h3 className="crm-super-admin-title">⚙ Super Admin Panel</h3>
              <HealthIndicator token={getAdminToken()} />
            </div>
            <div
              ref={tabsScrollRef}
              className="crm-super-admin-tabs"
            >
              {tabs.map(tab => {
                const badge = 0;
                return (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab.name)}
                    className={`crm-super-admin-tab-btn ${activeTab === tab.name ? 'crm-active' : ''}`}
                  >
                    <FontAwesomeIcon icon={tab.icon} />
                    {tab.name}
                    {badge > 0 && (
                      <span className="crm-tab-pending-badge" aria-label={`${badge} pending`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="crm-super-admin-content">
            {activeTab === 'Sessions' ? (
              <div className="crm-super-admin-card">
                <h2 style={{ marginBottom: 6 }}>🟢 Live Sessions</h2>
                <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13, marginBottom: 20 }}>
                  Real-time view of who is online across all offices, teams, and the client portal. Track individuals to get notified when they come online.
                </p>
                <Sessions token={getAdminToken()} />
              </div>
            ) : (activeTab === 'Client Management' || activeTab === 'Leads') ? (
              <div className="leads-content">
                {renderLeadWorkspaceTabs()}
                {activeSubTab === 'Client Management' || activeSubTab === 'Lead Management' ? (
                  <div>
                    <div className="crm-super-admin-card">
                      <h2 style={{ marginBottom: 6 }}>👥 Client Management</h2>
                      <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13, marginBottom: 20 }}>
                        Clients and leads are the central account source visible to agents, teams, and offices - filtered by their scope. Here you see every record system-wide.
                      </p>
                      <AllLeadsTable data={data} currentUser={currentUser} setData={setData} setLeadAssignment={setLeadAssignment} showNotification={showNotification} onOpenProfile={openLeadProfile} />
                    </div>
                  </div>
                ) : activeSubTab === 'Lead Upload' ? (
                  <div style={{ padding: 24 }}>
                    <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                          <h2 style={{ margin: '0 0 4px 0' }}>[upload] Lead Import</h2>
                          <p style={{ margin: 0, color: 'var(--crm-text-secondary)', fontSize: 13 }}>Import leads via CSV or add them one at a time. Optionally assign an office, team, team leader, or agent on import.</p>
                        </div>
                        <a href="data:text/csv;charset=utf-8,firstName,lastName,email,phone,country,funnel,affiliate,assigned_team_leader_id" download="leads-template.csv" style={{ padding: '8px 16px', background: 'var(--crm-border)', color: 'var(--crm-text-primary)', borderRadius: 8, fontSize: 13, textDecoration: 'none', border: '1px solid #3C4754', whiteSpace: 'nowrap' }}>⬇ Template</a>
                      </div>
                      <div className="crm-super-admin-form-row" style={{ marginBottom: 0 }}>
                        <div className="crm-super-admin-form-group">
                          <label>Assign to Office</label>
                          <select className="crm-super-admin-select" value={uploadOfficeId} onChange={e => { setUploadOfficeId(e.target.value); setUploadTeamId(''); setUploadAgentId(''); }}>
                            <option value="">- Any Office -</option>
                            {data.offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                        <div className="crm-super-admin-form-group">
                          <label>Assign to Team</label>
                          <select className="crm-super-admin-select" value={uploadTeamId} onChange={e => { setUploadTeamId(e.target.value); setUploadAgentId(''); }}>
                            <option value="">- Any Team -</option>
                            {data.teams.filter(t => !uploadOfficeId || t.officeId === uploadOfficeId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="crm-super-admin-form-group">
                          <label>Assign to Team Leader</label>
                          <select className="crm-super-admin-select" value={uploadTeamLeaderId} onChange={e => setUploadTeamLeaderId(e.target.value)}>
                            <option value="">- No direct team leader -</option>
                            {data.users.filter(u => u.role === ROLE.TEAM_LEADER).map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name}{u.teamId ? ` (${getTeamName(u.teamId, data.teams)})` : ' (standalone)'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="crm-super-admin-form-group">
                          <label>Assign to Agent</label>
                          <select className="crm-super-admin-select" value={uploadAgentId} onChange={e => setUploadAgentId(e.target.value)}>
                            <option value="">- Any Agent -</option>
                            {data.users.filter(u => u.role === ROLE.AGENT && (!uploadTeamId || u.teamId === uploadTeamId)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div className="crm-super-admin-card">
                        <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>CSV File Import</h3>
                        <div
                          onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                          onDragLeave={() => setUploadDragOver(false)}
                          onDrop={e => {
                            e.preventDefault(); setUploadDragOver(false);
                            const file = e.dataTransfer.files[0];
                            if (file && file.name.endsWith('.csv')) {
                              const reader = new FileReader();
                              reader.onload = ev => {
                                const rows = ev.target.result.split('\n').filter(l => l.trim());
                                const headers = rows[0].split(',').map(h => h.trim());
                                setCsvPreview(rows.slice(1).map(line => { const v = line.split(','); return headers.reduce((o,h,i) => { o[h] = (v[i]||'').trim(); return o; }, {}); }));
                                setImportResults(null);
                              };
                              reader.readAsText(file);
                            } else { showNotification('Please drop a valid .csv file'); }
                          }}
                          onClick={() => document.getElementById('csvUploadInput').click()}
                          style={{ border: '2px dashed ' + (uploadDragOver ? 'var(--crm-accent)' : 'var(--crm-border)'), borderRadius: 10, padding: '28px 20px', textAlign: 'center', marginBottom: 16, cursor: 'pointer', transition: 'all 0.2s', background: uploadDragOver ? 'color-mix(in srgb, var(--crm-accent) 4%, transparent)' : 'transparent' }}
                        >
                          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                          <div style={{ color: 'var(--crm-text-primary)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drag &amp; drop a CSV file</div>
                          <div style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>or click to browse &nbsp;&middot;&nbsp; columns: firstName, lastName, email, phone, country, funnel, affiliate</div>
                          <input id="csvUploadInput" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => {
                            const file = e.target.files[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => {
                              const rows = ev.target.result.split('\n').filter(l => l.trim());
                              const headers = rows[0].split(',').map(h => h.trim());
                              setCsvPreview(rows.slice(1).map(line => { const v = line.split(','); return headers.reduce((o,h,i) => { o[h] = (v[i]||'').trim(); return o; }, {}); }));
                              setImportResults(null);
                            };
                            reader.readAsText(file); e.target.value = '';
                          }} />
                        </div>
                        {csvPreview.length > 0 && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <span style={{ color: 'var(--crm-text-secondary)', fontSize: 13 }}>{csvPreview.length} rows detected</span>
                              <button onClick={() => { setCsvPreview([]); setImportResults(null); }} style={{ padding: '3px 10px', background: 'transparent', border: '1px solid #3C4754', borderRadius: 6, color: 'var(--crm-text-secondary)', fontSize: 12, cursor: 'pointer' }}>✕ Clear</button>
                            </div>
                            <div className="crm-super-admin-table-wrapper" style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
                              <table className="crm-super-admin-table">
                                <thead><tr>{csvPreview[0] && Object.keys(csvPreview[0]).map(h => <th key={h}>{h}</th>)}</tr></thead>
                                <tbody>{csvPreview.slice(0,10).map((row,i) => <tr key={i}>{Object.values(row).map((v,j) => <td key={j}>{v||'-'}</td>)}</tr>)}</tbody>
                              </table>
                            </div>
                            {csvPreview.length > 10 && <p style={{ color: 'var(--crm-text-secondary)', fontSize: 11, marginBottom: 10, margin: '0 0 10px 0' }}>Showing first 10 of {csvPreview.length} rows</p>}
                            <button className="crm-super-admin-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={async () => {
                              let successCount = 0;
                              let failCount = 0;
                              for (const row of csvPreview) {
                                const result = await createLead({
                                  firstName: row.firstName || row.first_name || '',
                                  lastName: row.lastName || row.last_name || '',
                                  email: row.email || '',
                                  phone: row.phone || '',
                                  country: row.country || '',
                                  funnel: row.funnel || '',
                                  affiliate: row.affiliate || '',
                                  assignedToOffice: uploadOfficeId || null,
                                  assignedToTeam: uploadTeamId || null,
                                  assignedToTeamLeader: uploadTeamLeaderId || null,
                                  assignedToAgent: uploadAgentId || null,
                                });
                                if (result) successCount++; else failCount++;
                              }
                              setImportResults({ count: successCount, failed: failCount });
                              setCsvPreview([]);
                              showNotification(`${successCount} leads imported${failCount ? `, ${failCount} failed` : ''}`);
                            }}>✓ Import {csvPreview.length} Leads</button>
                          </>
                        )}
                        {importResults && (
                          <div style={{ background: 'rgba(69,210,160,0.08)', border: '1px solid #45d2a030', borderRadius: 8, padding: 14, marginTop: 12, textAlign: 'center' }}>
                            <div style={{ color: '#45d2a0', fontWeight: 700 }}>OK {importResults.count} leads imported</div>
                            <div style={{ color: 'var(--crm-text-secondary)', fontSize: 12, marginTop: 4 }}>They now appear in Client Management</div>
                          </div>
                        )}
                      </div>
                      <div className="crm-super-admin-card">
                        <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>Manual Entry</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>First Name *</div><input className="crm-super-admin-input" placeholder="First name..." value={manualLead.firstName} onChange={e => setManualLead(p => ({ ...p, firstName: e.target.value }))} autoComplete="off" /></div>
                            <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Last Name</div><input className="crm-super-admin-input" placeholder="Last name..." value={manualLead.lastName} onChange={e => setManualLead(p => ({ ...p, lastName: e.target.value }))} autoComplete="off" /></div>
                          </div>
                          <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Email *</div><input className="crm-super-admin-input" placeholder="email@example.com" type="email" value={manualLead.email} onChange={e => setManualLead(p => ({ ...p, email: e.target.value }))} autoComplete="off" /></div>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Country</div>
                            <CountrySelect
                              value={manualCountry?.code || ''}
                              onChange={(c) => {
                                setManualCountry(c);
                                if (c && !manualPhoneCountryCode) setManualPhoneCountryCode(c.code);
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Phone</div>
                            <PhoneInput
                              countryCode={manualPhoneCountryCode}
                              onCountryCodeChange={(code) => {
                                setManualPhoneCountryCode(code);
                                if (!manualCountry) {
                                  const found = COUNTRY_LIST.find(x => x.code === code);
                                  if (found) setManualCountry(found);
                                }
                              }}
                              number={manualPhoneNumber}
                              onNumberChange={setManualPhoneNumber}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Funnel</div><input className="crm-super-admin-input" placeholder="Funnel name..." value={manualLead.funnel} onChange={e => setManualLead(p => ({ ...p, funnel: e.target.value }))} autoComplete="off" /></div>
                            <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Affiliate</div><input className="crm-super-admin-input" placeholder="Affiliate code..." value={manualLead.affiliate} onChange={e => setManualLead(p => ({ ...p, affiliate: e.target.value }))} autoComplete="off" /></div>
                          </div>
                          <button className="crm-super-admin-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={!manualLead.firstName || !manualLead.email} onClick={async () => {
                            const emailVal = (manualLead.email || '').trim();
                            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailVal)) {
                              alert('Please enter a valid email address.');
                              return;
                            }
                            const fullPhone = buildStoredPhone(manualPhoneCountryCode, manualPhoneNumber);
                            const result = await createLead({
                              ...manualLead,
                              phone: fullPhone,
                              country: manualCountry?.name || '',
                              countryCode: manualCountry?.code || '',
                              assignedToOffice: uploadOfficeId || null,
                              assignedToTeam: uploadTeamId || null,
                              assignedToTeamLeader: uploadTeamLeaderId || null,
                              assignedToAgent: uploadAgentId || null,
                            });
                            if (result) {
                              setManualLead({ firstName: '', lastName: '', email: '', funnel: '', affiliate: '' });
                              setManualCountry(null);
                              setManualPhoneCountryCode('');
                              setManualPhoneNumber('');
                            }
                          }}>✓ Add Lead</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeSubTab === 'Notifications' ? (
                  <Notifications data={data} setData={setData} currentUserId={data.users.find(u => u.role === ROLE.SUPER_ADMIN)?.id} />
                ) : null}
              </div>
            ) : activeTab === 'Enquiries' ? (
              <div className="leads-content">
                {renderLeadWorkspaceTabs()}
                <div className="crm-super-admin-card" style={{ minWidth: 0, maxWidth: '100%' }}>
                  <h2 style={{ marginBottom: 6 }}>📬 Customer Enquiries</h2>
                  <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13, marginBottom: 20 }}>
                    Inbound customer enquiries submitted through public website contact forms, booking modals, and CRM intake.
                  </p>
                  <SiteCrmWorkspace
                    defaultTab="enquiries"
                    standalone
                    showNotification={showNotification}
                    onOpenLeadProfile={openLeadProfile}
                    leads={data.leads}
                  />
                </div>
              </div>
            ) : activeTab === 'Content' ? (
              <div className="leads-content">
                {renderLeadWorkspaceTabs()}
                <SiteCrmWorkspace
                  defaultTab="content"
                  standalone
                  showNotification={showNotification}
                />
              </div>
            ) : activeTab === 'Chat' ? (
              <div className="leads-content">
                {renderLeadWorkspaceTabs()}
                <SiteCrmWorkspace
                  defaultTab="chat"
                  standalone
                  showNotification={showNotification}
                />
              </div>
            ) : activeTab === 'Accounting' ? (
              <AccountingWorkspace showNotification={showPanelNotification} />
            ) : activeTab === 'Mail' ? (
              <SiteSettingsTab key="mail" showNotification={showNotification} initialSubTab="hostinger-mail" standaloneSection />
            ) : activeTab === 'Security & System' ? (
              <SiteSettingsTab key="security" showNotification={showNotification} initialSubTab="security" standaloneSection />
            ) : activeTab === 'SEO & Search' ? (
              <SiteSettingsTab key="seo" showNotification={showNotification} initialSubTab="seo" standaloneSection />
            ) : activeTab === 'Staff' ? (
              <div style={{ padding: 24 }}>
                <div className="crm-tab-row" style={{ marginBottom: 18 }}>
                  <button className={"crm-tab-btn " + (staffSubTab === 'Staff' ? 'crm-active' : '')} onClick={() => setStaffSubTab('Staff')}>
                    Staff
                  </button>
                  <button className={"crm-tab-btn " + (staffSubTab === 'Offices' ? 'crm-active' : '')} onClick={() => setStaffSubTab('Offices')}>
                    Offices
                  </button>
                  <button className={"crm-tab-btn " + (staffSubTab === 'Teams' ? 'crm-active' : '')} onClick={() => setStaffSubTab('Teams')}>
                    Teams
                  </button>
                  <button className={"crm-tab-btn " + (staffSubTab === 'Agents' ? 'crm-active' : '')} onClick={() => setStaffSubTab('Agents')}>
                    Agents
                  </button>
                </div>

                {staffSubTab === 'Offices' ? (
                  <div>
                    <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h2 style={{ margin: '0 0 4px 0' }}>[office] Offices</h2>
                          <p style={{ margin: 0, color: 'var(--crm-text-secondary)', fontSize: 13 }}>{data.offices.length} offices &mdash; manage offices and their managers</p>
                        </div>
                        <button className="crm-super-admin-btn" onClick={() => setExpandedOffices(prev => { const s = new Set(prev); s.has('__create') ? s.delete('__create') : s.add('__create'); return s; })}>
                          {expandedOffices.has('__create') ? '✕ Cancel' : '+ New Office'}
                        </button>
                      </div>
                    </div>
                    {expandedOffices.has('__create') && (
                      <div className="crm-super-admin-card" style={{ marginBottom: 20, background: 'rgba(243,186,47,0.04)', borderColor: 'color-mix(in srgb, var(--crm-accent) 19%, transparent)' }}>
                        <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 600 }}>New Office &amp; Manager</h3>
                        <div className="crm-super-admin-form-row">
                          <div className="crm-super-admin-form-group">
                            <label>Office Name</label>
                            <input className="crm-super-admin-input" autoComplete="off" placeholder="Office name..." value={officeName} onChange={e => setOfficeName(e.target.value)} />
                          </div>
                          <div className="crm-super-admin-form-group">
                            <label>Manager Name</label>
                            <input className="crm-super-admin-input" autoComplete="off" placeholder="Manager name..." value={managerName} onChange={e => setManagerName(e.target.value)} />
                          </div>
                          <div className="crm-super-admin-form-group">
                            <label>Password</label>
                            <input className="crm-super-admin-input" autoComplete="new-password" placeholder="Password..." type="password" value={managerPassword} onChange={e => setManagerPassword(e.target.value)} />
                          </div>
                          <div className="crm-super-admin-form-group" style={{ justifyContent: 'flex-end' }}>
                            <label style={{ visibility: 'hidden' }}>_</label>
                            <button className="crm-super-admin-btn" disabled={!officeName || !managerName || !managerPassword} onClick={async () => {
                              const newMgr = await createOfficeWithManager(officeName, managerName, managerPassword);
                              if (newMgr) setNewManager(newMgr);
                              setOfficeName(''); setManagerName(''); setManagerPassword('');
                              setExpandedOffices(prev => { const s = new Set(prev); s.delete('__create'); return s; });
                            }}>✓ Create</button>
                          </div>
                        </div>
                        {newManager && (
                          <div className="crm-credentials-output-container" style={{ marginTop: 14 }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: 13 }}>Created: {newManager.name}</h4>
                            <div className="crm-credential-item"><span>Login Link</span><code>{newManager.loginLink}</code><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newManager.loginLink)}>[list] Copy</button></div>
                            <div className="crm-credential-item"><span>Password</span><code>{newManager.password}</code><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newManager.password)}>[list] Copy</button></div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="crm-super-admin-card">
                      <div style={{ marginBottom: 12 }}>
                        <input className="crm-super-admin-input" style={{ width: '100%', maxWidth: 340 }} placeholder="[search]  Search offices or managers..." value={officeSearch} onChange={e => setOfficeSearch(e.target.value)} autoComplete="off" />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
                        Click any office / manager row to open their summary modal and access their full profile.
                      </div>
                      <div className="crm-super-admin-table-wrapper">
                        <table className="crm-super-admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Office</th>
                              <th>Manager</th>
                              <th style={{ textAlign: 'center' }}>Teams</th>
                              <th style={{ textAlign: 'center' }}>Agents</th>
                              <th style={{ textAlign: 'center' }}>Leads</th>
                              <th style={{ textAlign: 'center' }}>Deposits</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.offices.filter(office => {
                              if (!officeSearch.trim()) return true;
                              const q = officeSearch.toLowerCase();
                              const manager = data.users.find(u => u.role === ROLE.OFFICE_MANAGER && u.officeId === office.id);
                              return office.name.toLowerCase().includes(q) || (manager && manager.name.toLowerCase().includes(q));
                            }).map(office => {
                              const officeManager = data.users.find(u => u.role === ROLE.OFFICE_MANAGER && u.officeId === office.id);
                              const officeTeams = data.teams.filter(t => t.officeId === office.id);
                              const officeLeads = data.leads.filter(l => l.assignedToOffice === office.id);
                              const officeAgents = data.users.filter(u => u.role === ROLE.AGENT && u.officeId === office.id);
                              const officeDeposits = officeLeads.filter(l => l.stage === 'Deposit').length;
                              return (
                                <tr
                                  key={office.id}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() =>
                                    openStaffProfile(
                                      officeManager || {
                                        id: `office_${office.id}`,
                                        isOfficeOnly: true,
                                        officeId: office.id,
                                        role: ROLE.OFFICE_MANAGER,
                                        name: `${office.name} (Unassigned Manager)`,
                                        status: 'Active',
                                      }
                                    )
                                  }
                                  title={`Open summary for ${officeManager ? officeManager.name : office.name}`}
                                >
                                  <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{office.id ? office.id.slice(0, 6) : '-'}</span>
                                      {office.id && <button title={office.id} onClick={() => navigator.clipboard.writeText(office.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                                    </div>
                                  </td>
                                  <td style={{ fontWeight: 600 }}>{office.name}</td>
                                  <td>
                                    {officeManager ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className={'status-indicator ' + (officeManager.isLoggedIn ? 'crm-online' : 'crm-offline')}></span>
                                        <span style={{ fontWeight: 600, color: 'var(--crm-text-primary)' }}>{officeManager.name}</span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                                        <select className="crm-super-admin-select" style={{ fontSize: 12, padding: '3px 6px', flex: 1 }} value={officeId} onChange={e => setOfficeId(e.target.value)}>
                                          <option value="">Assign manager...</option>
                                          {data.users.filter(u => u.role === ROLE.OFFICE_MANAGER && !u.officeId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <button className="crm-super-admin-btn crm-super-admin-btn-small" disabled={!officeId} onClick={() => { assignOfficeManager(office.id, officeId); showNotification('Manager assigned!'); setOfficeId(''); }}>✓</button>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>{officeTeams.length}</td>
                                  <td style={{ textAlign: 'center' }}>{officeAgents.length}</td>
                                  <td style={{ textAlign: 'center' }}>{officeLeads.length}</td>
                                  <td style={{ textAlign: 'center', color: '#45d2a0', fontWeight: 600 }}>{officeDeposits}</td>
                                  <td>
                                    {officeManager ? (
                                      <span className={'crm-badge ' + (staffBlockedStatus[officeManager.id] ? 'crm-badge-danger' : 'crm-badge-success')}>{staffBlockedStatus[officeManager.id] ? 'Blocked' : 'Active'}</span>
                                    ) : <span className="crm-badge crm-badge-warning">No Manager</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : staffSubTab === 'Teams' ? (
                  <div style={{ padding: 24 }}>
                    <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h2 style={{ margin: '0 0 4px 0' }}>[users] Teams</h2>
                          <p style={{ margin: 0, color: 'var(--crm-text-secondary)', fontSize: 13 }}>{data.teams.length} teams &mdash; manage teams and their leaders</p>
                        </div>
                        <button className="crm-super-admin-btn" onClick={() => setExpandedTeams(prev => { const s = new Set(prev); s.has('__create') ? s.delete('__create') : s.add('__create'); return s; })}>
                          {expandedTeams.has('__create') ? '✕ Cancel' : '+ New Team'}
                        </button>
                      </div>
                    </div>
                    {expandedTeams.has('__create') && (
                      <div className="crm-super-admin-card" style={{ marginBottom: 20, background: 'rgba(69,210,160,0.04)', borderColor: '#45d2a030' }}>
                        <h3 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 600 }}>New Team or Standalone Team Leader</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--crm-text-secondary)', fontSize: 12 }}>
                          <input type="checkbox" checked={tlStandaloneLeader} onChange={e => setTlStandaloneLeader(e.target.checked)} />
                          Create a team leader without creating or assigning a team
                        </label>
                        <div className="crm-super-admin-form-row">
                          <div className="crm-super-admin-form-group">
                            <label>Office</label>
                            <select className="crm-super-admin-select" value={tlOfficeId} onChange={e => setTlOfficeId(e.target.value)}>
                              <option value="">No office (independent)</option>
                              {data.offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </div>
                          {!tlStandaloneLeader && <>
                            <div className="crm-super-admin-form-group">
                              <label>Team Name</label>
                              <input className="crm-super-admin-input" autoComplete="off" placeholder="Team name..." value={tlTeamName} onChange={e => setTlTeamName(e.target.value)} />
                            </div>
                            <div className="crm-super-admin-form-group">
                              <label>Max Size</label>
                              <input className="crm-super-admin-input" autoComplete="off" placeholder="e.g. 10" type="number" value={tlTeamSize} onChange={e => setTlTeamSize(e.target.value)} />
                            </div>
                          </>}
                          <div className="crm-super-admin-form-group">
                            <label>Leader Name</label>
                            <input className="crm-super-admin-input" autoComplete="off" placeholder="Leader name..." value={tlLeaderName} onChange={e => setTlLeaderName(e.target.value)} />
                          </div>
                          <div className="crm-super-admin-form-group">
                            <label>Password</label>
                            <input className="crm-super-admin-input" autoComplete="new-password" placeholder="Password..." type="password" value={tlLeaderPassword} onChange={e => setTlLeaderPassword(e.target.value)} />
                          </div>
                          <div className="crm-super-admin-form-group" style={{ justifyContent: 'flex-end' }}>
                            <label style={{ visibility: 'hidden' }}>_</label>
                            <button className="crm-super-admin-btn" disabled={!tlLeaderName || !tlLeaderPassword || (!tlStandaloneLeader && (!tlTeamName || !tlTeamSize))} onClick={async () => {
                              const newTl = tlStandaloneLeader
                                ? await createStandaloneTeamLeader(tlOfficeId || null, tlLeaderName, tlLeaderPassword)
                                : await createTeamLeader(tlOfficeId || null, tlTeamName, tlLeaderName, tlLeaderPassword, tlTeamSize);
                              if (newTl) setNewTeamLeader(newTl);
                              setTlOfficeId(''); setTlTeamName(''); setTlLeaderName(''); setTlLeaderPassword(''); setTlTeamSize(''); setTlStandaloneLeader(false);
                              setExpandedTeams(prev => { const s = new Set(prev); s.delete('__create'); return s; });
                            }}>✓ Create</button>
                          </div>
                        </div>
                        {newTeamLeader && (
                          <div className="crm-credentials-output-container" style={{ marginTop: 14 }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: 13 }}>Created: {newTeamLeader.name}</h4>
                            <div className="crm-credential-item"><span>Login Link</span><code>{newTeamLeader.loginLink}</code><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newTeamLeader.loginLink)}>[list] Copy</button></div>
                            <div className="crm-credential-item"><span>Password</span><code>{newTeamLeader.password}</code><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newTeamLeader.password)}>[list] Copy</button></div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="crm-super-admin-card">
                      <div style={{ marginBottom: 12 }}>
                        <input className="crm-super-admin-input" style={{ width: '100%', maxWidth: 340 }} placeholder="[search]  Search teams, offices, or leaders..." value={teamSearch} onChange={e => setTeamSearch(e.target.value)} autoComplete="off" />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
                        Click any team / team leader row to open their summary modal and access their full profile.
                      </div>
                      <div className="crm-super-admin-table-wrapper">
                        <table className="crm-super-admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Team</th>
                              <th>Office</th>
                              <th>Leader</th>
                              <th style={{ textAlign: 'center' }}>Agents</th>
                              <th style={{ textAlign: 'center' }}>Leads</th>
                              <th style={{ textAlign: 'center' }}>Deposits</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.teams.filter(team => {
                              if (!teamSearch.trim()) return true;
                              const q = teamSearch.toLowerCase();
                              const leader = data.users.find(u => u.role === ROLE.TEAM_LEADER && u.teamId === team.id);
                              const office = data.offices.find(o => o.id === team.officeId);
                              return (
                                team.name.toLowerCase().includes(q) ||
                                (leader && leader.name.toLowerCase().includes(q)) ||
                                (office && office.name.toLowerCase().includes(q))
                              );
                            }).map(team => {
                              const teamLeader = data.users.find(u => u.role === ROLE.TEAM_LEADER && u.teamId === team.id);
                              const teamAgents = data.users.filter(u => u.role === ROLE.AGENT && u.teamId === team.id);
                              const teamLeads = data.leads.filter(l => l.assignedToTeam === team.id);
                              const teamDeposits = teamLeads.filter(l => l.stage === 'Deposit').length;
                              const office = data.offices.find(o => o.id === team.officeId);
                              return (
                                <tr
                                  key={team.id}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() =>
                                    openStaffProfile(
                                      teamLeader || {
                                        id: `team_${team.id}`,
                                        isTeamOnly: true,
                                        teamId: team.id,
                                        officeId: team.officeId,
                                        role: ROLE.TEAM_LEADER,
                                        name: `${team.name} (Unassigned Leader)`,
                                        status: 'Active',
                                      }
                                    )
                                  }
                                  title={`Open summary for ${teamLeader ? teamLeader.name : team.name}`}
                                >
                                  <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{team.id ? team.id.slice(0, 6) : '-'}</span>
                                      {team.id && <button title={team.id} onClick={() => navigator.clipboard.writeText(team.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                                    </div>
                                  </td>
                                  <td style={{ fontWeight: 600 }}>{team.name}</td>
                                  <td style={{ color: 'var(--crm-text-secondary)' }}>{office ? office.name : '-'}</td>
                                  <td>
                                    {teamLeader ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className={'status-indicator ' + (teamLeader.isLoggedIn ? 'crm-online' : 'crm-offline')}></span>
                                        <span style={{ fontWeight: 600, color: 'var(--crm-text-primary)' }}>{teamLeader.name}</span>
                                      </div>
                                    ) : <span style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>Unassigned</span>}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>{teamAgents.length}</td>
                                  <td style={{ textAlign: 'center' }}>{teamLeads.length}</td>
                                  <td style={{ textAlign: 'center', color: '#45d2a0', fontWeight: 600 }}>{teamDeposits}</td>
                                  <td>
                                    {teamLeader ? (
                                      <span className={'crm-badge ' + (staffBlockedStatus[teamLeader.id] ? 'crm-badge-danger' : 'crm-badge-success')}>{staffBlockedStatus[teamLeader.id] ? 'Blocked' : 'Active'}</span>
                                    ) : <span className="crm-badge crm-badge-warning">No Leader</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : staffSubTab === 'Agents' ? (
                  <div style={{ padding: 24 }}>
                    <div className="crm-super-admin-card">
                      <h2>Agents Management</h2>
                      <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13, marginBottom: 20 }}>Manage agents, assign to teams, and oversee agent performance.</p>
                      <div className="crm-super-admin-card" style={{ marginBottom: 24, background: 'rgba(52,152,219,0.1)' }}>
                        <h3>Create Agent</h3>
                        <div className="crm-super-admin-form-row">
                          <div className="crm-super-admin-form-group">
                            <label>Team (optional)</label>
                            <select className="crm-super-admin-select" value={agTeamId} onChange={(e) => {
                              const nextTeamId = e.target.value;
                              setAgTeamId(nextTeamId);
                              if (nextTeamId) {
                                const selectedTeam = data.teams.find((team) => team.id === nextTeamId);
                                setAgOfficeId(selectedTeam?.officeId || '');
                              }
                            }}>
                              <option value="">No team (direct agent)</option>
                              {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.officeId ? getOfficeName(team.officeId, data.offices) : 'No office'})</option>)}
                            </select>
                          </div>
                          <div className="crm-super-admin-form-group">
                            <label>Office (optional)</label>
                            <select className="crm-super-admin-select" value={agOfficeId} disabled={Boolean(agTeamId)} onChange={(e) => setAgOfficeId(e.target.value)}>
                              <option value="">No office (direct agent)</option>
                              {data.offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
                            </select>
                          </div>
                          <div className="crm-super-admin-form-group">
                            <label>Agent Name</label>
                            <input className="crm-super-admin-input" autoComplete="off" placeholder="Enter agent name..." value={agAgentName} onChange={(e) => setAgAgentName(e.target.value)} />
                          </div>
                          <div className="crm-super-admin-form-group">
                            <label>Agent Password</label>
                            <input className="crm-super-admin-input" autoComplete="new-password" placeholder="Enter password..." value={agAgentPassword} onChange={(e) => setAgAgentPassword(e.target.value)} type="password" />
                          </div>
                          <div className="crm-super-admin-form-group">
                            <button className="crm-super-admin-btn crm-super-admin-btn-small" disabled={!agAgentName || !agAgentPassword} onClick={async () => {
                              const newAg = await createAgent(agTeamId || null, agAgentName, agAgentPassword, agTeamId ? null : (agOfficeId || null));
                              if (newAg) setNewAgent(newAg);
                              setAgTeamId(''); setAgOfficeId(''); setAgAgentName(''); setAgAgentPassword('');
                            }}>✓ Create</button>
                          </div>
                        </div>
                        {newAgent && (
                          <div className="crm-credentials-output-container">
                            <h4>New Agent Created</h4>
                            <div className="crm-credential-item"><span>Name:</span><code>{newAgent.name}</code></div>
                            <div className="crm-credential-item"><span>Login Link:</span><code>{newAgent.loginLink}</code><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newAgent.loginLink)} title="Copy login link">[list] Copy Link</button></div>
                            <div className="crm-credential-item"><span>Password:</span><code>{newAgent.password}</code><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newAgent.password)} title="Copy password">[list] Copy Password</button></div>
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <input className="crm-super-admin-input" style={{ width: '100%', maxWidth: 340 }} placeholder="[search]  Search agents, teams, or offices..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)} autoComplete="off" />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
                        Click any agent row to open their staff profile modal and manage their account.
                      </div>
                      <div className="crm-super-admin-table-wrapper">
                        <table className="crm-super-admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Agent Name</th>
                              <th>Team</th>
                              <th>Office</th>
                              <th>Leads</th>
                              <th>Deposits</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.users.filter(u => {
                              if (u.role !== ROLE.AGENT) return false;
                              if (!agentSearch.trim()) return true;
                              const q = agentSearch.toLowerCase();
                              const team = data.teams.find(t => t.id === u.teamId);
                              const office = data.offices.find(o => o.id === u.officeId);
                              return (
                                u.name.toLowerCase().includes(q) ||
                                (team && team.name.toLowerCase().includes(q)) ||
                                (office && office.name.toLowerCase().includes(q))
                              );
                            }).map((agent) => {
                              const agentTeam = data.teams.find(t => t.id === agent.teamId);
                              const agentOffice = data.offices.find(o => o.id === agent.officeId);
                              const agentLeads = data.leads.filter(l => l.assignedToAgent === agent.id);
                              const agentDeposits = agentLeads.filter(l => l.stage === 'Deposit').length;
                              return (
                                <tr
                                  key={agent.id}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => openStaffProfile(agent)}
                                  title={`Open profile for ${agent.name}`}
                                >
                                  <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{agent.id ? agent.id.slice(0, 6) : '-'}</span>
                                      {agent.id && <button title={agent.id} onClick={() => navigator.clipboard.writeText(agent.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span className={`status-indicator ${agent.isLoggedIn ? 'crm-online' : 'crm-offline'}`}></span>
                                      <span style={{ fontWeight: 600, color: 'var(--crm-text-primary)' }}>{agent.name}</span>
                                    </div>
                                    {agent.email && <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginTop: 2 }}>{agent.email}</div>}
                                  </td>
                                  <td>{agentTeam?.name || 'Unassigned'}</td>
                                  <td>{agentOffice?.name || 'Unknown'}</td>
                                  <td>{agentLeads.length}</td>
                                  <td>{agentDeposits}</td>
                                  <td>
                                    <span className={`crm-badge ${staffBlockedStatus[agent.id] ? 'crm-badge-danger' : 'crm-badge-success'}`}>
                                      {staffBlockedStatus[agent.id] ? 'Blocked' : 'Active'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 24 }}>
                    {showCreateSuperAdmin && (
                      <div className="crm-super-admin-modal-overlay" onClick={() => setShowCreateSuperAdmin(false)}>
                        <form
                          className="crm-super-admin-modal-card"
                          style={{ maxWidth: 520 }}
                          onSubmit={handleCreateSuperAdmin}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="crm-super-admin-modal-header">
                            <span>Create Super Admin</span>
                            <button type="button" className="crm-super-admin-btn crm-super-admin-btn-small" onClick={() => setShowCreateSuperAdmin(false)}>Close</button>
                          </div>
                          <div style={{ display: 'grid', gap: 12, padding: 20 }}>
                            <label className="crm-super-admin-form-group">
                              <span>Name</span>
                              <input className="crm-super-admin-input" required autoComplete="name" value={newSuperAdmin.name} onChange={(event) => setNewSuperAdmin((current) => ({ ...current, name: event.target.value }))} />
                            </label>
                            <label className="crm-super-admin-form-group">
                              <span>Email</span>
                              <input className="crm-super-admin-input" type="email" required autoComplete="email" value={newSuperAdmin.email} onChange={(event) => setNewSuperAdmin((current) => ({ ...current, email: event.target.value }))} />
                            </label>
                            <label className="crm-super-admin-form-group">
                              <span>Temporary password (8 characters minimum)</span>
                              <input className="crm-super-admin-input" type="password" required minLength={8} autoComplete="new-password" value={newSuperAdmin.password} onChange={(event) => setNewSuperAdmin((current) => ({ ...current, password: event.target.value }))} />
                            </label>
                          </div>
                          <div className="crm-super-admin-modal-actions">
                            <button type="button" className="crm-super-admin-btn crm-super-admin-btn-secondary" onClick={() => setShowCreateSuperAdmin(false)}>Cancel</button>
                            <button type="submit" className="crm-super-admin-btn" disabled={creatingSuperAdmin}>{creatingSuperAdmin ? 'Creating…' : 'Create account'}</button>
                          </div>
                        </form>
                      </div>
                    )}
                    <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <h2 style={{ margin: '0 0 4px 0' }}>All Staff Directory</h2>
                          <p style={{ margin: 0, color: 'var(--crm-text-secondary)', fontSize: 13 }}>{staffRows.length} staff member{staffRows.length !== 1 ? 's' : ''} - administrators, managers, team leaders, and agents</p>
                        </div>
                        <button className="crm-super-admin-btn" onClick={() => setShowCreateSuperAdmin(true)}>+ Create Super Admin</button>
                      </div>
                    </div>
                    <div className="crm-super-admin-card">
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="crm-super-admin-input" style={{ flex: '1 1 260px', minWidth: 200 }} placeholder="Search by name, email, office, or team..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} autoComplete="off" />
                        <select className="crm-super-admin-select" style={{ flex: '0 0 180px' }} value={staffRoleFilter} onChange={e => setStaffRoleFilter(e.target.value)}>
                          <option value="">All roles</option>
                          <option value={ROLE.OFFICE_MANAGER}>Office Managers</option>
                          <option value={ROLE.TEAM_LEADER}>Team Leaders</option>
                          <option value={ROLE.AGENT}>Agents</option>
                          <option value={ROLE.SUPER_ADMIN}>Super Admins</option>
                        </select>
                        <select className="crm-super-admin-select" style={{ flex: '0 0 210px' }} value={staffStructureFilter} onChange={e => setStaffStructureFilter(e.target.value)}>
                          <option value="all">All structures</option>
                          <option value="independent">No office or team</option>
                          <option value="office-no-team">Office, no team</option>
                          <option value="team-assigned">Team assigned</option>
                        </select>
                        {(staffSearch || staffRoleFilter || staffStructureFilter !== 'all') && (
                          <button className="crm-super-admin-btn crm-super-admin-btn-small" style={{ background: 'var(--crm-border)', color: 'var(--crm-text-primary)' }} onClick={() => { setStaffSearch(''); setStaffRoleFilter(''); setStaffStructureFilter('all'); }}>✕ Clear</button>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
                        Click any staff member on a row to open their staff profile modal and manage their account.
                      </div>
                      <div className="crm-super-admin-table-wrapper">
                        <table className="crm-super-admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Name</th>
                              <th>Role</th>
                              <th>Office</th>
                              <th>Team</th>
                              <th>Leads</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffRows.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--crm-text-secondary)' }}>No staff members match your search.</td></tr>
                            ) : staffRows.map(u => {
                              const office = data.offices.find(o => o.id === u.officeId);
                              const team = data.teams.find(t => t.id === u.teamId);
                              const leads =
                                u.role === ROLE.OFFICE_MANAGER
                                  ? data.leads.filter(l => l.assignedToOffice === u.officeId).length
                                  : u.role === ROLE.TEAM_LEADER
                                  ? data.leads.filter(l => l.assignedToTeam === u.teamId).length
                                  : data.leads.filter(l => l.assignedToAgent === u.id).length;
                              const isBlocked = staffBlockedStatus[u.id];
                              return (
                                <tr
                                  key={u.id}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => openStaffProfile(u)}
                                  title={`Click to open ${u.name}'s staff profile`}
                                >
                                  <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{u.id ? u.id.slice(0, 6) : '-'}</span>
                                      {u.id && <button title={u.id} onClick={() => navigator.clipboard.writeText(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span className={`status-indicator ${u.isLoggedIn ? 'crm-online' : 'crm-offline'}`} />
                                      <span style={{ fontWeight: 600, color: 'var(--crm-text-primary)' }}>{u.name}</span>
                                    </div>
                                    {u.email && <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginTop: 2 }}>{u.email}</div>}
                                  </td>
                                  <td>
                                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, ...staffRoleBadgeStyle[u.role] }}>
                                      {staffRoleLabel[u.role] || u.role}
                                    </span>
                                  </td>
                                  <td style={{ color: office ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)', fontSize: 12 }}>{office ? office.name : '-'}</td>
                                  <td style={{ color: team ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)', fontSize: 12 }}>{team ? team.name : '-'}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--crm-text-secondary)' }}>{leads}</td>
                                  <td>
                                    <span className={`crm-badge ${isBlocked ? 'crm-badge-danger' : 'crm-badge-success'}`}>
                                      {isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'Dashboard' ? (
              <Dashboard offices={data.offices} teams={data.teams} staffUsers={data.users} />
            ) : activeTab === 'Site Settings' ? (
              <SiteSettingsTab showNotification={showNotification} />
            ) : activeTab === 'CRM Settings' ? (
              <CrmSettingsTab showNotification={showNotification} />
            ) : activeTab === 'Projects' ? (
              <ProjectsTab showNotification={showNotification} />
            ) : activeTab === 'Audit Log' ? (
              <AuditLog />
            ) : activeTab === 'Recycle Bin' ? (
              <RecycleBin data={data} setData={setData} showNotification={showNotification} />
            ) : activeTab === 'Agent Access' ? (
              <AgentAccess showNotification={showNotification} />
            ) : null}
            <NotificationToast ref={notificationRef} />
          </div>
        </div>

        {/* Office / Team info modal */}
        {infoModal && (() => {
          const isOffice = infoModal.type === 'office';
          const office = isOffice ? data.offices.find(o => o.id === infoModal.id) : null;
          const team = !isOffice ? data.teams.find(t => t.id === infoModal.id) : null;
          if (!office && !team) return null;
          const officeForTeam = team ? data.offices.find(o => o.id === team.officeId) : null;
          const manager = isOffice ? data.users.find(u => u.role === ROLE.OFFICE_MANAGER && u.officeId === office.id) : null;
          const leader = team ? data.users.find(u => u.role === ROLE.TEAM_LEADER && u.teamId === team.id) : null;
          const teamsList = isOffice ? data.teams.filter(t => t.officeId === office.id) : [];
          const agentsList = isOffice
            ? data.users.filter(u => u.role === ROLE.AGENT && u.officeId === office.id)
            : data.users.filter(u => u.role === ROLE.AGENT && u.teamId === team.id);
          const leadsList = isOffice
            ? data.leads.filter(l => l.assignedToOffice === office.id)
            : data.leads.filter(l => l.assignedToTeam === team.id);
          const deposits = leadsList.filter(l => l.stage === 'Deposit').length;
          const title = isOffice ? `[office] ${office.name}` : `[users] ${team.name}`;
          const head = isOffice ? 'Office Details' : `Team Details - ${officeForTeam?.name || ''}`;
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }} onClick={() => setInfoModal(null)}>
              <div style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 12, width: '100%', maxWidth: 760, padding: 24 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--crm-text-primary)', fontSize: 20 }}>{title}</h2>
                    <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginTop: 4 }}>{head}</div>
                  </div>
                  <button onClick={() => setInfoModal(null)} style={{ background: 'none', border: '1px solid var(--crm-border)', color: 'var(--crm-text-secondary)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
                  {[
                    isOffice && { label: 'Teams', value: teamsList.length, color: '#0A84FF' },
                    { label: 'Agents', value: agentsList.length, color: 'var(--crm-accent)' },
                    { label: 'Clients', value: leadsList.length, color: 'var(--crm-text-primary)' },
                    { label: 'Deposits', value: deposits, color: '#0ECB81' },
                  ].filter(Boolean).map(s => (
                    <div key={s.label} style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 6, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>{isOffice ? 'Office Manager' : 'Team Leader'}</div>
                  {(manager || leader) ? (
                    <div style={{ fontSize: 13, color: 'var(--crm-text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div><strong>Name:</strong> {(manager || leader).name}</div>
                      <div><strong>Status:</strong> {staffBlockedStatus[(manager || leader).id] ? 'Blocked' : 'Active'}  /  {(manager || leader).isLoggedIn ? 'Online' : 'Offline'}</div>
                      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}><strong>ID:</strong> {(manager || leader).id}</div>
                    </div>
                  ) : <div style={{ color: 'var(--crm-text-secondary)', fontSize: 13 }}>No {isOffice ? 'manager' : 'leader'} assigned.</div>}
                </div>

                {isOffice && teamsList.length > 0 && (
                  <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Teams ({teamsList.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {teamsList.map(t => {
                        const tl = data.users.find(u => u.role === ROLE.TEAM_LEADER && u.teamId === t.id);
                        const tAgents = data.users.filter(u => u.role === ROLE.AGENT && u.teamId === t.id).length;
                        const tLeads = data.leads.filter(l => l.assignedToTeam === t.id).length;
                        return (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--crm-text-primary)', padding: '6px 8px', background: 'var(--crm-bg)', borderRadius: 4 }}>
                            <span>{t.name} {tl && <span style={{ color: 'var(--crm-text-secondary)' }}> /  {tl.name}</span>}</span>
                            <span style={{ color: 'var(--crm-text-secondary)' }}>{tAgents} agents  /  {tLeads} leads</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {agentsList.length > 0 && (
                  <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Agents ({agentsList.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {agentsList.map(a => {
                        const aLeads = data.leads.filter(l => l.assignedToAgent === a.id).length;
                        return (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--crm-text-primary)', padding: '6px 8px', background: 'var(--crm-bg)', borderRadius: 4 }}>
                            <span>{a.name} <span style={{ color: 'var(--crm-text-secondary)' }}> /  {getTeamName(a.teamId, data.teams)}</span></span>
                            <span style={{ color: a.isLoggedIn ? '#0ECB81' : 'var(--crm-text-secondary)' }}>{a.isLoggedIn ? 'Online' : 'Offline'}  /  {aLeads} leads</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {isOffice && manager && (
                    <button className="crm-super-admin-btn crm-super-admin-btn-small" onClick={() => { navigate(`/admin/office-manager/${manager.id}`); setInfoModal(null); }}>View Open Manager Panel</button>
                  )}
                  {!isOffice && leader && (
                    <button className="crm-super-admin-btn crm-super-admin-btn-small" onClick={() => { navigate(`/admin/team-leader/${leader.id}`); setInfoModal(null); }}>View Open Team Leader Panel</button>
                  )}
                  <button className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary" onClick={() => setInfoModal(null)}>Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Edit staff name / password modal */}
        {isEditModalOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2100, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}
            onClick={closeEditModal}
          >
            <div
              style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 12, width: '100%', maxWidth: 440, padding: 24 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, color: 'var(--crm-text-primary)', fontSize: 18 }}>{editModalTitle}</h2>
                <button
                  onClick={closeEditModal}
                  style={{ background: 'none', border: '1px solid var(--crm-border)', color: 'var(--crm-text-secondary)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                >✕</button>
              </div>
              {editModalType === 'password' ? (
                <div className="crm-pw-field">
                  <div className="crm-pw-field-head">
                    <label className="crm-pw-field-label" htmlFor="crm-pw-edit-input">
                      Account password
                    </label>
                    <button
                      type="button"
                      className="crm-pw-generate"
                      onClick={generateStrongPassword}
                      title="Generate a strong password"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      Generate
                    </button>
                  </div>
                  <div className="crm-pw-input-wrap">
                    <input
                      id="crm-pw-edit-input"
                      className="crm-pw-input"
                      autoFocus
                      type={editPasswordShown ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Enter a strong password"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveStaffEdit(); if (e.key === 'Escape') closeEditModal(); }}
                    />
                    <button
                      type="button"
                      className="crm-pw-toggle"
                      onClick={() => setEditPasswordShown(v => !v)}
                      title={editPasswordShown ? 'Hide password' : 'Show password'}
                      aria-label={editPasswordShown ? 'Hide password' : 'Show password'}
                    >
                      {editPasswordShown ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 4.22-5.22" />
                          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19" />
                          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="crm-pw-meta">
                    <div className="crm-pw-strength" data-level={passwordStrength(editingValue).level}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={'crm-pw-bar' + (i < passwordStrength(editingValue).level ? ' is-on' : '')}
                        />
                      ))}
                    </div>
                    <span className="crm-pw-hint">
                      {editingValue
                        ? `${passwordStrength(editingValue).label}  /  ${editingValue.length} chars`
                        : 'Use 12+ chars with letters, numbers, and a symbol'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>
                    New Name
                  </label>
                  <input
                    className="crm-super-admin-input"
                    autoFocus
                    type="text"
                    autoComplete="off"
                    placeholder="Enter new name..."
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveStaffEdit(); if (e.key === 'Escape') closeEditModal(); }}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
                  onClick={closeEditModal}
                >Cancel</button>
                <button
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  disabled={!editingValue.trim()}
                  onClick={saveStaffEdit}
                >✓ Save</button>
              </div>
            </div>
          </div>
        )}
        {activeProfileLead && (
          <LeadProfileModal
            lead={activeProfileLead}
            onClose={closeLeadProfile}
            data={data}
            currentUser={currentUser}
            setData={setData}
            setLeadAssignment={setLeadAssignment}
            showNotification={showNotification}
          />
        )}
        {activeProfileStaff && (
          <StaffProfileModal
            staff={activeProfileStaff}
            onClose={closeStaffProfile}
            data={data}
            currentUser={currentUser}
            setData={setData}
            toggleStaffBlocked={toggleStaffBlocked}
            setUserLoginState={setUserLoginState}
            showNotification={showNotification}
          />
        )}
      </DataContext.Provider>
    </NotificationContext.Provider>
  );
}

export default SuperAdminPanel;
