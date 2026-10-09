import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE, LEAD_STATUSES, normalizeStage, getTeamName, getUserName, getCountryFlag, EditLeadModal, CreateAgentModal, CreateLeadModal, AddCommentModal, stageColor, assignableAgents, assignableAgentLabel, StatusDropdown } from '../shared';
import { SearchAutocomplete } from '../components/UserChrome.jsx';
import { searchAdminLeads } from '../adminApi';
import { bulkAssignLeadsApi } from '../adminApi';
import ReactCapabilityWorkspace from '../components/ReactCapabilityWorkspace.jsx';
import StaffProfileModal from '../components/StaffProfileModal.jsx';

function AssignTab({ teamLeads, teamAgents, agentStats, showNotification, onBulkReassign, data }) {
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const fromAgentLeads = fromAgent
    ? teamLeads.filter(l => fromAgent === '__unassigned__' ? !l.assignedToAgent : l.assignedToAgent === fromAgent)
    : [];

  const toggleLead = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = (checked) => setSelectedIds(checked ? fromAgentLeads.map(l => l.id) : []);

  const handleReassign = async () => {
    if (!toAgent || selectedIds.length === 0) {
      showNotification('Select leads and a destination agent.');
      return;
    }
    const destAgent = teamAgents.find(a => a.id === toAgent);
    const count = selectedIds.length;
    const idsToAssign = [...selectedIds];
    setSelectedIds([]);
    if (toAgent === fromAgent) setFromAgent('');
    try {
      await onBulkReassign(idsToAssign, destAgent);
      showNotification(`${count} lead(s) reassigned to ${destAgent?.name || 'agent'}.`);
    } catch {
      showNotification('Reassign failed - please try again.');
    }
  };

  const stageColor = (s) => ({ Deposit: '#45d2a0', New: '#0A84FF', 'In Line': 'var(--crm-accent)', 'Failed Deposit': '#ff6464', 'No Answer': 'var(--crm-text-secondary)', 'Not Interested': 'var(--crm-text-secondary)' }[s] || 'var(--crm-text-secondary)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="crm-super-admin-card">
          <h3 style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Workload</h3>
          <div className="crm-super-admin-table-wrapper">
            <table className="crm-super-admin-table">
              <thead><tr><th>Agent</th><th style={{ textAlign: 'center' }}>Leads</th><th style={{ textAlign: 'center' }}>Load</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
              <tbody>
                {agentStats.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td style={{ textAlign: 'center' }}>{a.totalLeads}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: a.workloadLevel === 'high' ? 'rgba(255,100,100,0.1)' : a.workloadLevel === 'medium' ? 'color-mix(in srgb, var(--crm-accent) 10%, transparent)' : 'rgba(69,210,160,0.1)', color: a.workloadLevel === 'high' ? '#ff6464' : a.workloadLevel === 'medium' ? 'var(--crm-accent)' : '#45d2a0', border: '1px solid ' + (a.workloadLevel === 'high' ? '#ff646440' : a.workloadLevel === 'medium' ? 'color-mix(in srgb, var(--crm-accent) 25%, transparent)' : '#45d2a040'), padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{a.workloadLevel}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => { setFromAgent(a.id); setSelectedIds([]); }}
                        style={{ padding: '3px 10px', background: fromAgent === a.id ? 'var(--crm-accent)' : 'transparent', color: fromAgent === a.id ? 'var(--crm-card)' : 'var(--crm-accent)', border: '1px solid color-mix(in srgb, var(--crm-accent) 31%, transparent)', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                      >{fromAgent === a.id ? '✓ Selected' : 'Reassign'}</button>
                    </td>
                  </tr>
                ))}
                {agentStats.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 20 }}>No agents.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={fromAgent} onChange={e => { setFromAgent(e.target.value); setSelectedIds([]); }} className="crm-super-admin-select" style={{ flex: 1 }}>
              <option value="">- Pick source agent -</option>
              <option value="__unassigned__">Unassigned leads</option>
              {teamAgents.map(a => {
                const s = agentStats.find(x => x.id === a.id);
                return <option key={a.id} value={a.id}>{a.name} ({s ? s.totalLeads : 0} leads)</option>;
              })}
            </select>
          </div>
        </div>

        <div className="crm-super-admin-card">
          <h3 style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reassign Leads</h3>
          {!fromAgent ? (
            <div style={{ color: 'var(--crm-text-secondary)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
              Select a source agent from the left to see their leads and reassign them.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>Reassign {selectedIds.length > 0 ? selectedIds.length : fromAgentLeads.length} lead(s) to:</div>
                <select value={toAgent} onChange={e => setToAgent(e.target.value)} className="crm-super-admin-select" style={{ flex: 1 }}>
                  <option value="">- Pick destination agent -</option>
                  {teamAgents.filter(a => fromAgent === '__unassigned__' || a.id !== fromAgent).map(a => {
                    const s = agentStats.find(x => x.id === a.id);
                    return <option key={a.id} value={a.id}>{a.name} ({s ? s.totalLeads : 0})</option>;
                  })}
                </select>
                <button
                  className="crm-super-admin-btn"
                  style={{ background: toAgent && selectedIds.length > 0 ? '#45d2a0' : 'var(--crm-border)', color: toAgent && selectedIds.length > 0 ? 'var(--crm-bg)' : 'var(--crm-text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}
                  disabled={!toAgent || selectedIds.length === 0}
                  onClick={handleReassign}
                >↗ Reassign {selectedIds.length || fromAgentLeads.length}</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 2 }}>
                {fromAgent === '__unassigned__' ? 'Unassigned leads' : (teamAgents.find(a => a.id === fromAgent)?.name || 'Agent')} - {fromAgentLeads.length} lead(s)
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--crm-border)', borderRadius: 6 }}>
                <table className="crm-super-admin-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}><input type="checkbox" checked={selectedIds.length === fromAgentLeads.length && fromAgentLeads.length > 0} onChange={e => toggleAll(e.target.checked)} /></th>
                      <th>Name</th><th>Status</th><th>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fromAgentLeads.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 20 }}>No leads.</td></tr>}
                    {fromAgentLeads.map(l => {
                      const stage = normalizeStage(l.stage);
                      const sc = stageColor(stage);
                      return (
                        <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => toggleLead(l.id)}>
                          <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleLead(l.id)} /></td>
                          <td><div style={{ fontWeight: 600, fontSize: 12 }}>{l.firstName} {l.lastName}</div><div style={{ fontSize: 10, color: 'var(--crm-text-secondary)' }}>{l.email}</div></td>
                          <td><span style={{ background: sc + '18', color: sc, border: '1px solid ' + sc + '40', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>{stage}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>{getCountryFlag(l.countryCode, l.country)} {l.country || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamLeaderPanel({ data, setData, currentUser, createAgent, canCreateAgent, toggleStaffBlocked, setLeadAssignment, updateLead, createLead, setUserLoginState, showNotification }) {
  const navigate = useNavigate();
  const [activeProfileStaff, setActiveProfileStaff] = useState(null);
  const [agentId, setAgentId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [bulkAgentId, setBulkAgentId] = useState('');
  const [bulkSelectedLeads, setBulkSelectedLeads] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterFunnel, setFilterFunnel] = useState('');
  const [filterAffiliate, setFilterAffiliate] = useState('');
  const [filterLastComment, setFilterLastComment] = useState('');
  const [filterRegistered, setFilterRegistered] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const nativeTabs = ['overview', 'agents', 'leads', 'assign'];
  const tabStorageKey = `tl_activeTab:${currentUser?.id || 'unknown'}`;
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem(tabStorageKey);
    return nativeTabs.includes(saved) ? saved : 'agents';
  });
  useEffect(() => { sessionStorage.setItem(tabStorageKey, activeTab); }, [activeTab, tabStorageKey]);
  // Agent activity analysis filters
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');
  const [minComments, setMinComments] = useState('');
  const [maxComments, setMaxComments] = useState('');
  const [contactStatusFilter, setContactStatusFilter] = useState('all'); // all, contacted, not-contacted
  const [compactTable, setCompactTable] = useState(false);
  // Enhanced agent management state
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [agentSortBy, setAgentSortBy] = useState('name');
  const [agentSortDirection, setAgentSortDirection] = useState('asc');
  const [agentFilterStatus, setAgentFilterStatus] = useState('all'); // all, online, offline
  const [agentFilterWorkload, setAgentFilterWorkload] = useState('all'); // all, low, medium, high
  const [agentFilterPerformance, setAgentFilterPerformance] = useState('all'); // all, high, medium, low
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [showAgentDetails, setShowAgentDetails] = useState(null);
  const [agentGoals, setAgentGoals] = useState({});
  const [agentNotes, setAgentNotes] = useState({});
  const [reassignModal, setReassignModal] = useState({ show: false, agentId: null, leads: [] });
  const [reassignSelectedLeadIds, setReassignSelectedLeadIds] = useState([]);
  const [reassignFromAgent, setReassignFromAgent] = useState('');
  const [reassignToAgent, setReassignToAgent] = useState('');
  const [communicationModal, setCommunicationModal] = useState({ show: false, agentId: null, type: 'message' });
  const [performanceReviewModal, setPerformanceReviewModal] = useState({ show: false, agentId: null });
  const [scheduleModal, setScheduleModal] = useState({ show: false, agentId: null });
  // View mode and UI state
  const [agentViewMode, setAgentViewMode] = useState('compact'); // compact, detailed, list
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  // Global search functionality
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  // Lead-management modals (create / edit / add-comment).
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [commentLead, setCommentLead] = useState(null);
  const teamAgents = useMemo(
    () => currentUser.teamId ? assignableAgents(data.users, currentUser, { teamId: currentUser.teamId }) : [],
    [data.users, currentUser.teamId]
  );

  // Enhanced modal effects
  useEffect(() => {
    if (communicationModal.show) {
      // Character counter and preview for communication modal
      const handleMessageInput = () => {
        const textarea = document.getElementById('messageContent');
        const charCount = document.getElementById('charCount');
        const preview = document.getElementById('messagePreview');
        const messageType = document.getElementById('messageType');

        if (textarea && charCount) {
          const count = textarea.value.length;
          charCount.textContent = count;
          charCount.style.color = count > 900 ? '#ef4444' : count > 800 ? '#f59e0b' : 'var(--muted)';
        }

        if (textarea && preview && messageType) {
          const typeIcons = {
            'message': '💬',
            'announcement': '📢',
            'reminder': '',
            'performance': '[chart]',
            'training': '🎓'
          };

          const typeText = messageType.options[messageType.selectedIndex]?.text || 'Message';
          const content = textarea.value.trim();

          if (content) {
            preview.innerHTML = `
              <div style="font-weight: 600; color: var(--accent); margin-bottom: 8px;">
                ${typeIcons[messageType.value] || '💬'} ${typeText}
              </div>
              <div style="color: var(--text); line-height: 1.5;">
                ${content.replace(/\n/g, '<br>')}
              </div>
            `;
            preview.style.fontStyle = 'normal';
          } else {
            preview.textContent = 'Preview will appear here as you type...';
            preview.style.fontStyle = 'italic';
          }
        }
      };

      // Add event listeners with a small delay to ensure DOM is ready
      setTimeout(() => {
        document.getElementById('messageContent')?.addEventListener('input', handleMessageInput);
        document.getElementById('messageType')?.addEventListener('change', handleMessageInput);
        handleMessageInput(); // Initial call
      }, 100);

      // Cleanup
      return () => {
        document.getElementById('messageContent')?.removeEventListener('input', handleMessageInput);
        document.getElementById('messageType')?.removeEventListener('change', handleMessageInput);
      };
    }
  }, [communicationModal.show]);
  const onlineAgents = teamAgents.filter((a) => a.isLoggedIn).length;
  const teamLeads = useMemo(
    () => data.leads.filter((lead) =>
      (currentUser.teamId && lead.assignedToTeam === currentUser.teamId) ||
      lead.assignedToTeamLeader === currentUser.id
    ),
    [data.leads, currentUser.teamId, currentUser.id]
  );

  // Global search function
  const performGlobalSearch = (query) => {
    if (!query.trim()) {
      setGlobalSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const results = teamLeads.filter((lead) => {
      return (
        lead.id.toString().toLowerCase().includes(lowerQuery) ||
        lead.firstName.toLowerCase().includes(lowerQuery) ||
        lead.lastName.toLowerCase().includes(lowerQuery) ||
        `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(lowerQuery) ||
        lead.email.toLowerCase().includes(lowerQuery) ||
        lead.phone.toLowerCase().includes(lowerQuery)
      );
    }).map((lead) => ({
      ...lead,
      agentName: getUserName(lead.assignedToAgent, data.users),
      fullName: `${lead.firstName} ${lead.lastName}`
    }));

    setGlobalSearchResults(results);
  };

  // Effect to perform search when query changes
  useEffect(() => {
    performGlobalSearch(globalSearchQuery);
  }, [globalSearchQuery, teamLeads]);

  // Compute agent stats with enhanced analytics
  const agentStats = teamAgents.map((agent) => {
    const agentLeads = teamLeads.filter((lead) => lead.assignedToAgent === agent.id);
    const deposits = agentLeads.filter((lead) => ['Deposit', 'Failed Deposit'].includes(lead.stage));
    const successfulDeposits = deposits.filter((lead) => lead.stage === 'Deposit');
    const contactedLeads = agentLeads.filter((lead) => lead.commentHistory && lead.commentHistory.length > 0);
    const allComments = agentLeads.flatMap((lead) => lead.commentHistory || []);
    const agentComments = allComments.filter((comment) => comment.by === agent.name);

    // Calculate activity metrics
    const today = new Date().toISOString().split('T')[0];
    const todaysComments = agentComments.filter((comment) => comment.date === today);
    const recentComments = agentComments.filter((comment) => {
      const commentDate = new Date(comment.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return commentDate >= weekAgo;
    });

    // Lead stage distribution
    const stageStats = {
      new: agentLeads.filter(l => normalizeStage(l.stage) === 'New').length,
      contacted: agentLeads.filter(l => normalizeStage(l.stage) === 'In Line').length,
      qualified: agentLeads.filter(l => ['Qualified', 'Deposit', 'Failed Deposit'].includes(l.stage)).length,
      closed: agentLeads.filter(l => ['Deposit', 'Failed Deposit'].includes(l.stage)).length,
    };

    // Performance trends (mock data for now)
    const performanceTrend = successfulDeposits.length > (agentLeads.length * 0.2) ? 'up'
      : deposits.filter(l => l.stage === 'Failed Deposit').length > successfulDeposits.length ? 'down'
      : 'stable';

    return {
      ...agent,
      totalLeads: agentLeads.length,
      deposits: deposits.length,
      successfulDeposits: successfulDeposits.length,
      conversionRate: agentLeads.length > 0 ? ((successfulDeposits.length / agentLeads.length) * 100).toFixed(1) : 0,
      contactedLeads: contactedLeads.length,
      contactRate: agentLeads.length > 0 ? ((contactedLeads.length / agentLeads.length) * 100).toFixed(1) : 0,
      totalComments: agentComments.length,
      todaysComments: todaysComments.length,
      recentComments: recentComments.length,
      avgCommentsPerLead: contactedLeads.length > 0 ? (agentComments.length / contactedLeads.length).toFixed(1) : 0,
      stageStats,
      performanceTrend,
      lastActivity: agentComments.length > 0 ? agentComments[agentComments.length - 1].date : 'Never',
      workloadLevel: agentLeads.length > 20 ? 'high' : agentLeads.length > 10 ? 'medium' : 'low',
    };
  });

  // Compute agent activity analysis
  const agentActivityStats = teamAgents.map((agent) => {
    const agentLeads = teamLeads.filter((lead) => lead.assignedToAgent === agent.id);
    const contactedLeads = agentLeads.filter((lead) => lead.commentHistory && lead.commentHistory.length > 0);
    const allComments = agentLeads.flatMap((lead) => lead.commentHistory || []);
    const agentComments = allComments.filter((comment) => comment.by === agent.name);

    // Comments by date range
    const commentsInRange = agentComments.filter((comment) => {
      if (!activityDateFrom && !activityDateTo) return true;
      const commentDate = new Date(comment.date);
      const fromDate = activityDateFrom ? new Date(activityDateFrom) : new Date('1900-01-01');
      const toDate = activityDateTo ? new Date(activityDateTo) : new Date('2100-01-01');
      return commentDate >= fromDate && commentDate <= toDate;
    });

    // Today's comments
    const today = new Date().toISOString().split('T')[0];
    const todaysComments = agentComments.filter((comment) => comment.date === today);

    return {
      ...agent,
      totalLeads: agentLeads.length,
      contactedLeads: contactedLeads.length,
      contactRate: agentLeads.length > 0 ? ((contactedLeads.length / agentLeads.length) * 100).toFixed(1) : 0,
      totalComments: agentComments.length,
      commentsInRange: commentsInRange.length,
      todaysComments: todaysComments.length,
      avgCommentsPerLead: contactedLeads.length > 0 ? (agentComments.length / contactedLeads.length).toFixed(1) : 0,
    };
  });
  const filteredTeamLeads = teamLeads.filter((lead) => {
    const stage = normalizeStage(lead.stage);
    const lowerQuery = searchQuery.toLowerCase();
    if (filterStatus && stage !== filterStatus) return false;
    if (filterCountry && lead.country !== filterCountry) return false;
    if (filterAgent === '__unassigned__' && lead.assignedToAgent) return false;
    if (filterAgent && filterAgent !== '__unassigned__' && lead.assignedToAgent !== filterAgent) return false;
    if (filterFunnel && (lead.funnel || '') !== filterFunnel) return false;
    if (filterAffiliate && (lead.affiliate || '') !== filterAffiliate) return false;
    if (filterLastComment && (lead.lastCommentDate || '') !== filterLastComment) return false;
    if (filterRegistered && (lead.registeredDate || '') !== filterRegistered) return false;
    if (searchQuery && !(
      lead.firstName.toLowerCase().includes(lowerQuery) ||
      lead.lastName.toLowerCase().includes(lowerQuery) ||
      lead.phone.toLowerCase().includes(lowerQuery) ||
      lead.email.toLowerCase().includes(lowerQuery)
    )) return false;

    // Agent activity filters
    const leadComments = lead.commentHistory || [];
    const commentCount = leadComments.length;
    if (contactStatusFilter === 'contacted' && commentCount === 0) return false;
    if (contactStatusFilter === 'not-contacted' && commentCount > 0) return false;
    if (minComments && commentCount < parseInt(minComments)) return false;
    if (maxComments && commentCount > parseInt(maxComments)) return false;

    // Date range filter for comments
    if (activityDateFrom || activityDateTo) {
      const hasCommentsInRange = leadComments.some((comment) => {
        const commentDate = new Date(comment.date);
        const fromDate = activityDateFrom ? new Date(activityDateFrom) : new Date('1900-01-01');
        const toDate = activityDateTo ? new Date(activityDateTo) : new Date('2100-01-01');
        return commentDate >= fromDate && commentDate <= toDate;
      });
      if (!hasCommentsInRange) return false;
    }

    return true;
  }).sort((a, b) => {
    let aVal, bVal;
    switch (sortColumn) {
      case 'name': aVal = `${a.firstName} ${a.lastName}`; bVal = `${b.firstName} ${b.lastName}`; break;
      case 'agent': aVal = getUserName(a.assignedToAgent, data.users) || ''; bVal = getUserName(b.assignedToAgent, data.users) || ''; break;
      case 'stage': aVal = normalizeStage(a.stage); bVal = normalizeStage(b.stage); break;
      case 'country': aVal = a.country; bVal = b.country; break;
      case 'funnel': aVal = a.funnel || ''; bVal = b.funnel || ''; break;
      case 'lastComment': aVal = a.lastCommentDate || ''; bVal = b.lastCommentDate || ''; break;
      case 'registered': aVal = a.registeredDate || ''; bVal = b.registeredDate || ''; break;
      case 'comments': aVal = a.commentHistory ? a.commentHistory.length : 0; bVal = b.commentHistory ? b.commentHistory.length : 0; break;
      default: return 0;
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  const totalFiltered = filteredTeamLeads.length;
  const paginatedLeads = filteredTeamLeads.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const filteredLeadIds = filteredTeamLeads.map((lead) => lead.id);

  const toggleLeadSelection = (leadIdToToggle) => {
    setBulkSelectedLeads((prev) =>
      prev.includes(leadIdToToggle)
        ? prev.filter((id) => id !== leadIdToToggle)
        : [...prev, leadIdToToggle]
    );
  };

  const handleSelectAllLeads = (checked) => {
    setBulkSelectedLeads(checked ? filteredLeadIds : []);
  };

  const handleBulkAssign = () => {
    if (!bulkAgentId) {
      showNotification('Please choose an agent for bulk assignment.');
      return;
    }
    if (bulkSelectedLeads.length === 0) {
      showNotification('Please select at least one lead to assign.');
      return;
    }
    bulkSelectedLeads.forEach((selectedLeadId) => {
      setLeadAssignment({ leadId: selectedLeadId, officeId: currentUser.officeId, teamId: currentUser.teamId, agentId: bulkAgentId });
    });
    showNotification(`Assigned ${bulkSelectedLeads.length} leads to agent.`);
    setBulkSelectedLeads([]);
    setBulkAgentId('');
  };

  const handleShuffleLeads = () => {
    if (teamAgents.length === 0) {
      showNotification('No team agents available to shuffle leads.');
      return;
    }
    const agentIds = teamAgents.map((agent) => agent.id);
    teamLeads.forEach((lead, index) => {
      const assignedAgentId = agentIds[index % agentIds.length];
      setLeadAssignment({ leadId: lead.id, officeId: currentUser.officeId, teamId: currentUser.teamId, agentId: assignedAgentId });
    });
    showNotification('Leads shuffled across team agents.');
  };

  const handleBulkSetAgentsOnline = (_online) => {
    showNotification('Login status is now automatic - agents log in themselves.');
  };

  // Enhanced Agent Management Functions
  const handleAgentSearch = (query) => {
    setAgentSearchQuery(query);
  };

  const handleAgentSort = (column) => {
    if (agentSortBy === column) {
      setAgentSortDirection(agentSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setAgentSortBy(column);
      setAgentSortDirection('asc');
    }
  };

  const handleAgentFilter = (type, value) => {
    switch (type) {
      case 'status':
        setAgentFilterStatus(value);
        break;
      case 'workload':
        setAgentFilterWorkload(value);
        break;
      case 'performance':
        setAgentFilterPerformance(value);
        break;
    }
  };

  const handleAgentSelection = (agentId, selected) => {
    if (selected) {
      setSelectedAgents([...selectedAgents, agentId]);
    } else {
      setSelectedAgents(selectedAgents.filter(id => id !== agentId));
    }
  };

  const handleBulkAgentAction = (action) => {
    if (selectedAgents.length === 0) {
      showNotification('Please select at least one agent.');
      return;
    }

    switch (action) {
      case 'sendMessage':
        setCommunicationModal({ show: true, agentId: null, type: 'bulk' });
        break;
    }
    setSelectedAgents([]);
  };

  const handleReassignLeads = async (fromAgentId, toAgentId, leadIds) => {
    if (!fromAgentId || !toAgentId) {
      showNotification('Choose source and target agents.');
      return;
    }
    if (fromAgentId === toAgentId) {
      showNotification('Source and target cannot be the same agent.');
      return;
    }
    const uniqueIds = [...new Set(leadIds)];
    const validatedLeadIds = uniqueIds.filter((id) => {
      const lead = teamLeads.find((l) => l.id === id);
      return lead && lead.assignedToAgent === fromAgentId;
    });

    if (validatedLeadIds.length === 0) {
      showNotification('No leads selected from the source agent to reassign.');
      return;
    }

    const destAgent = data.users.find(u => u.id === toAgentId);
    const targetOffice = destAgent?.officeId || currentUser.officeId || null;
    const targetTeam   = destAgent?.teamId  || currentUser.teamId  || null;

    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l =>
        validatedLeadIds.includes(l.id)
          ? { ...l, assignedToOffice: targetOffice, assignedToTeam: targetTeam, assignedToAgent: toAgentId }
          : l
      ),
    }));

    setReassignModal({ show: false, agentId: null, leads: [] });
    setReassignSelectedLeadIds([]);
    setReassignFromAgent('');
    setReassignToAgent('');

    showNotification(`${validatedLeadIds.length} leads reassigned to ${getUserName(toAgentId, data.users)}.`);

    try {
      await bulkAssignLeadsApi(validatedLeadIds, { officeId: targetOffice, teamId: targetTeam, agentId: toAgentId });
    } catch {
      showNotification('Could not persist reassignment - please reload and retry.');
    }
  };

  const handleBulkReassign = async (selectedIds, destAgent) => {
    if (!destAgent || selectedIds.length === 0) return;
    const targetOffice = destAgent.officeId || currentUser.officeId || null;
    const targetTeam   = destAgent.teamId  || currentUser.teamId  || null;

    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l =>
        selectedIds.includes(l.id)
          ? { ...l, assignedToOffice: targetOffice, assignedToTeam: targetTeam, assignedToAgent: destAgent.id }
          : l
      ),
    }));

    await bulkAssignLeadsApi(selectedIds, { officeId: targetOffice, teamId: targetTeam, agentId: destAgent.id });
  };

  const handleSetAgentGoal = (agentId, goalType, target) => {
    setAgentGoals({
      ...agentGoals,
      [agentId]: {
        ...agentGoals[agentId],
        [goalType]: target
      }
    });
    showNotification(`Goal set for agent.`);
  };

  const handleAddAgentNote = (agentId, note) => {
    const currentNotes = agentNotes[agentId] || [];
    setAgentNotes({
      ...agentNotes,
      [agentId]: [...currentNotes, { text: note, date: new Date().toISOString().split('T')[0], by: currentUser.name }]
    });
    showNotification('Note added to agent profile.');
  };

  const handleSendMessage = (agentId, message, type = 'message') => {
    showNotification(`${type === 'message' ? 'Message' : 'Announcement'} sent to agent.`);
    setCommunicationModal({ show: false, agentId: null, type: 'message' });
  };

  const handleScheduleReview = (agentId, reviewDate, reviewType) => {
    showNotification(`Performance review scheduled for ${reviewDate}.`);
    setPerformanceReviewModal({ show: false, agentId: null });
  };

  const handleUpdateSchedule = (agentId, schedule) => {
    showNotification('Agent schedule updated.');
    setScheduleModal({ show: false, agentId: null });
  };

  const getFilteredAgents = () => {
    const filtered = agentStats.filter(agent => {
      // Search filter
      if (agentSearchQuery) {
        const query = agentSearchQuery.toLowerCase();
        if (!agent.name.toLowerCase().includes(query) && !agent.email.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Status filter
      if (agentFilterStatus !== 'all') {
        if (agentFilterStatus === 'online' && !agent.isLoggedIn) return false;
        if (agentFilterStatus === 'offline' && agent.isLoggedIn) return false;
      }

      // Workload filter
      if (agentFilterWorkload !== 'all' && agent.workloadLevel !== agentFilterWorkload) {
        return false;
      }

      // Performance filter
      if (agentFilterPerformance !== 'all') {
        const rate = parseFloat(agent.conversionRate);
        if (agentFilterPerformance === 'high' && rate < 20) return false;
        if (agentFilterPerformance === 'medium' && (rate < 10 || rate >= 20)) return false;
        if (agentFilterPerformance === 'low' && rate >= 10) return false;
      }

      return true;
    });

    // Sort agents
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (agentSortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'leads':
          aVal = a.totalLeads;
          bVal = b.totalLeads;
          break;
        case 'conversion':
          aVal = parseFloat(a.conversionRate);
          bVal = parseFloat(b.conversionRate);
          break;
        case 'activity':
          aVal = a.recentComments;
          bVal = b.recentComments;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (agentSortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  };

  const handleSingleAssign = (leadId, agentId) => {
    if (!leadId || !agentId) return;
    setLeadAssignment({ leadId, officeId: currentUser.officeId, teamId: currentUser.teamId, agentId });
    showNotification('Lead assigned to agent.');
    setLeadId('');
    setAgentId('');
  };

  const viewAgentAsTeamLeader = (targetAgentId) => {
    navigate(`/admin/agent/${targetAgentId}`, {
      state: {
        returnTo: `/admin/team-leader/${currentUser.id}`,
        returnLabel: `Back to ${getTeamName(currentUser.teamId, data.teams)}`,
        impersonatedFrom: currentUser.id,
      },
    });
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1); // Reset to first page on sort
  };

  return (
    <div style={{ minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--crm-text-primary)' }}>Team Portfolio</h2>
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginTop: 2 }}>{getTeamName(currentUser.teamId, data.teams)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canCreateAgent && (
            <button
              className="crm-super-admin-btn"
              style={{ background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 700 }}
              onClick={() => setShowCreateAgent(true)}
            >
              + Add Agent
            </button>
          )}
          <span className="crm-badge" style={{ background: 'rgba(69,210,160,0.1)', color: '#45d2a0', border: '1px solid #45d2a040', padding: '3px 10px', borderRadius: 4, fontSize: 12 }}>{onlineAgents} Online</span>
          <span className="crm-badge" style={{ background: 'color-mix(in srgb, var(--crm-accent) 8%, transparent)', color: 'var(--crm-accent)', border: '1px solid color-mix(in srgb, var(--crm-accent) 19%, transparent)', padding: '3px 10px', borderRadius: 4, fontSize: 12 }}>{teamAgents.length} Agents</span>
        </div>
      </div>

      <div className="crm-super-admin-header crm-role-panel-header" style={{ marginBottom: 20 }}>
        <div className="crm-super-admin-tabs">
          {[['overview', 'Overview'], ['agents', 'Agents'], ['leads', 'Client Management'], ['assign', 'Assign']].map(([key, label]) => (
            <button key={key} className={`crm-super-admin-tab-btn ${activeTab === key ? 'crm-active' : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
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
        fallbackTab="agents"
      />

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Leads', value: teamLeads.length, color: 'var(--crm-text-primary)' },
              { label: 'Deposits', value: agentStats.reduce((s, a) => s + a.successfulDeposits, 0), color: '#45d2a0' },
              { label: 'Conversion', value: teamLeads.length > 0 ? ((agentStats.reduce((s, a) => s + a.successfulDeposits, 0) / teamLeads.length) * 100).toFixed(1) + '%' : '0%', color: 'var(--crm-accent)' },
              { label: 'Unassigned', value: teamLeads.filter(l => !l.assignedToAgent).length, color: '#0A84FF' },
              {
                label: 'Active Leads',
                value: teamLeads.filter(l => (l.stage || l.status || '').toLowerCase() === 'active').length,
                color: '#0ECB81',
                title: 'Active agency leads',
              },
              {
                label: 'New Leads',
                value: teamLeads.filter(l => (l.stage || l.status || '').toLowerCase() === 'new').length,
                color: '#F59E0B',
                title: 'New incoming leads',
              },
              { label: 'Online / Total', value: onlineAgents + ' / ' + teamAgents.length, color: '#45d2a0' },
            ].map(s => (
              <div
                key={s.label}
                title={s.title}
                onClick={s.onClick}
                style={{
                  background: 'var(--crm-card)',
                  border: '1px solid var(--crm-border)',
                  borderTop: '2px solid ' + s.color,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: s.onClick ? 'pointer' : 'default',
                }}
              >
                <div style={{ color: 'var(--crm-text-secondary)', fontSize: 11, marginBottom: 6 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: '1.3rem', fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="crm-super-admin-card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Performance</h3>
            <div className="crm-super-admin-table-wrapper">
              <table className="crm-super-admin-table">
                <thead>
                  <tr><th>#</th><th>Agent</th><th style={{ textAlign: 'center' }}>Leads</th><th style={{ textAlign: 'center' }}>Deposits</th><th style={{ textAlign: 'center' }}>Conv.</th><th style={{ textAlign: 'center' }}>Comments</th><th style={{ textAlign: 'center' }}>Status</th></tr>
                </thead>
                <tbody>
                  {agentStats.sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate)).map((agent, idx) => {
                    const fullAgent = data.users.find(u => u.id === agent.id);
                    return (
                    <tr
                      key={agent.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => fullAgent && setActiveProfileStaff(fullAgent)}
                      title={`Click to open ${agent.name}'s staff summary`}
                    >
                      <td style={{ color: ['#ffd700', '#c0c0c0', '#cd7f32'][idx] || 'var(--crm-text-secondary)', fontWeight: 700, width: 32 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{agent.email || ''}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{agent.totalLeads}</td>
                      <td style={{ textAlign: 'center', color: '#45d2a0', fontWeight: 600 }}>{agent.successfulDeposits}</td>
                      <td style={{ textAlign: 'center', color: 'var(--crm-accent)', fontWeight: 700 }}>{agent.conversionRate}%</td>
                      <td style={{ textAlign: 'center' }}>{agent.totalComments}</td>
                      <td style={{ textAlign: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: agent.isLoggedIn ? '#45d2a0' : 'var(--crm-text-secondary)', display: 'inline-block' }}></span></td>
                    </tr>
                    );
                  })}
                  {agentStats.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 20 }}>No agents in this team.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'agents' && (
        <div className="crm-super-admin-card">
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
            Click any agent on a row to open their staff profile modal and manage their account.
          </div>
          <div className="crm-super-admin-table-wrapper">
            <table className="crm-super-admin-table">
              <thead>
                <tr><th>Agent</th><th style={{ textAlign: 'center' }}>Status</th><th>Last Login</th><th style={{ textAlign: 'center' }}>Leads</th><th style={{ textAlign: 'center' }}>Deposits</th><th style={{ textAlign: 'center' }}>Conv.</th><th style={{ textAlign: 'center' }}>Today</th></tr>
              </thead>
              <tbody>
                {agentStats.map(agent => {
                  const fullAgent = data.users.find(u => u.id === agent.id);
                  return (
                  <tr
                    key={agent.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => fullAgent && setActiveProfileStaff(fullAgent)}
                    title={`Click to open ${agent.name}'s staff profile`}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{agent.email || agent.id}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: agent.isLoggedIn ? 'rgba(69,210,160,0.1)' : 'rgba(107,114,128,0.1)', color: agent.isLoggedIn ? '#45d2a0' : 'var(--crm-text-secondary)', border: '1px solid ' + (agent.isLoggedIn ? '#45d2a040' : 'color-mix(in srgb, var(--crm-text-secondary) 25%, transparent)'), padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{agent.isLoggedIn ? 'Online' : 'Offline'}</span>
                    </td>
                    <td style={{ color: 'var(--crm-text-secondary)', fontSize: 11 }}>{fullAgent?.lastLoginAt ? new Date(fullAgent.lastLoginAt).toLocaleString() : '-'}</td>
                    <td style={{ textAlign: 'center' }}>{agent.totalLeads}</td>
                    <td style={{ textAlign: 'center', color: '#45d2a0', fontWeight: 600 }}>{agent.successfulDeposits}</td>
                    <td style={{ textAlign: 'center', color: 'var(--crm-accent)', fontWeight: 700 }}>{agent.conversionRate}%</td>
                    <td style={{ textAlign: 'center', color: '#0A84FF' }}>{agent.todaysComments}</td>
                  </tr>
                  );
                })}
                {agentStats.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 20 }}>No agents in this team.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 2fr) repeat(5, minmax(100px, 1fr)) auto auto', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
            <SearchAutocomplete
              className="crm-super-admin-input"
              placeholder="Search name, email, phone..."
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); setPage(1); }}
              fetchSuggestions={searchAdminLeads}
              style={{ minWidth: 0, width: '100%' }}
              buildSuggestions={(q) => {
                const ql = q.toLowerCase();
                return teamLeads
                  .filter(l => {
                    const full = `${l.firstName || ''} ${l.lastName || ''}`.toLowerCase();
                    return (
                      full.includes(ql) ||
                      (l.email || '').toLowerCase().includes(ql) ||
                      (l.phone || '').toLowerCase().includes(ql)
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
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="crm-super-admin-select" style={{ minWidth: 0, width: '100%' }}>
              <option value="">All Statuses</option>
              {['New', 'In Line', 'Deposit', 'Failed Deposit', 'No Answer', 'Not Interested'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setPage(1); }} className="crm-super-admin-select" style={{ minWidth: 0, width: '100%' }}>
              <option value="">All Countries</option>
              {[...new Set(teamLeads.map(l => l.country))].sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }} className="crm-super-admin-select" style={{ minWidth: 0, width: '100%' }}>
              <option value="">All Agents</option>
              <option value="__unassigned__">Unassigned</option>
              {teamAgents.map(a => {
                const stats = agentStats.find(s => s.id === a.id);
                return <option key={a.id} value={a.id}>{a.name} ({stats ? stats.totalLeads : 0})</option>;
              })}
            </select>
            {(searchQuery || filterStatus || filterCountry || filterAgent) && (
              <button className="crm-super-admin-btn" style={{ background: 'rgba(255,100,100,0.12)', border: '1px solid #ff6464', color: '#ff6464', whiteSpace: 'nowrap' }} onClick={() => { setSearchQuery(''); setFilterStatus(''); setFilterCountry(''); setFilterAgent(''); setPage(1); }}>&#x2715; Clear</button>
            )}
            <button
              className="crm-super-admin-btn"
              style={{ background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 700, whiteSpace: 'nowrap' }}
              onClick={() => setShowCreateLead(true)}
            >
              + New Lead
            </button>
          </div>
          {bulkSelectedLeads.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', background: 'color-mix(in srgb, var(--crm-accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--crm-accent) 19%, transparent)', borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ fontSize: 12, color: 'var(--crm-accent)', fontWeight: 600 }}>{bulkSelectedLeads.length} selected</span>
              <select value={bulkAgentId} onChange={e => setBulkAgentId(e.target.value)} className="crm-super-admin-select" style={{ minWidth: 160 }}>
                <option value="">Assign to agent...</option>
                {teamAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button className="crm-super-admin-btn" style={{ background: '#45d2a0', color: '#FFFFFF' }} onClick={handleBulkAssign}>Assign</button>
              <button className="crm-super-admin-btn" style={{ background: 'rgba(255,100,100,0.12)', border: '1px solid #ff6464', color: '#ff6464' }} onClick={() => setBulkSelectedLeads([])}>Clear</button>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>Showing {paginatedLeads.length} of {totalFiltered} leads (page {page}/{Math.max(1, totalPages)})</div>
          <div className="crm-super-admin-card" style={{ padding: 0 }}>
            <div className="crm-super-admin-table-wrapper">
              <table className="crm-super-admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}><input type="checkbox" checked={bulkSelectedLeads.length === filteredLeadIds.length && filteredLeadIds.length > 0} onChange={e => handleSelectAllLeads(e.target.checked)} /></th>
                    <th>Client ID</th><th>Name</th><th>Country</th><th>Status</th><th>Agent</th><th style={{ textAlign: 'center' }}>Comments</th><th>Registered</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map(lead => {
                    const stage = normalizeStage(lead.stage);
                    const stagePillColor = stageColor(stage);
                    return (
                      <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/team-leader/${currentUser.id}/lead/${lead.id}`, { state: { returnTo: `/admin/team-leader/${currentUser.id}`, returnLabel: 'Back to Team', impersonatedFrom: currentUser.id } })}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={bulkSelectedLeads.includes(lead.id)} onChange={() => toggleLeadSelection(lead.id)} /></td>
                        <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{lead.id ? lead.id.slice(0, 6) : '-'}</span>
                            {lead.id && <button title={lead.id} onClick={() => navigator.clipboard.writeText(lead.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                          </div>
                        </td>
                        <td><div style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</div><div style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.email}</div></td>
                        <td>{getCountryFlag(lead.countryCode, lead.country)} {lead.country || '-'}</td>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <StatusDropdown
                            value={stage}
                            options={LEAD_STATUSES}
                            onChange={async (newStage) => {
                              if (updateLead) {
                                await updateLead(lead.id, { stage: newStage, status: newStage });
                                showNotification?.(`Status updated to "${newStage}".`);
                              }
                            }}
                          />
                        </td>
                        <td style={{ fontSize: 12 }}>{getUserName(lead.assignedToAgent, data.users) || <span style={{ color: 'var(--crm-text-secondary)' }}>Unassigned</span>}</td>
                        <td style={{ textAlign: 'center', fontSize: 12 }}>{(lead.commentHistory || []).length}</td>
                        <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.registeredDate || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-')}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <button
                            title="Edit lead profile"
                            onClick={(e) => { e.stopPropagation(); setEditLead(lead); }}
                            style={{ background: 'transparent', border: '1px solid var(--crm-border)', color: 'var(--crm-text-primary)', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 }}
                          >Edit</button>
                          <button
                            title="Add comment"
                            onClick={(e) => { e.stopPropagation(); setCommentLead(lead); }}
                            style={{ background: 'transparent', border: '1px solid var(--crm-border)', color: 'var(--crm-text-primary)', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                          >💬</button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedLeads.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 24 }}>No leads match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {showCreateLead && createLead && (
            <CreateLeadModal
              scope={{ officeId: currentUser.officeId, teamId: currentUser.teamId, teamLeaderId: currentUser.id }}
              teamsForOffice={[]}
              agents={teamAgents}
              onClose={() => setShowCreateLead(false)}
              onCreate={async (payload) => {
                const created = await createLead(payload);
                if (created) setShowCreateLead(false);
              }}
            />
          )}

          {editLead && updateLead && (
            <EditLeadModal
              lead={editLead}
              onClose={() => setEditLead(null)}
              onSave={(updates) => {
                updateLead(editLead.id, { ...updates, _actorName: currentUser.name, _actorId: currentUser.id });
                setEditLead(null);
              }}
            />
          )}

          {commentLead && updateLead && (
            <AddCommentModal
              leadName={`${commentLead.firstName || ''} ${commentLead.lastName || ''}`.trim()}
              onClose={() => setCommentLead(null)}
              onSubmit={(text) => {
                updateLead(commentLead.id, {
                  comment: text,
                  lastCommentDate: new Date().toISOString().slice(0, 10),
                  _actorName: currentUser.name,
                  _actorId: currentUser.id,
                });
                setCommentLead(null);
              }}
            />
          )}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <button onClick={() => setPage(1)} disabled={page === 1} className="crm-super-admin-btn" style={{ padding: '5px 10px' }}>«</button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="crm-super-admin-btn" style={{ padding: '5px 10px' }}>‹</button>
              <span style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="crm-super-admin-btn" style={{ padding: '5px 10px' }}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="crm-super-admin-btn" style={{ padding: '5px 10px' }}>»</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'assign' && (
        <AssignTab
          teamLeads={teamLeads}
          teamAgents={teamAgents}
          agentStats={agentStats}
          showNotification={showNotification}
          onBulkReassign={handleBulkReassign}
          data={data}
        />
      )}

      {canCreateAgent && showCreateAgent && (
        <CreateAgentModal
          team={data.teams.find((team) => team.id === currentUser.teamId)}
          onClose={() => setShowCreateAgent(false)}
          onCreate={async (name, password) => {
            const created = await createAgent(currentUser.teamId, name, password);
            if (created) showNotification('Agent created.');
            return created;
          }}
        />
      )}

      {activeProfileStaff && (
        <StaffProfileModal
          staff={activeProfileStaff}
          onClose={() => setActiveProfileStaff(null)}
          data={data}
          currentUser={currentUser}
          setData={setData}
          toggleStaffBlocked={toggleStaffBlocked}
          setUserLoginState={setUserLoginState}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}

export default TeamLeaderPanel;
