import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeadProfilePath } from '../leadProfileRouting.js';
import { ROLE, getCountryFlag, LEAD_STATUSES } from '../shared.jsx';
import { portalDb } from '../../../services/portalDatabase';
import { enterClientPortal } from '../clientImpersonation.js';
import {
  getUserProfileHistoryApi,
  adminSetClientPassword,
  updateLeadApi,
  resetLeadStatusApi,
  clearLeadCommentsApi,
  clearProfileHistoryApi,
  deleteProfileHistoryEntryApi,
  deleteLeadApi,
  getAdminMessages,
  sendAdminMessage,
  markAdminMessagesRead,
} from '../adminApi.js';
import { useConfirmDialog } from './ConfirmModal/ConfirmModal.jsx';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  try {
    const timestamp = new Date(dateString).getTime();
    if (isNaN(timestamp)) return dateString;
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export default function LeadProfileModal({
  lead,
  onClose,
  data,
  currentUser,
  setData,
  setLeadAssignment,
  showNotification,
}) {
  const navigate = useNavigate();
  const [confirmDialog, confirm] = useConfirmDialog();

  const [profileStage, setProfileStage] = useState('');
  const [profileComment, setProfileComment] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [reassignOfficeId, setReassignOfficeId] = useState('');
  const [reassignTeamId, setReassignTeamId] = useState('');
  const [reassignTeamLeaderId, setReassignTeamLeaderId] = useState('');
  const [reassignAgentId, setReassignAgentId] = useState('');

  const [profileViewTab, setProfileViewTab] = useState('overview');
  const [liveClientPassword, setLiveClientPassword] = useState('');
  const [showClientPassword, setShowClientPassword] = useState(true);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [portalAccessEnabled, setPortalAccessEnabled] = useState(true);

  // Client Support chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatMessagesEndRef = useRef(null);

  // Client Activity state
  const [clientActivityData, setClientActivityData] = useState({ logs: [], stats: { pageViews: 0, sessions: 0, lastLogin: '' } });

  const [profileHistory, setProfileHistory] = useState([]);
  const [profileHistoryLoading, setProfileHistoryLoading] = useState(false);
  const [profileHistoryError, setProfileHistoryError] = useState('');
  const isSuperAdmin = currentUser?.role === ROLE.SUPER_ADMIN;

  useEffect(() => {
    if (!lead) return;
    setProfileViewTab('overview');
    setProfileStage(lead.stage || lead.status || 'New');
    setProfileComment(lead.comment || '');
    setProfileNotes(lead.notes || '');
    setReassignOfficeId(lead.assignedToOffice || lead.assigned_office_id || '');
    setReassignTeamId(lead.assignedToTeam || lead.assigned_team_id || '');
    setReassignTeamLeaderId(lead.assignedToTeamLeader || lead.assigned_team_leader_id || '');
    setReassignAgentId(lead.assignedToAgent || lead.assigned_agent_id || '');

    const currentPwd = portalDb.getClientPassword(lead.id) || lead.clientPassword || lead.client_password || '';
    setLiveClientPassword(currentPwd);
    setClientActivityData(portalDb.getClientActivity(lead.id));
    setChatMessages([]);

    getAdminMessages(lead.id, { limit: 200 })
      .then(async (res) => {
        setChatMessages(res?.messages || []);
        if (res?.messages?.some((message) => message.sender === 'client' && !message.readAt)) {
          await markAdminMessagesRead(lead.id);
        }
      })
      .catch((error) => {
        showNotification(error?.message || 'Could not load client messages.');
      });

    setProfileHistory([]);
    setProfileHistoryError('');
    setProfileHistoryLoading(true);

    if (lead.id) {
      getUserProfileHistoryApi(lead.id)
        .then(({ entries }) => {
          setProfileHistory(entries || []);
        })
        .catch((err) => {
          setProfileHistoryError(err?.message || 'Failed to load change history.');
        })
        .finally(() => {
          setProfileHistoryLoading(false);
        });
    } else {
      setProfileHistoryLoading(false);
    }
  }, [lead]);

  // Real-time synchronization for Support Chat and Passwords
  useEffect(() => {
    if (!lead?.id) return;
    const handleChatUpdate = () => {
      setChatMessages(portalDb.getDirectChatMessages(lead.id));
      setClientActivityData(portalDb.getClientActivity(lead.id));
    };
    const handlePwdUpdate = (e) => {
      if (e.detail?.clientId === lead.id) {
        setLiveClientPassword(e.detail.password);
      }
    };
    window.addEventListener('cdx_chat_message_received', handleChatUpdate);
    window.addEventListener('cdx_client_password_updated', handlePwdUpdate);
    return () => {
      window.removeEventListener('cdx_chat_message_received', handleChatUpdate);
      window.removeEventListener('cdx_client_password_updated', handlePwdUpdate);
    };
  }, [lead?.id]);

  useEffect(() => {
    if (profileViewTab === 'chat' && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, profileViewTab]);

  const handleSavePassword = async () => {
    const pwd = newPasswordInput.trim();
    if (!pwd || !lead?.id) return;
    setIsUpdatingPassword(true);
    try {
      await adminSetClientPassword(lead.id, pwd);
      setLiveClientPassword(pwd);
      setNewPasswordInput('');

      if (setData) {
        setData((prev) => ({
          ...prev,
          leads: (prev.leads || []).map((l) =>
            l.id === lead.id ? { ...l, clientPassword: pwd, client_password: pwd } : l
          ),
        }));
      }
      setClientActivityData(portalDb.getClientActivity(lead.id));
      showNotification('Client portal password updated successfully.');
    } catch (error) {
      showNotification(`Failed to update client portal password: ${error?.message || 'Please try again.'}`);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLaunchClientPortal = async () => {
    try {
      await enterClientPortal(lead.id);
    } catch (error) {
      showNotification(error?.message || 'Could not launch the client portal.');
    }
  };

  const handleTogglePortalAccess = () => {
    const nextState = !portalAccessEnabled;
    try {
      portalDb.adminTogglePortalAccess(lead.id, nextState);
    } catch (_) {}
    setPortalAccessEnabled(nextState);
    fetch('/api/crm/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_portal_access', client_id: lead.id, portal_enabled: nextState }),
    }).catch(() => {});
    showNotification(`Client portal access ${nextState ? 'enabled' : 'disabled'} for ${lead.name}`);
  };

  const handleSendChatMessage = async (e) => {
    e?.preventDefault?.();
    const text = chatInputText.trim();
    if (!text || !lead?.id) return;
    setChatSending(true);
    try {
      const newMsg = await sendAdminMessage(lead.id, text);
      setChatMessages((prev) => [...prev, newMsg]);
      setChatInputText('');
      showNotification('Message sent to client portal.');
    } catch (error) {
      showNotification(error?.message || 'Could not send the client message.');
    } finally {
      setChatSending(false);
    }
  };

  if (!lead) return null;

  const profileOffice = data?.offices?.find(
    (o) => o.id === (lead.assignedToOffice || lead.assigned_office_id)
  );
  const profileTeam = data?.teams?.find(
    (t) => t.id === (lead.assignedToTeam || lead.assigned_team_id)
  );
  const profileAgent = data?.users?.find(
    (u) => u.id === (lead.assignedToAgent || lead.assigned_agent_id)
  );

  const enterLeadAccount = async () => {
    if (!lead?.id) {
      showNotification('Invalid client.');
      return;
    }
    try {
      await enterClientPortal(lead.id);
    } catch (err) {
      console.error('Failed to enter client account:', err);
      showNotification(err?.message || 'Could not enter client account.');
    }
  };

  const saveProfile = async () => {
    if (!lead) return;

    if (setLeadAssignment) {
      setLeadAssignment({
        leadId: lead.id,
        officeId: reassignOfficeId || null,
        teamId: reassignTeamId || null,
        teamLeaderId: reassignTeamLeaderId || null,
        agentId: reassignAgentId || null,
      });
    }

    const apiUpdates = {};
    if (profileStage !== (lead.stage || lead.status)) {
      apiUpdates.stage = profileStage;
    }
    if (profileComment.trim()) {
      apiUpdates.comment = profileComment.trim();
    }
    if (profileNotes !== (lead.notes || '')) {
      apiUpdates.notes = profileNotes;
    }

    const now = new Date().toISOString();
    const optimisticHistory = [...(lead.commentHistory || [])];
    if (apiUpdates.comment) {
      optimisticHistory.push({
        id: `c_${Date.now()}`,
        author: currentUser?.name || 'Admin',
        text: profileComment.trim(),
        timestamp: now,
      });
    }

    if (setData) {
      setData((prev) => ({
        ...prev,
        leads: (prev.leads || []).map((l) =>
          l.id === lead.id
            ? {
                ...l,
                stage: profileStage,
                status: profileStage,
                notes: profileNotes,
                commentHistory: optimisticHistory,
                assignedToOffice: reassignOfficeId || null,
                assignedToTeam: reassignTeamId || null,
                assignedToTeamLeader: reassignTeamLeaderId || null,
                assignedToAgent: reassignAgentId || null,
              }
            : l
        ),
      }));
    }

    if (lead.id && Object.keys(apiUpdates).length > 0) {
      updateLeadApi(lead.id, apiUpdates)
        .then((serverLead) => {
          if (serverLead && setData) {
            setData((prev) => ({
              ...prev,
              leads: (prev.leads || []).map((l) => (l.id === serverLead.id ? { ...l, ...serverLead } : l)),
            }));
          }
        })
        .catch((err) => {
          console.error('[LeadProfileModal] saveProfile failed', err);
          showNotification('Could not save stage/comment to the server.');
        });
    }

    showNotification(`${lead.firstName || lead.name || 'Lead'} updated.`);
    onClose();
  };

  const unassignLead = () => {
    if (!lead) return;
    if (setLeadAssignment) {
      setLeadAssignment({ leadId: lead.id, officeId: null, teamId: null, teamLeaderId: null, agentId: null });
    }
    if (setData) {
      setData((prev) => ({
        ...prev,
        leads: (prev.leads || []).map((l) =>
          l.id === lead.id
            ? { ...l, assignedToOffice: null, assignedToTeam: null, assignedToTeamLeader: null, assignedToAgent: null }
            : l
        ),
      }));
    }
    showNotification(`${lead.firstName || lead.name || 'Lead'} returned to pool.`);
    onClose();
  };

  const resetLeadStatus = async () => {
    if (!lead) return;
    const ok = await confirm({
      title: 'Reset Status Workflow?',
      message: `This will reset "${lead.firstName || lead.name}" back to New and permanently erase the entire status history. This cannot be undone.`,
      confirmLabel: 'Reset & Erase',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await resetLeadStatusApi(lead.id);
      setProfileStage('New');
      if (setData) {
        setData((prev) => ({
          ...prev,
          leads: (prev.leads || []).map((l) => (l.id === updated.id ? { ...l, ...updated, status: 'New', stage: 'New' } : l)),
        }));
      }
      showNotification(`Status reset to New for ${lead.firstName || lead.name}.`);
    } catch (err) {
      console.error('[LeadProfileModal] resetLeadStatus failed', err);
      showNotification('Could not reset status - please try again.');
    }
  };

  const clearLeadComments = async () => {
    if (!lead) return;
    const ok = await confirm({
      title: 'Delete All Comments?',
      message: `This will permanently delete every comment on "${lead.firstName || lead.name}"'s profile. This cannot be undone.`,
      confirmLabel: 'Delete All Comments',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await clearLeadCommentsApi(lead.id);
      if (setData) {
        setData((prev) => ({
          ...prev,
          leads: (prev.leads || []).map((l) => (l.id === updated.id ? { ...l, ...updated, commentHistory: [] } : l)),
        }));
      }
      showNotification(`All comments deleted for ${lead.firstName || lead.name}.`);
    } catch (err) {
      console.error('[LeadProfileModal] clearLeadComments failed', err);
      showNotification('Could not delete comments - please try again.');
    }
  };

  const deleteLead = async () => {
    if (!lead) return;
    const ok = await confirm({
      title: 'Move lead to bin?',
      message: `Move "${lead.firstName || lead.name}" to the recycle bin? You can restore it later from the bin.`,
      confirmLabel: 'Move to bin',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      if (setData) {
        setData((prev) => ({
          ...prev,
          leads: (prev.leads || []).filter((l) => l.id !== lead.id),
          deletedLeads: [...(prev.deletedLeads || []), { ...lead, deletedAt: new Date().toISOString() }],
        }));
      }
      await deleteLeadApi(lead.id);
      showNotification(`Moved "${lead.firstName || lead.name}" to the recycle bin.`);
      onClose();
    } catch (err) {
      console.error('[LeadProfileModal] deleteLead failed', err);
      showNotification('Could not move lead to bin.');
    }
  };

  const displayName = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client Profile';
  const submissionTime = lead.createdAt || lead.registeredDate;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 2000,
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'var(--crm-card, #23242A)',
            border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.1))',
            borderRadius: 18,
            width: '100%',
            maxWidth: 880,
            padding: 28,
            position: 'relative',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0, flex: '1 1 240px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: lead.isOnline ? '#30D158' : '#8E8E93',
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    color: lead.isOnline ? '#30D158' : '#8E8E93',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {lead.isOnline ? 'Online' : 'Offline'}
                </span>
                {submissionTime && (
                  <span style={{ fontSize: 11.5, color: 'var(--crm-text-secondary, #8E8E93)', marginLeft: 8 }}>
                    · Customer submission {formatRelativeTime(submissionTime)}
                  </span>
                )}
              </div>
              <h2 style={{ margin: '0 0 4px', color: 'var(--crm-text-primary, #FFFFFF)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {displayName}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--crm-text-secondary, #8E8E93)' }}>
                {lead.email || 'No email'} {lead.phone ? ` · ${lead.phone}` : ''}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: '0 0 auto',
                marginLeft: 'auto',
                flexWrap: 'nowrap',
              }}
            >
              <button
                style={{
                  background: 'var(--crm-accent, #0A84FF)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  padding: '8px 18px',
                  borderRadius: 9999,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  minWidth: 120,
                  boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)',
                }}
                onClick={() => {
                  onClose();
                  navigate(getLeadProfilePath(ROLE.SUPER_ADMIN, currentUser?.id || 'adm_sa', lead.id));
                }}
                title="Open the full client profile page"
              >
                Open Profile
              </button>
              <button
                style={{
                  background: 'rgba(48, 209, 88, 0.15)',
                  color: '#30D158',
                  border: '1px solid rgba(48, 209, 88, 0.3)',
                  fontWeight: 600,
                  padding: '8px 18px',
                  borderRadius: 9999,
                  cursor: 'pointer',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  minWidth: 120,
                }}
                onClick={enterLeadAccount}
                title="Log in directly to this client's portal account (bypassing password)"
              >
                Enter Client Account
              </button>
              <button
                onClick={onClose}
                className="crm-modal-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Reach Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'rgba(10, 132, 255, 0.15)',
                  color: '#0A84FF',
                  border: '1px solid rgba(10, 132, 255, 0.3)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="Send email"
              >
                <span>✉ Email Customer: {lead.email}</span>
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'rgba(52, 199, 89, 0.15)',
                  color: '#34C759',
                  border: '1px solid rgba(52, 199, 89, 0.3)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="Call lead"
              >
                <span>☎ Direct Call: {lead.phone}</span>
              </a>
            )}
            {lead.phone && (
              <a
                href={`https://wa.me/${String(lead.phone).replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Hi ${lead.firstName || lead.name || 'there'}, thank you for contacting Codex Dynamics.`)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'rgba(37, 211, 102, 0.15)',
                  color: '#25D366',
                  border: '1px solid rgba(37, 211, 102, 0.3)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="WhatsApp chat"
              >
                <span>💬 WhatsApp Direct</span>
              </a>
            )}
          </div>

          {/* Tab Navigation: Profile / Lead Security / Client Support / Activity */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 20,
              paddingBottom: 14,
              borderBottom: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))',
              flexWrap: 'wrap',
            }}
          >
            {[
              { id: 'overview', label: '📋 Profile & Scope', color: '#0A84FF' },
              { id: 'security', label: '🔒 Client Security', color: '#FF453A' },
              { id: 'chat', label: `💬 Client Support ${chatMessages.length ? `(${chatMessages.length})` : ''}`, color: '#30D158' },
              { id: 'activity', label: '📊 Client Activity', color: '#0A84FF' },
            ].map((tab) => {
              const isActive = profileViewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProfileViewTab(tab.id)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 9999,
                    border: '1px solid',
                    borderColor: isActive ? tab.color : 'var(--crm-border, rgba(255, 255, 255, 0.1))',
                    background: isActive ? tab.color : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? '#FFFFFF' : 'var(--crm-text-secondary, #8E8E93)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: LEAD SECURITY */}
          {profileViewTab === 'security' && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))', borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 700 }}>
                    🔒 Client Account Security &amp; Credentials
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--crm-text-secondary, #8E8E93)' }}>
                    Administrators can view current client portal passwords and set new passwords when clients experience login issues.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleTogglePortalAccess}
                    style={{
                      fontSize: 11,
                      background: portalAccessEnabled ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                      color: portalAccessEnabled ? '#30D158' : '#FF453A',
                      border: `1px solid ${portalAccessEnabled ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 69, 58, 0.3)'}`,
                      padding: '5px 12px',
                      borderRadius: 9999,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {portalAccessEnabled ? '● Portal Enabled' : '○ Portal Suspended'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchClientPortal}
                    style={{
                      fontSize: 12,
                      background: '#0A84FF',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🚀 Launch Portal As Client</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                {/* Account Details */}
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                    Portal Username / Login Email
                  </div>
                  <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600, fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{lead.email || 'No email assigned'}</span>
                    {lead.email && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(lead.email); showNotification('Email copied to clipboard'); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--crm-accent, #0A84FF)', cursor: 'pointer', fontSize: 12 }}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>

                {/* Current Password with Show/Hide & Copy */}
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-accent, #0A84FF)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                    Current Portal Password
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type={showClientPassword ? 'text' : 'password'}
                      readOnly
                      value={liveClientPassword || ''}
                      placeholder="No password set"
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 6,
                        color: '#FFFFFF',
                        padding: '6px 10px',
                        fontSize: 13,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientPassword(!showClientPassword)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {showClientPassword ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(liveClientPassword || '');
                        setPasswordCopied(true);
                        setTimeout(() => setPasswordCopied(false), 2000);
                        showNotification('Password copied to clipboard');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(10, 132, 255, 0.3)',
                        background: 'rgba(10, 132, 255, 0.15)',
                        color: '#0A84FF',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {passwordCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Set New Password Form */}
              <div style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary, #8E8E93)', fontWeight: 600, marginBottom: 8 }}>
                  Set New Password For Client Account
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password (e.g. client2026!)..."
                    style={{
                      flex: '1 1 240px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 8,
                      color: '#FFFFFF',
                      padding: '9px 12px',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSavePassword}
                    disabled={isUpdatingPassword || !newPasswordInput.trim()}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: !newPasswordInput.trim() ? 'rgba(255, 255, 255, 0.08)' : '#0ECB81',
                      color: !newPasswordInput.trim() ? '#8E8E93' : '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: !newPasswordInput.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Save & Update Password'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', marginTop: 8 }}>
                  Updating the password here immediately unlocks the client's login at <code style={{ color: '#0A84FF' }}>/portal/login</code>.
                </div>
              </div>

              {/* Direct Portal Launch Banner */}
              <div style={{ marginTop: 14, background: 'rgba(10, 132, 255, 0.08)', border: '1px solid rgba(10, 132, 255, 0.25)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                    🚀 Direct Client Portal Session
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', marginTop: 2 }}>
                    Open the live workspace for <strong>{lead.name}</strong> to inspect their websites, project progress, invoices, and file vault.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLaunchClientPortal}
                  style={{
                    background: '#0A84FF',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Open /portal/dashboard &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CLIENT SUPPORT CHAT */}
          {profileViewTab === 'chat' && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))', borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 700 }}>
                    💬 Client Support Channel: {displayName}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--crm-text-secondary, #8E8E93)' }}>
                    Direct communication thread with the client. Messages sent here are instantly visible in the Client Portal Support section.
                  </p>
                </div>
                <span style={{ fontSize: 11, background: 'rgba(10, 132, 255, 0.15)', color: '#0A84FF', padding: '4px 10px', borderRadius: 9999, fontWeight: 600 }}>
                  Real-time Sync
                </span>
              </div>

              {/* Chat Message Stream */}
              <div
                style={{
                  height: 320,
                  overflowY: 'auto',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                {chatMessages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--crm-text-secondary, #8E8E93)', fontSize: 13 }}>
                    No messages in this support channel yet. Type a message below to start communicating with the client.
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isStaff = msg.sender === 'staff' || msg.sender === 'agent';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isStaff ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--crm-text-secondary, #8E8E93)', marginBottom: 3, padding: '0 4px' }}>
                          <span style={{ fontWeight: 600, color: isStaff ? '#0A84FF' : '#30D158' }}>
                            {isStaff ? (msg.senderName || 'Support Agent') : (lead.name || lead.firstName || 'Client')}
                          </span>
                          <span>·</span>
                          <span>{msg.createdAt || msg.timestamp ? new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                        </div>
                        <div
                          style={{
                            maxWidth: '75%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            fontSize: 13,
                            lineHeight: 1.5,
                            background: isStaff ? '#0071E3' : '#2A2A2E',
                            color: '#FFFFFF',
                            border: isStaff ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                          }}
                        >
                          {msg.text || msg.body}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="text"
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  placeholder="Type a response to the client (press Enter to send)..."
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    color: '#FFFFFF',
                    padding: '10px 14px',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInputText.trim()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 10,
                    border: 'none',
                    background: !chatInputText.trim() ? 'rgba(255, 255, 255, 0.08)' : '#0071E3',
                    color: !chatInputText.trim() ? '#8E8E93' : '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: !chatInputText.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {chatSending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: CLIENT ACTIVITY */}
          {profileViewTab === 'activity' && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))', borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 700 }}>
                    📊 Recent Client Activity: {displayName}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--crm-text-secondary, #8E8E93)' }}>
                    Audit history of what this client did in their account, including logins, inquiries, ticket interactions, and navigation.
                  </p>
                </div>
              </div>

              {/* Activity Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Total Page Views
                  </div>
                  <div style={{ fontSize: 20, color: 'var(--crm-accent, #0A84FF)', fontWeight: 700 }}>
                    {clientActivityData.stats?.pageViews || 18}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Active Sessions
                  </div>
                  <div style={{ fontSize: 20, color: '#30D158', fontWeight: 700 }}>
                    {clientActivityData.stats?.sessions || 4}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Last Portal Session
                  </div>
                  <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>
                    {clientActivityData.stats?.lastLogin ? new Date(clientActivityData.stats.lastLogin).toLocaleString() : 'Recent'}
                  </div>
                </div>
              </div>

              {/* Activity Logs Stream */}
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--crm-text-primary, #FFFFFF)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                  Activity Timeline
                </div>
                {(!clientActivityData.logs || clientActivityData.logs.length === 0) ? (
                  <div style={{ color: 'var(--crm-text-secondary, #8E8E93)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
                    No recorded sessions or activities yet for this client account.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                    {clientActivityData.logs.map((log) => {
                      const isLogin = log.action === 'CLIENT_LOGIN';
                      const isTicket = log.action.includes('TICKET');
                      return (
                        <div
                          key={log.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingBottom: 8,
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span
                                style={{
                                  background: isLogin ? 'rgba(48, 209, 88, 0.15)' : isTicket ? 'rgba(10, 132, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                  color: isLogin ? '#30D158' : isTicket ? '#0A84FF' : '#FFFFFF',
                                  borderRadius: 4,
                                  padding: '1px 6px',
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {log.action}
                              </span>
                              <span style={{ color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 600 }}>
                                {log.details}
                              </span>
                            </div>
                            <div style={{ color: 'var(--crm-text-secondary, #8E8E93)', fontSize: 11 }}>
                              IP: {log.ipAddress || '127.0.0.1'} · Source: Client Portal
                            </div>
                          </div>
                          <span style={{ color: 'var(--crm-text-secondary, #8E8E93)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 0: MAIN PROFILE OVERVIEW */}
          {profileViewTab === 'overview' && (
            <>
          {/* Lead Info Grid - 3 Columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Column 1: Core Details */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 18, border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))' }}>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Client Details
              </div>
              {[
                ['Country', lead.country || '-'],
                ['Funnel', lead.funnel || lead.service || '-'],
                ['Affiliate', lead.affiliate || '-'],
                ['Registered', lead.registeredDate || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-')],
                ['Last Comment', lead.lastCommentDate || '-'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--crm-text-secondary, #8E8E93)' }}>{label}</span>
                  <span style={{ color: 'var(--crm-text-primary, #FFFFFF)' }}>
                    {label === 'Country' && getCountryFlag(lead.countryCode, lead.country)}
                    {val}
                  </span>
                </div>
              ))}
            </div>

            {/* Column 2: Customer Intake & Scope (All Enquiry Fields) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 18, border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))' }}>
              <div style={{ fontSize: 11, color: 'var(--crm-accent, #0A84FF)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Customer Intake & Scope
              </div>
              {[
                ['Company / Org', lead.company || 'Individual / None'],
                ['Service Selected', lead.service || lead.funnel || 'General Inquiry'],
                ['Estimated Budget', lead.budget || 'Not specified'],
                ['Target Timeline', lead.timeline || 'Flexible'],
                ['Submission Timestamp', lead.createdAt ? new Date(lead.createdAt).toLocaleString() : (lead.registeredDate || '-')],
                ['Entry Origin', lead.source === 'website_contact_modal' ? 'Website Modal' : lead.source === 'website_contact_form' ? 'Website Form' : (lead.source || 'Direct Inquiry')],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--crm-text-secondary, #8E8E93)' }}>{label}</span>
                  <span
                    style={{
                      color:
                        label === 'Estimated Budget'
                          ? '#30D158'
                          : label === 'Service Selected'
                          ? 'var(--crm-accent, #0A84FF)'
                          : 'var(--crm-text-primary, #FFFFFF)',
                      fontWeight: label === 'Estimated Budget' || label === 'Service Selected' ? 600 : 400,
                    }}
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>

            {/* Column 3: Assignment Chain */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 18, border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))' }}>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Assignment Chain
              </div>
              {[
                ['Office', profileOffice?.name || 'Unassigned (Pool)', !!(lead.assignedToOffice || lead.assigned_office_id)],
                ['Team', profileTeam?.name || '-', !!(lead.assignedToTeam || lead.assigned_team_id)],
                ['Agent', profileAgent?.name || '-', !!(lead.assignedToAgent || lead.assigned_agent_id)],
                ['Assigned By', lead.assignedBy || '-', false],
              ].map(([label, val, active]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--crm-text-secondary, #8E8E93)' }}>{label}</span>
                  <span style={{ color: active ? 'var(--crm-accent, #0A84FF)' : 'var(--crm-text-primary, #FFFFFF)', fontWeight: active ? 600 : 400 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Submission Message */}
          {lead.message && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--crm-text-secondary, #8E8E93)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ color: 'var(--crm-accent, #0A84FF)' }}>💬</span>
                <span>Customer Submission Message</span>
              </div>
              <div
                style={{
                  color: 'var(--crm-text-primary, #FFFFFF)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  fontStyle: 'italic',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.06))',
                }}
              >
                "{lead.message}"
              </div>
            </div>
          )}

          {/* Internal Staff Notes */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--crm-accent)',
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📝</span>
                <span>Internal Staff Follow-Up Notes</span>
              </div>
              <button
                type="button"
                className="crm-super-admin-btn crm-super-admin-btn-small"
                onClick={async () => {
                  if (setData) {
                    setData((prev) => ({
                      ...prev,
                      leads: (prev.leads || []).map((l) =>
                        l.id === lead.id ? { ...l, notes: profileNotes } : l
                      ),
                    }));
                  }
                  if (lead.id) {
                    try {
                      await updateLeadApi(lead.id, { notes: profileNotes });
                    } catch (_) {}
                  }
                  showNotification('Internal staff notes saved.');
                }}
                style={{ padding: '3px 8px', fontSize: 11, background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 600 }}
              >
                Save Note
              </button>
            </div>
            <textarea
              rows={3}
              value={profileNotes}
              onChange={(e) => setProfileNotes(e.target.value)}
              placeholder="Record call logs, client preferences, quotes discussed, or next action steps..."
              style={{
                width: '100%',
                background: '#1D2128',
                border: '1px solid #3C4754',
                borderRadius: 6,
                color: 'var(--crm-text-primary)',
                padding: '8px 10px',
                fontSize: 12.5,
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Stage & Comment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 6 }}>
                Select Status
              </label>
              <select
                className="crm-super-admin-select"
                style={{ width: '100%' }}
                value={profileStage}
                onChange={(e) => setProfileStage(e.target.value)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 6 }}>
                Add New Activity Comment
              </label>
              <textarea
                value={profileComment}
                onChange={(e) => setProfileComment(e.target.value)}
                placeholder="Log activity, call notes or consultation updates..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--crm-card)',
                  border: '1px solid var(--crm-border)',
                  borderRadius: 6,
                  color: 'var(--crm-text-primary)',
                  padding: '8px 10px',
                  resize: 'vertical',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Reassign Controls */}
          {data?.offices && (
            <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                Reassign
              </div>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 12 }}>
                Changing office clears team and agent; choosing a team fills its office and clears agent. Direct Team Leader ownership is preserved when changing office or team. Choosing an agent fills its office/team and clears direct ownership; choosing a direct Team Leader clears the agent.
              </div>

              {/* Quick assign to agent */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-accent)', fontWeight: 600, marginBottom: 4 }}>
                  Quick Assign to Agent
                </div>
                <select
                  className="crm-super-admin-select"
                  style={{ width: '100%' }}
                  value={reassignAgentId}
                  onChange={(e) => {
                    const agentId = e.target.value;
                    setReassignAgentId(agentId);
                    if (agentId) {
                      setReassignTeamLeaderId('');
                      const agent = data.users.find((u) => u.id === agentId);
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
                  {(data.offices || []).map((office) => {
                    const officeAgents = (data.users || []).filter(
                      (u) => u.role === ROLE.AGENT && u.officeId === office.id
                    );
                    if (officeAgents.length === 0) return null;
                    return (
                      <optgroup key={office.id} label={`[office] ${office.name}`}>
                        {officeAgents.map((agent) => {
                          const team = (data.teams || []).find((t) => t.id === agent.teamId);
                          return (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                              {team ? ` (${team.name})` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    );
                  })}
                  {(() => {
                    const independentAgents = (data.users || []).filter(
                      (u) => u.role === ROLE.AGENT && !u.officeId
                    );
                    return independentAgents.length ? (
                      <optgroup label="Independent agents">
                        {independentAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </optgroup>
                    ) : null;
                  })()}
                </select>
              </div>

              {/* Manual office/team override */}
              <div style={{ borderTop: '1px solid var(--crm-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, marginBottom: 8 }}>
                  Or assign to Office / Team only
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Office</div>
                    <select
                      className="crm-super-admin-select"
                      style={{ width: '100%' }}
                      value={reassignOfficeId}
                      onChange={(e) => {
                        setReassignOfficeId(e.target.value);
                        setReassignTeamId('');
                        setReassignAgentId('');
                      }}
                    >
                      <option value="">None (Pool)</option>
                      {(data.offices || []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Team</div>
                    <select
                      className="crm-super-admin-select"
                      style={{ width: '100%' }}
                      value={reassignTeamId}
                      onChange={(e) => {
                        const nextTeamId = e.target.value;
                        setReassignTeamId(nextTeamId);
                        setReassignAgentId('');
                        const nextTeam = (data.teams || []).find((team) => team.id === nextTeamId);
                        if (nextTeamId && nextTeam) setReassignOfficeId(nextTeam.officeId || '');
                      }}
                    >
                      <option value="">None</option>
                      {(data.teams || []).map((t) => {
                        const officeName = (data.offices || []).find((office) => office.id === t.officeId)?.name;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name}{officeName ? ` — ${officeName}` : ' — independent'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isSuperAdmin && data?.users && (
            <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <label htmlFor="lead-team-leader-owner" style={{ display: 'block', fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Direct Team Leader
              </label>
              <p style={{ fontSize: 11, color: 'var(--crm-text-secondary)', margin: '0 0 8px' }}>
                Assign the client directly to a team leader, even when there is no team or agent.
              </p>
              <select
                id="lead-team-leader-owner"
                className="crm-super-admin-select"
                style={{ width: '100%' }}
                value={reassignTeamLeaderId}
                onChange={(e) => {
                  const teamLeaderId = e.target.value;
                  setReassignTeamLeaderId(teamLeaderId);
                  if (teamLeaderId) setReassignAgentId('');
                }}
              >
                <option value="">No direct team leader</option>
                {(data.users || [])
                  .filter((user) => user.role === ROLE.TEAM_LEADER)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}{user.teamId ? ` — ${(data.teams || []).find((team) => team.id === user.teamId)?.name || 'team leader'}` : ' — standalone'}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Comment History */}
          {lead.commentHistory && lead.commentHistory.length > 0 && (
            <div
              style={{
                background: 'var(--crm-card)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--crm-text-secondary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Comment History
              </div>
              {[...lead.commentHistory].reverse().map((entry, i) => (
                <div
                  key={i}
                  style={{ borderBottom: '1px solid var(--crm-border)', paddingBottom: 8, marginBottom: 8, fontSize: 12 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: 'var(--crm-accent)', fontWeight: 600 }}>{entry.author || entry.by || 'Staff'}</span>
                    <span style={{ color: 'var(--crm-text-secondary)' }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : entry.date || ''}
                    </span>
                  </div>
                  <div style={{ color: 'var(--crm-text-primary)' }}>{entry.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Profile Change History (Audit Log) */}
          <div style={{ background: 'var(--crm-card)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--crm-text-secondary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
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
                      await clearProfileHistoryApi(lead.id);
                      setProfileHistory([]);
                    } catch (err) {
                      showNotification('Could not clear profile history: ' + (err.message || 'error'));
                    }
                  }}
                  style={{
                    background: 'rgba(246,70,93,0.12)',
                    border: '1px solid #F6465D55',
                    color: '#F6465D',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'none',
                  }}
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
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {profileHistory.map((entry) => {
                  const isClientAction = !entry.actorAdminId;
                  const changedFields = entry.after ? Object.keys(entry.after) : [];
                  const date = entry.createdAt
                    ? new Date(
                        entry.createdAt.endsWith('Z') ? entry.createdAt : entry.createdAt + 'Z'
                      ).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                    : '-';
                  return (
                    <div
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid var(--crm-border)',
                        paddingBottom: 10,
                        marginBottom: 10,
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              background: isClientAction ? '#1E3A5F' : '#2D3B22',
                              color: isClientAction ? '#3B82F6' : '#0ECB81',
                              borderRadius: 4,
                              padding: '1px 6px',
                              fontSize: 10,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
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
                                await deleteProfileHistoryEntryApi(lead.id, entry.id);
                                setProfileHistory((prev) => prev.filter((e) => e.id !== entry.id));
                              } catch (err) {
                                showNotification('Could not delete entry: ' + (err.message || 'error'));
                              }
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid #F6465D44',
                              color: '#F6465D',
                              borderRadius: 3,
                              padding: '1px 5px',
                              fontSize: 10,
                              cursor: 'pointer',
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                      <div style={{ color: 'var(--crm-text-secondary)', marginBottom: 4 }}>
                        By: <span style={{ color: isClientAction ? 'var(--crm-text-primary)' : 'var(--crm-accent)' }}>{entry.actorName}</span>
                        {entry.ip && <span style={{ color: 'var(--crm-text-secondary)', marginLeft: 8 }}> / IP: {entry.ip}</span>}
                      </div>
                      {changedFields.length > 0 &&
                        changedFields
                          .filter((k) => k !== 'avatar_url')
                          .map((field) => {
                            const before = entry.before?.[field];
                            const after = entry.after?.[field];
                            const fieldLabel =
                              {
                                name: 'Name',
                                email: 'Email',
                                phone: 'Phone',
                                status: 'Status',
                              }[field] || field;
                            if (field === 'password')
                              return (
                                <div key={field} style={{ color: 'var(--crm-text-secondary)', fontStyle: 'italic' }}>
                                  Password changed
                                </div>
                              );
                            if (before === undefined && after !== undefined)
                              return (
                                <div key={field} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <span style={{ color: 'var(--crm-text-secondary)' }}>{fieldLabel}:</span>
                                  <span style={{ color: '#0ECB81' }}>{String(after)}</span>
                                </div>
                              );
                            return (
                              <div
                                key={field}
                                style={{
                                  display: 'flex',
                                  gap: 4,
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span style={{ color: 'var(--crm-text-secondary)' }}>{fieldLabel}:</span>
                                <span
                                  style={{
                                    color: '#F6465D',
                                    textDecoration: 'line-through',
                                  }}
                                >
                                  {before !== undefined && before !== null ? String(before) : '-'}
                                </span>
                                <span style={{ color: 'var(--crm-text-secondary)' }}>→</span>
                                <span style={{ color: '#0ECB81' }}>
                                  {after !== undefined && after !== null ? String(after) : '-'}
                                </span>
                              </div>
                            );
                          })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="crm-super-admin-btn crm-super-admin-btn-small"
                onClick={saveProfile}
                style={{ background: '#0ECB81', color: '#FFFFFF', fontWeight: 600 }}
              >
                💾 Save Changes
              </button>
              <button
                className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
                onClick={unassignLead}
              >
                Return to Pool
              </button>
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
              <button
                className="crm-super-admin-btn crm-super-admin-btn-small"
                style={{ background: '#c0392b', color: '#fff' }}
                onClick={deleteLead}
              >
                🗑 Move to Bin
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
