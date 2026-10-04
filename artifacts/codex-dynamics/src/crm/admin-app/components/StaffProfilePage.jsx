import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ROLE,
  LEAD_STATUSES,
  normalizeStage,
  getOfficeName,
  getTeamName,
  getCountryFlag,
  makeLoginLink,
  StatusDropdown,
} from '../shared.jsx';
import {
  updateStaffApi,
  deleteStaffApi,
  updateOffice,
  deleteOffice,
  updateTeam,
  deleteTeam,
  getStaffCapabilities,
  updateStaffCapabilities,
  getStaffNotesAdmin,
  addStaffNoteAdmin,
  blockStaffApi,
  unblockStaffApi,
} from '../adminApi.js';
import {
  getStaffProfilePath,
  getRoleScopedStaff,
  getRoleWorkspacePath,
  getLeadProfilePath,
} from '../leadProfileRouting.js';
import { useConfirmDialog } from './ConfirmModal/ConfirmModal.jsx';

const DEFAULT_CAPABILITY_CATALOG = {
  lead_upload: 'Lead Upload',
  create_agent: 'Create Agent',
  notifications: 'Notifications',
  security: 'Security',
  content: 'Content',
  enquiries: 'Enquiries',
  chat: 'Chat',
};

const ROLE_BADGE_STYLE = {
  [ROLE.OFFICE_MANAGER]: {
    background: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)',
    color: 'var(--crm-accent)',
    border: '1px solid color-mix(in srgb, var(--crm-accent) 40%, transparent)',
  },
  [ROLE.TEAM_LEADER]: {
    background: 'rgba(69,210,160,0.15)',
    color: '#45d2a0',
    border: '1px solid rgba(69,210,160,0.4)',
  },
  [ROLE.AGENT]: {
    background: 'rgba(52,152,219,0.15)',
    color: '#3498db',
    border: '1px solid rgba(52,152,219,0.4)',
  },
};

function computePasswordStrength(pw) {
  if (!pw) return { level: 0, label: 'Empty' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { level: score, label: labels[score] };
}

export default function StaffProfilePage({
  role,
  viewingUser,
  data,
  setData,
  toggleStaffBlocked,
  setUserLoginState,
  updateLead,
  showNotification,
}) {
  const { userId, staffId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmDialog, confirm] = useConfirmDialog();

  const nameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const currentUser = useMemo(
    () => viewingUser || (data?.users || []).find((u) => u.id === userId),
    [viewingUser, data?.users, userId]
  );

  const scopedStaff = useMemo(
    () => getRoleScopedStaff(data, role, currentUser),
    [data, role, currentUser]
  );

  // Support direct staff user ID, or office_<id> / team_<id> fallback IDs
  const staff = useMemo(() => {
    const foundUser = (data?.users || []).find((u) => u.id === staffId);
    if (foundUser) return foundUser;
    if (staffId && staffId.startsWith('office_')) {
      const rawOfficeId = staffId.replace(/^office_/, '');
      const mgr = (data?.users || []).find(
        (u) => u.role === ROLE.OFFICE_MANAGER && u.officeId === rawOfficeId
      );
      if (mgr) return mgr;
      const office = (data?.offices || []).find((o) => o.id === rawOfficeId);
      if (office) {
        return {
          id: staffId,
          isOfficeOnly: true,
          officeId: office.id,
          role: ROLE.OFFICE_MANAGER,
          name: `${office.name} (Unassigned Manager)`,
          email: '',
          status: 'Active',
        };
      }
    }
    if (staffId && staffId.startsWith('team_')) {
      const rawTeamId = staffId.replace(/^team_/, '');
      const ldr = (data?.users || []).find(
        (u) => u.role === ROLE.TEAM_LEADER && u.teamId === rawTeamId
      );
      if (ldr) return ldr;
      const team = (data?.teams || []).find((t) => t.id === rawTeamId);
      if (team) {
        return {
          id: staffId,
          isTeamOnly: true,
          teamId: team.id,
          officeId: team.officeId,
          role: ROLE.TEAM_LEADER,
          name: `${team.name} (Unassigned Leader)`,
          email: '',
          status: 'Active',
        };
      }
    }
    return null;
  }, [data?.users, data?.offices, data?.teams, staffId]);

  const officeObj = useMemo(() => {
    if (!staff || !data?.offices) return null;
    if (staff.officeId) {
      return data.offices.find((o) => o.id === staff.officeId) || null;
    }
    return data.offices.find((o) => o.managerId === staff.id) || null;
  }, [data?.offices, staff]);

  const teamObj = useMemo(() => {
    if (!staff || !data?.teams) return null;
    if (staff.teamId) {
      return data.teams.find((t) => t.id === staff.teamId) || null;
    }
    return data.teams.find((t) => t.leaderId === staff.id) || null;
  }, [data?.teams, staff]);

  const currentIdx = useMemo(
    () => scopedStaff.findIndex((u) => u.id === staff?.id),
    [scopedStaff, staff?.id]
  );
  const prevStaff = currentIdx > 0 ? scopedStaff[currentIdx - 1] : null;
  const nextStaff =
    currentIdx >= 0 && currentIdx < scopedStaff.length - 1
      ? scopedStaff[currentIdx + 1]
      : null;

  const workspacePath =
    location.state?.returnTo || getRoleWorkspacePath(role, currentUser?.id || userId);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOfficeId, setEditOfficeId] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editOfficeName, setEditOfficeName] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamMaxSize, setEditTeamMaxSize] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [catalog, setCatalog] = useState(DEFAULT_CAPABILITY_CATALOG);
  const [capabilities, setCapabilities] = useState({
    lead_upload: true,
    create_agent: true,
    notifications: true,
    security: true,
    content: true,
    enquiries: true,
    chat: true,
  });
  const [capDirty, setCapDirty] = useState(false);

  const [leadSearch, setLeadSearch] = useState('');
  const [leadStageFilter, setLeadStageFilter] = useState('');
  const [staffNoteInput, setStaffNoteInput] = useState('');
  const [staffNotes, setStaffNotes] = useState([]);
  const [staffNotesLoading, setStaffNotesLoading] = useState(false);
  const [staffNoteSaving, setStaffNoteSaving] = useState(false);
  const [staffNoteError, setStaffNoteError] = useState('');

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setEditName(staff.isOfficeOnly || staff.isTeamOnly ? '' : staff.name || '');
    setEditEmail(staff.email || '');
    setEditOfficeId(officeObj?.id || staff.officeId || teamObj?.officeId || '');
    setEditTeamId(teamObj?.id || staff.teamId || '');
    setEditOfficeName(officeObj?.name || '');
    setEditTeamName(teamObj?.name || '');
    setEditTeamMaxSize(teamObj?.maxSize != null ? String(teamObj.maxSize) : '');
    setNewPassword('');
    setStaffNotesLoading(true);
    setStaffNoteError('');
    const loadNotes = async () => {
      try {
        const notes = await getStaffNotesAdmin(staff.id);
        if (!cancelled) setStaffNotes(notes);
      } catch (error) {
        if (!cancelled) setStaffNoteError(error.message || 'Staff notes could not be loaded.');
      } finally {
        if (!cancelled) setStaffNotesLoading(false);
      }
    };
    void loadNotes();
    return () => { cancelled = true; };
  }, [
    staff?.id,
    staff?.name,
    staff?.email,
    staff?.officeId,
    staff?.teamId,
    staff?.isOfficeOnly,
    staff?.isTeamOnly,
    officeObj?.id,
    officeObj?.name,
    teamObj?.id,
    teamObj?.name,
    teamObj?.maxSize,
    teamObj?.officeId,
  ]);

  useEffect(() => {
    if (!staff?.id || staff.isOfficeOnly || staff.isTeamOnly) return;
    let cancelled = false;
    getStaffCapabilities(staff.id)
      .then((payload) => {
        if (cancelled) return;
        setCatalog({ ...DEFAULT_CAPABILITY_CATALOG, ...(payload?.catalog || {}) });
        setCapabilities({
          lead_upload: true,
          create_agent: true,
          notifications: true,
          security: true,
          content: true,
          enquiries: true,
          chat: true,
          ...(payload?.capabilities || {}),
        });
        setCapDirty(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [staff?.id, staff?.isOfficeOnly, staff?.isTeamOnly]);

  const isVirtual = Boolean(staff?.isOfficeOnly || staff?.isTeamOnly);
  const isBlocked = staff?.status === 'Suspended' || staff?.status === 'Disabled';
  const loginLink = !isVirtual && staff ? staff.loginLink || makeLoginLink(staff.id, staff.role) : '';
  const resolvedOfficeId = officeObj?.id || staff?.officeId || teamObj?.officeId || '';
  const resolvedTeamId = teamObj?.id || staff?.teamId || '';
  const officeName = getOfficeName(resolvedOfficeId, data?.offices || []);
  const teamName = getTeamName(resolvedTeamId, data?.teams || []);

  const panelPath =
    staff?.role === ROLE.OFFICE_MANAGER
      ? `/admin/office-manager/${staff.id}`
      : staff?.role === ROLE.TEAM_LEADER
      ? `/admin/team-leader/${staff.id}`
      : staff ? `/admin/agent/${staff.id}` : '';

  // Office Teams & Agents (for Office Managers) and Team Agents (for Team Leaders)
  const officeTeams = useMemo(() => {
    if (!resolvedOfficeId) return [];
    return (data?.teams || []).filter((t) => t.officeId === resolvedOfficeId);
  }, [data?.teams, resolvedOfficeId]);

  const officeAgents = useMemo(() => {
    if (!resolvedOfficeId) return [];
    return (data?.users || []).filter(
      (u) => u.role === ROLE.AGENT && u.officeId === resolvedOfficeId
    );
  }, [data?.users, resolvedOfficeId]);

  const teamAgents = useMemo(() => {
    if (!resolvedTeamId) return [];
    return (data?.users || []).filter(
      (u) => u.role === ROLE.AGENT && u.teamId === resolvedTeamId
    );
  }, [data?.users, resolvedTeamId]);

  const staffLeads = useMemo(() => {
    if (!staff) return [];
    const allLeads = data?.leads || [];
    if (staff.role === ROLE.OFFICE_MANAGER) {
      return allLeads.filter((l) => l.assignedToOffice === resolvedOfficeId);
    }
    if (staff.role === ROLE.TEAM_LEADER) {
      return allLeads.filter((l) => l.assignedToTeam === resolvedTeamId);
    }
    return allLeads.filter((l) => l.assignedToAgent === staff.id);
  }, [data?.leads, staff, resolvedOfficeId, resolvedTeamId]);

  const filteredLeads = useMemo(() => {
    return staffLeads.filter((lead) => {
      const stage = normalizeStage(lead.stage);
      if (leadStageFilter && stage !== leadStageFilter) return false;
      if (!leadSearch.trim()) return true;
      const q = leadSearch.toLowerCase();
      return (
        `${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        (lead.country || '').toLowerCase().includes(q) ||
        stage.toLowerCase().includes(q)
      );
    });
  }, [staffLeads, leadSearch, leadStageFilter]);

  const depositsCount = staffLeads.filter((l) => l.stage === 'Deposit').length;
  const contactedCount = staffLeads.filter(
    (l) => Array.isArray(l.commentHistory) && l.commentHistory.length > 0
  ).length;
  const conversionRate =
    staffLeads.length > 0 ? ((depositsCount / staffLeads.length) * 100).toFixed(1) : '0.0';

  const staffComments = useMemo(() => {
    if (!staff?.name) return [];
    const allLeads = data?.leads || [];
    const list = [];
    allLeads.forEach((lead) => {
      (lead.commentHistory || []).forEach((c) => {
        if (c && (c.by === staff.name || c.author === staff.name)) {
          list.push({
            ...c,
            leadId: lead.id,
            leadName:
              `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.name || 'Client',
          });
        }
      });
    });
    return list.slice(-40).reverse();
  }, [data?.leads, staff?.name]);

  if (!staff) {
    return (
      <div className="crm-card crm-agent-profile-full">
        <div className="crm-panel-header">
          <button className="crm-small-btn" onClick={() => navigate(workspacePath)}>
            ← Back to Staff
          </button>
        </div>
        <div style={{ padding: 24, color: 'var(--crm-text-secondary)' }}>
          Staff member not found or has been removed.
        </div>
      </div>
    );
  }

  const copyText = async (val, msg = 'Copied to clipboard') => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      showNotification?.(msg);
    } catch {
      showNotification?.('Copy failed, please copy manually.');
    }
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
    setNewPassword(pwd);
    setShowPassword(true);
  };

  const handleSaveDetails = async () => {
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();
    const trimmedOfficeName = editOfficeName.trim();
    const trimmedTeamName = editTeamName.trim();

    if (!isVirtual && !trimmedName) {
      showNotification?.('Staff name cannot be empty.');
      return;
    }

    setSavingDetails(true);
    try {
      // 1. If Office Manager and office exists, save office name if changed
      if (staff.role === ROLE.OFFICE_MANAGER && officeObj && trimmedOfficeName) {
        if (setData) {
          setData((prev) => ({
            ...prev,
            offices: (prev.offices || []).map((o) =>
              o.id === officeObj.id ? { ...o, name: trimmedOfficeName } : o
            ),
          }));
        }
        updateOffice(officeObj.id, { name: trimmedOfficeName }).catch((err) => {
          console.error('[StaffProfilePage] updateOffice failed', err);
        });
      }

      // 2. If Team Leader and team exists, save team name, maxSize, officeId
      if (staff.role === ROLE.TEAM_LEADER && teamObj && trimmedTeamName) {
        const teamPayload = {
          name: trimmedTeamName,
          ...(editTeamMaxSize !== '' ? { maxSize: Number(editTeamMaxSize) } : {}),
          ...(editOfficeId ? { officeId: editOfficeId } : {}),
        };
        if (setData) {
          setData((prev) => ({
            ...prev,
            teams: (prev.teams || []).map((t) =>
              t.id === teamObj.id ? { ...t, ...teamPayload } : t
            ),
          }));
        }
        updateTeam(teamObj.id, teamPayload).catch((err) => {
          console.error('[StaffProfilePage] updateTeam failed', err);
        });
      }

      // 3. Save staff account details if not virtual
      if (!isVirtual) {
        let nextOfficeId = editOfficeId || null;
        const nextTeamId = editTeamId || null;
        if (nextTeamId) {
          const foundTeam = (data?.teams || []).find((t) => t.id === nextTeamId);
          if (foundTeam?.officeId) nextOfficeId = foundTeam.officeId;
        }
        const updates = {
          name: trimmedName,
          email: trimmedEmail,
          officeId: nextOfficeId,
          teamId: nextTeamId,
        };

        if (setData) {
          setData((prev) => ({
            ...prev,
            users: (prev.users || []).map((u) => (u.id === staff.id ? { ...u, ...updates } : u)),
          }));
        }
        const updated = await updateStaffApi(staff.id, updates);
        if (setData && updated) {
          setData((prev) => ({
            ...prev,
            users: (prev.users || []).map((u) =>
              u.id === staff.id ? { ...u, ...updates, ...updated } : u
            ),
          }));
        }
      }

      showNotification?.('Profile and organization settings updated.');
    } catch (err) {
      console.error('[StaffProfilePage] handleSaveDetails failed', err);
      showNotification?.('Profile saved locally.');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSavePassword = async () => {
    if (isVirtual) return;
    const pwd = newPassword.trim();
    if (!pwd) {
      showNotification?.('Enter or generate a password first.');
      return;
    }
    setSavingPassword(true);
    if (setData) {
      setData((prev) => ({
        ...prev,
        users: (prev.users || []).map((u) => (u.id === staff.id ? { ...u, password: pwd } : u)),
      }));
    }
    try {
      const updated = await updateStaffApi(staff.id, { password: pwd });
      if (setData && updated) {
        setData((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) =>
            u.id === staff.id ? { ...u, ...updated, password: updated.password || pwd } : u
          ),
        }));
      }
      setNewPassword('');
      showNotification?.(`Password updated for ${staff.name}.`);
    } catch (err) {
      console.error('[StaffProfilePage] handleSavePassword failed', err);
      showNotification?.('Could not save password on the server.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleBlock = async () => {
    if (isVirtual) return;
    if (typeof toggleStaffBlocked === 'function') {
      const updated = await toggleStaffBlocked(staff.id, isBlocked);
      if (updated) {
        const nowBlocked = updated.status === 'Suspended' || updated.status === 'Disabled';
        showNotification?.(`${staff.name} has been ${nowBlocked ? 'blocked' : 'unblocked'}.`);
      }
      return;
    }
    try {
      const fn = isBlocked ? unblockStaffApi : blockStaffApi;
      const updated = await fn(staff.id);
      if (setData && updated) {
        setData((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) =>
            u.id === staff.id ? { ...u, status: updated.status } : u
          ),
        }));
      }
      showNotification?.(`${staff.name} has been ${isBlocked ? 'unblocked' : 'blocked'}.`);
    } catch (err) {
      showNotification?.(err?.message || 'Could not update staff status.');
    }
  };

  const handleDeleteStaff = async () => {
    if (isVirtual) return;
    const ok = await confirm({
      title: 'Delete staff member permanently?',
      message: `Delete "${staff.name}" (${staff.role})? Their account will be permanently removed and their assigned leads will return to the pool.`,
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    });
    if (!ok) return;
    if (setData) {
      setData((prev) => ({
        ...prev,
        users: (prev.users || []).filter((u) => u.id !== staff.id),
        leads: (prev.leads || []).map((l) =>
          l.assignedToAgent === staff.id
            ? {
                ...l,
                assignedToAgent: null,
                assignedAgentName: null,
              }
            : l
        ),
      }));
    }
    showNotification?.(`${staff.name} deleted. Returning to staff list.`);
    deleteStaffApi(staff.id).catch((err) => {
      console.error('[StaffProfilePage] deleteStaffApi failed', err);
    });
    navigate(workspacePath);
  };

  const handleDeleteOffice = async () => {
    if (!officeObj) return;
    const ok = await confirm({
      title: 'Delete office permanently?',
      message: `Delete "${officeObj.name}"? All staff in this office and their teams will be permanently deleted. Their leads will return to the unassigned pool.`,
      confirmLabel: 'Delete office',
      tone: 'danger',
    });
    if (!ok) return;
    const officeStaffIds = (data?.users || [])
      .filter((u) => u.officeId === officeObj.id)
      .map((u) => u.id);
    const officeTeamIds = (data?.teams || [])
      .filter((t) => t.officeId === officeObj.id)
      .map((t) => t.id);

    if (setData) {
      setData((prev) => ({
        ...prev,
        offices: (prev.offices || []).filter((o) => o.id !== officeObj.id),
        teams: (prev.teams || []).filter((t) => t.officeId !== officeObj.id),
        users: (prev.users || []).filter((u) => u.officeId !== officeObj.id),
        leads: (prev.leads || []).map((l) =>
          officeStaffIds.includes(l.assignedToAgent) ||
          officeTeamIds.includes(l.assignedToTeam) ||
          l.assignedToOffice === officeObj.id
            ? {
                ...l,
                assignedToAgent: null,
                assignedToTeam: null,
                assignedToOffice: null,
                assignedAgentName: null,
                assignedTeamName: null,
                assignedOfficeName: null,
              }
            : l
        ),
      }));
    }
    showNotification?.(`Office "${officeObj.name}" and its staff deleted.`);
    deleteOffice(officeObj.id).catch((err) => {
      console.error('[StaffProfilePage] deleteOffice failed', err);
    });
    navigate(workspacePath);
  };

  const handleDeleteTeam = async () => {
    if (!teamObj) return;
    const ok = await confirm({
      title: 'Delete team permanently?',
      message: `Delete "${teamObj.name}"? All staff in this team will be permanently deleted. Their leads will return to the unassigned pool.`,
      confirmLabel: 'Delete team',
      tone: 'danger',
    });
    if (!ok) return;
    const teamStaffIds = (data?.users || [])
      .filter((u) => u.teamId === teamObj.id)
      .map((u) => u.id);

    if (setData) {
      setData((prev) => ({
        ...prev,
        teams: (prev.teams || []).filter((t) => t.id !== teamObj.id),
        users: (prev.users || []).filter((u) => u.teamId !== teamObj.id),
        leads: (prev.leads || []).map((l) =>
          teamStaffIds.includes(l.assignedToAgent) || l.assignedToTeam === teamObj.id
            ? {
                ...l,
                assignedToAgent: null,
                assignedToTeam: null,
                assignedToOffice: null,
                assignedAgentName: null,
                assignedTeamName: null,
                assignedOfficeName: null,
              }
            : l
        ),
      }));
    }
    showNotification?.(`Team "${teamObj.name}" and its staff deleted.`);
    deleteTeam(teamObj.id).catch((err) => {
      console.error('[StaffProfilePage] deleteTeam failed', err);
    });
    navigate(workspacePath);
  };

  const handleAddStaffNote = async () => {
    const text = staffNoteInput.trim();
    if (!text || !staff?.id || staffNoteSaving) return;
    setStaffNoteSaving(true);
    setStaffNoteError('');
    try {
      const result = await addStaffNoteAdmin(staff.id, text);
      if (result?.note) setStaffNotes((previous) => [result.note, ...previous]);
      setStaffNoteInput('');
      showNotification?.('Staff note saved.');
    } catch (error) {
      setStaffNoteError(error.message || 'Staff note could not be saved.');
      showNotification?.(error.message || 'Staff note could not be saved.');
    } finally {
      setStaffNoteSaving(false);
    }
  };

  const pwStrength = computePasswordStrength(newPassword);

  return (
    <>
      {confirmDialog}
      <div className="crm-card crm-agent-profile-full">
        {/* Top Navigation Header */}
        <div className="crm-panel-header">
          <div className="crm-nav-left">
            <button
              className="crm-small-btn"
              onClick={() => {
                navigate(workspacePath);
              }}
            >
              ← Back to Staff
            </button>
          </div>
          <div className="crm-nav-right">
            <button
              className="crm-small-btn"
              onClick={() =>
                prevStaff &&
                navigate(getStaffProfilePath(role, currentUser?.id || userId, prevStaff.id), {
                  state: location.state,
                })
              }
              disabled={!prevStaff}
            >
              ◀ Prev Staff
            </button>
            <button
              className="crm-small-btn"
              onClick={() =>
                nextStaff &&
                navigate(getStaffProfilePath(role, currentUser?.id || userId, nextStaff.id), {
                  state: location.state,
                })
              }
              disabled={!nextStaff}
            >
              Next Staff ▶
            </button>
          </div>
        </div>

        {/* Hero Title & Action Bar */}
        <div
          className="crm-section-title"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              {!isVirtual && (
                <>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: staff.isLoggedIn ? '#0ECB81' : 'var(--crm-text-secondary)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      color: staff.isLoggedIn ? '#0ECB81' : 'var(--crm-text-secondary)',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {staff.isLoggedIn ? 'Online' : 'Offline'}
                  </span>
                </>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  ...(ROLE_BADGE_STYLE[staff.role] || ROLE_BADGE_STYLE[ROLE.AGENT]),
                }}
              >
                {staff.role}
              </span>
              <span className={`crm-badge ${isBlocked ? 'crm-badge-danger' : 'crm-badge-success'}`}>
                {isVirtual ? 'Unassigned Account' : isBlocked ? 'Blocked' : 'Active'}
              </span>
            </div>
            <h2 style={{ margin: 0 }}>
              {staff.role === ROLE.OFFICE_MANAGER
                ? `Office & Manager Profile: ${staff.name}`
                : staff.role === ROLE.TEAM_LEADER
                ? `Team & Leader Profile: ${staff.name}`
                : `Staff Profile: ${staff.name}`}
            </h2>
            {(officeObj || teamObj) && (
              <div style={{ fontSize: 12.5, color: 'var(--crm-text-secondary)', marginTop: 4 }}>
                {officeObj ? `Office: ${officeObj.name}` : ''}
                {officeObj && teamObj ? ' · ' : ''}
                {teamObj ? `Team: ${teamObj.name}` : ''}
              </div>
            )}
          </div>

          {!isVirtual && (
            <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
              <button
                className="crm-small-btn crm-action-btn crm-login-btn"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() =>
                  navigate(panelPath, {
                    state: {
                      returnTo: getStaffProfilePath(role, currentUser?.id || userId, staff.id),
                      returnLabel: `Back to ${staff.name}'s Profile`,
                      impersonatedFrom: currentUser?.id,
                    },
                  })
                }
              >
                ↗ View {staff.role} Workspace Panel
              </button>
            </div>
          )}

          <div className="crm-profile-action-buttons">
            {!isVirtual && (
              <button
                type="button"
                className="crm-action-btn crm-activity-btn"
                onClick={() => copyText(loginLink, 'Login link copied to clipboard')}
                title="Copy staff login link"
              >
                🔗 Copy Login Link
              </button>
            )}
            <button
              type="button"
              className="crm-action-btn crm-appointment-btn"
              onClick={() => nameInputRef.current?.focus()}
              title="Edit profile and organization details"
            >
              ✏️ Edit Profile
            </button>
            {!isVirtual && (
              <>
                <button
                  type="button"
                  className="crm-action-btn crm-security-btn"
                  onClick={() => passwordInputRef.current?.focus()}
                  title="Change staff password"
                >
                  🔑 Change Password
                </button>
                <button
                  type="button"
                  className="crm-action-btn crm-support-btn"
                  onClick={handleToggleBlock}
                  title={isBlocked ? 'Unblock staff account' : 'Block staff account'}
                >
                  {isBlocked ? '🔓 Unblock Staff' : '🔒 Block Staff'}
                </button>
              </>
            )}
            {!isVirtual && typeof setUserLoginState === 'function' && (
              <button
                type="button"
                className="crm-action-btn"
                style={{
                  background: 'rgba(14,203,129,0.14)',
                  color: '#0ECB81',
                  border: '1px solid rgba(14,203,129,0.35)',
                }}
                onClick={() => {
                  setUserLoginState(staff.id, !staff.isLoggedIn);
                  showNotification?.(
                    staff.isLoggedIn ? `${staff.name} set offline.` : `${staff.name} set online.`
                  );
                }}
              >
                {staff.isLoggedIn ? '○ Set Offline' : '● Set Online'}
              </button>
            )}
            {!isVirtual && (
              <button
                type="button"
                className="crm-action-btn"
                style={{
                  background: 'rgba(246,70,93,0.15)',
                  color: '#F6465D',
                  border: '1px solid rgba(246,70,93,0.4)',
                }}
                onClick={handleDeleteStaff}
                title="Delete staff account"
              >
                🗑 Delete Staff Account
              </button>
            )}
            {staff.role === ROLE.OFFICE_MANAGER && officeObj && (
              <button
                type="button"
                className="crm-action-btn"
                style={{
                  background: 'rgba(246,70,93,0.22)',
                  color: '#F6465D',
                  border: '1px solid rgba(246,70,93,0.5)',
                }}
                onClick={handleDeleteOffice}
                title="Delete entire office and its teams/staff"
              >
                🏢 Delete Entire Office
              </button>
            )}
            {staff.role === ROLE.TEAM_LEADER && teamObj && (
              <button
                type="button"
                className="crm-action-btn"
                style={{
                  background: 'rgba(246,70,93,0.22)',
                  color: '#F6465D',
                  border: '1px solid rgba(246,70,93,0.5)',
                }}
                onClick={handleDeleteTeam}
                title="Delete entire team and its staff"
              >
                👥 Delete Entire Team
              </button>
            )}
          </div>
        </div>

        {/* Quick Direct Contact & Link Bar */}
        {!isVirtual && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 18px', flexWrap: 'wrap' }}>
            {staff.email && (
              <a
                href={`mailto:${staff.email}`}
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
              >
                <span>✉ Email: {staff.email}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => copyText(loginLink, 'Login link copied to clipboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)',
                color: 'var(--crm-accent)',
                border: '1px solid color-mix(in srgb, var(--crm-accent) 30%, transparent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>🔗 Login URL: {loginLink}</span>
            </button>
          </div>
        )}

        {/* 3-Column Detail Grid */}
        <div className="crm-detail-grid crm-detail-grid-three">
          <div className="crm-detail-column">
            <div className="crm-detail-row">
              <span className="crm-label">Staff ID</span>
              <span className="crm-value" style={{ fontFamily: 'monospace' }}>
                {staff.id}{' '}
                <button
                  type="button"
                  className="crm-copy-icon"
                  onClick={() => copyText(staff.id, 'Staff ID copied')}
                  aria-label="Copy staff ID"
                >
                  📋
                </button>
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Name</span>
              <span className="crm-value">{staff.name}</span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Email</span>
              <span className="crm-value">
                {staff.email || '-'}{' '}
                {staff.email && (
                  <button
                    type="button"
                    className="crm-copy-icon"
                    onClick={() => copyText(staff.email, 'Email copied')}
                    aria-label="Copy email"
                  >
                    📋
                  </button>
                )}
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Role</span>
              <span className="crm-value" style={{ color: 'var(--crm-accent)', fontWeight: 700 }}>
                {staff.role}
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Status</span>
              <span className="crm-value">
                <span className={`crm-badge ${isBlocked ? 'crm-badge-danger' : 'crm-badge-success'}`}>
                  {isVirtual ? 'Unassigned' : isBlocked ? 'Blocked' : 'Active'}
                </span>
              </span>
            </div>
          </div>

          <div className="crm-detail-column">
            <div className="crm-detail-row">
              <span className="crm-label">Office</span>
              <span className="crm-value">{officeName}</span>
            </div>
            {staff.role === ROLE.OFFICE_MANAGER ? (
              <>
                <div className="crm-detail-row">
                  <span className="crm-label">Teams in Office</span>
                  <span className="crm-value">{officeTeams.length}</span>
                </div>
                <div className="crm-detail-row">
                  <span className="crm-label">Agents in Office</span>
                  <span className="crm-value">{officeAgents.length}</span>
                </div>
              </>
            ) : (
              <>
                <div className="crm-detail-row">
                  <span className="crm-label">Team</span>
                  <span className="crm-value">{teamName}</span>
                </div>
                {staff.role === ROLE.TEAM_LEADER && (
                  <div className="crm-detail-row">
                    <span className="crm-label">Team Capacity</span>
                    <span className="crm-value">
                      {teamAgents.length} / {teamObj?.maxSize || '-'} Agents
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="crm-detail-row">
              <span className="crm-label">Presence</span>
              <span
                className="crm-value"
                style={{ color: staff.isLoggedIn ? '#0ECB81' : 'var(--crm-text-secondary)', fontWeight: 600 }}
              >
                {staff.isLoggedIn ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Last Login</span>
              <span className="crm-value">
                {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>

          <div className="crm-detail-column">
            <div className="crm-detail-row">
              <span className="crm-label">
                {staff.role === ROLE.OFFICE_MANAGER
                  ? 'Office Leads'
                  : staff.role === ROLE.TEAM_LEADER
                  ? 'Team Leads'
                  : 'Assigned Leads'}
              </span>
              <span className="crm-value" style={{ color: '#0A84FF', fontWeight: 700 }}>
                {staffLeads.length}
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Total Deposits</span>
              <span className="crm-value" style={{ color: '#0ECB81', fontWeight: 700 }}>
                {depositsCount}
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Conversion Rate</span>
              <span className="crm-value" style={{ color: 'var(--crm-accent)', fontWeight: 700 }}>
                {conversionRate}%
              </span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Contacted Leads</span>
              <span className="crm-value">{contactedCount}</span>
            </div>
            <div className="crm-detail-row">
              <span className="crm-label">Comments Logged</span>
              <span className="crm-value">{staffComments.length}</span>
            </div>
          </div>
        </div>

        {/* Main Two-Column Profile Workspace */}
        <div className="crm-profile-grid" style={{ marginTop: 20 }}>
          {/* Left Column: Edit Profile & Office/Team, Password & Security, Capabilities, Supervision Notes */}
          <div className="crm-profile-column crm-comment-column">
            {/* Profile & Organization Editor */}
            <div className="crm-comment-card" style={{ marginBottom: 18 }}>
              <h3>
                {staff.role === ROLE.OFFICE_MANAGER
                  ? '✏️ Edit Office & Manager Profile'
                  : staff.role === ROLE.TEAM_LEADER
                  ? '✏️ Edit Team & Team Leader Profile'
                  : '✏️ Edit Staff Profile & Assignment'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                {staff.role === ROLE.OFFICE_MANAGER && officeObj && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-accent)', marginBottom: 4, fontWeight: 600 }}>
                      Office Name
                    </label>
                    <input
                      className="crm-super-admin-input"
                      type="text"
                      value={editOfficeName}
                      onChange={(e) => setEditOfficeName(e.target.value)}
                      placeholder="Office name..."
                    />
                  </div>
                )}

                {staff.role === ROLE.TEAM_LEADER && teamObj && (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#45d2a0', marginBottom: 4, fontWeight: 600 }}>
                        Team Name
                      </label>
                      <input
                        className="crm-super-admin-input"
                        type="text"
                        value={editTeamName}
                        onChange={(e) => setEditTeamName(e.target.value)}
                        placeholder="Team name..."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#45d2a0', marginBottom: 4, fontWeight: 600 }}>
                        Max Agents
                      </label>
                      <input
                        className="crm-super-admin-input"
                        type="number"
                        min="1"
                        value={editTeamMaxSize}
                        onChange={(e) => setEditTeamMaxSize(e.target.value)}
                        placeholder="e.g. 10"
                      />
                    </div>
                  </div>
                )}

                {!isVirtual && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>
                        {staff.role === ROLE.OFFICE_MANAGER
                          ? 'Manager Full Name'
                          : staff.role === ROLE.TEAM_LEADER
                          ? 'Team Leader Full Name'
                          : 'Staff Full Name'}
                      </label>
                      <input
                        ref={nameInputRef}
                        className="crm-super-admin-input"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Full name..."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>
                        Email Address
                      </label>
                      <input
                        className="crm-super-admin-input"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="email@codexdynamics.com"
                      />
                    </div>
                  </>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: staff.role === ROLE.OFFICE_MANAGER ? '1fr' : '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>
                      Assigned Office
                    </label>
                    <select
                      className="crm-super-admin-select"
                      value={editOfficeId}
                      onChange={(e) => {
                        setEditOfficeId(e.target.value);
                        if (staff.role === ROLE.AGENT) setEditTeamId('');
                      }}
                    >
                      <option value="">- Unassigned -</option>
                      {(data?.offices || []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {staff.role !== ROLE.OFFICE_MANAGER && (
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>
                        Assigned Team
                      </label>
                      <select
                        className="crm-super-admin-select"
                        value={editTeamId}
                        onChange={(e) => {
                          const nextTeam = e.target.value;
                          setEditTeamId(nextTeam);
                          if (nextTeam) {
                            const t = (data?.teams || []).find((team) => team.id === nextTeam);
                            if (t?.officeId) setEditOfficeId(t.officeId);
                          }
                        }}
                      >
                        <option value="">- Unassigned -</option>
                        {(data?.teams || [])
                          .filter((t) => !editOfficeId || t.officeId === editOfficeId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({getOfficeName(t.officeId, data?.offices || [])})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="crm-post-comment-btn"
                    disabled={savingDetails || (!isVirtual && !editName.trim())}
                    onClick={handleSaveDetails}
                  >
                    {savingDetails ? 'Saving...' : '✓ Save Profile Changes'}
                  </button>
                </div>
              </div>
            </div>

            {/* Security & Password Card */}
            {!isVirtual && (
              <div className="crm-comment-card" style={{ marginBottom: 18 }}>
                <h3>🔑 Security, Password &amp; Account Access</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>Change Password</span>
                    <button
                      type="button"
                      className="crm-pw-generate"
                      onClick={generateStrongPassword}
                      style={{ cursor: 'pointer', fontSize: 11 }}
                    >
                      ⚡ Generate Strong Password
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      ref={passwordInputRef}
                      className="crm-super-admin-input"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter or generate new password..."
                      autoComplete="new-password"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="crm-small-btn"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {newPassword && (
                    <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>
                      Strength: <strong style={{ color: 'var(--crm-accent)' }}>{pwStrength.label}</strong> (
                      {newPassword.length} chars)
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className={`crm-staff-action-btn ${isBlocked ? 'btn-unblock' : 'btn-block'}`}
                      onClick={handleToggleBlock}
                    >
                      {isBlocked ? '🔓 Unblock Account' : '🔒 Block Account'}
                    </button>
                    <button
                      type="button"
                      className="crm-post-comment-btn"
                      disabled={savingPassword || !newPassword.trim()}
                      onClick={handleSavePassword}
                    >
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Capabilities Card */}
            {!isVirtual && (
              <div className="crm-comment-card" style={{ marginBottom: 18 }}>
                <h3>🛡️ CRM Capabilities &amp; Permissions</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginTop: 10,
                    marginBottom: 12,
                  }}
                >
                  {Object.entries(catalog).map(([key, label]) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--crm-bg)',
                        border: '1px solid var(--crm-border)',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!capabilities[key]}
                        onChange={(e) => {
                          setCapabilities((prev) => ({ ...prev, [key]: e.target.checked }));
                          setCapDirty(true);
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="crm-post-comment-btn"
                    disabled={!capDirty}
                    onClick={async () => {
                      try {
                        await updateStaffCapabilities(staff.id, capabilities);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('codex-capabilities-updated', {
                              detail: { staffId: staff.id, capabilities },
                            })
                          );
                        }
                      } catch {}
                      setCapDirty(false);
                      showNotification?.(`Capabilities updated for ${staff.name}.`);
                    }}
                  >
                    Save Capabilities
                  </button>
                </div>
              </div>
            )}

            {/* Staff Supervision Notes */}
            <div className="crm-comment-card">
              <h3>📝 Staff Supervision Notes</h3>
              {staffNotesLoading && <p role="status">Loading saved notes…</p>}
              {staffNoteError && <p role="alert" className="crm-error-text">{staffNoteError}</p>}
              <div className="crm-comment-input-area">
                <textarea
                  rows={4}
                  value={staffNoteInput}
                  onChange={(e) => setStaffNoteInput(e.target.value)}
                  placeholder={`Add an internal note or performance review note for ${staff.name}...`}
                />
                <div className="crm-comment-input-actions">
                  <button
                    type="button"
                    className="crm-post-comment-btn"
                    onClick={handleAddStaffNote}
                    disabled={!staffNoteInput.trim() || staffNoteSaving}
                  >
                    {staffNoteSaving ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>
              {staffNotes.length > 0 && (
                <ul className="crm-comment-history-list" style={{ marginTop: 12 }}>
                  {staffNotes.map((n) => (
                    <li key={n.id} className="crm-comment-history-item">
                      <div className="crm-comment-meta">
                        <span className="crm-comment-author">{n.by}</span>
                        <span className="crm-comment-date">{n.date}</span>
                      </div>
                      <div className="crm-comment-text">{n.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column: Office Teams / Team Agents Roster, Assigned Leads & Activity Timeline */}
          <div className="crm-status-workflow-column">
            {/* For Office Managers: Teams in this Office */}
            {staff.role === ROLE.OFFICE_MANAGER && (
              <div className="crm-status-workflow-card" style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 12px 0' }}>
                  🏢 Teams in {officeName} ({officeTeams.length})
                </h3>
                {officeTeams.length === 0 ? (
                  <div className="crm-status-timeline-empty">
                    No teams created in this office yet.
                  </div>
                ) : (
                  <div className="crm-super-admin-table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    <table className="crm-super-admin-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Team Leader</th>
                          <th style={{ textAlign: 'center' }}>Agents</th>
                          <th style={{ textAlign: 'center' }}>Leads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {officeTeams.map((t) => {
                          const tl = (data?.users || []).find(
                            (u) => u.role === ROLE.TEAM_LEADER && u.teamId === t.id
                          );
                          const tAgentsCount = (data?.users || []).filter(
                            (u) => u.role === ROLE.AGENT && u.teamId === t.id
                          ).length;
                          const tLeadsCount = (data?.leads || []).filter(
                            (l) => l.assignedToTeam === t.id
                          ).length;
                          const targetStaffId = tl ? tl.id : `team_${t.id}`;
                          return (
                            <tr
                              key={t.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                navigate(
                                  getStaffProfilePath(role, currentUser?.id || userId, targetStaffId),
                                  { state: location.state }
                                )
                              }
                              title={`Open profile for ${tl ? tl.name : t.name}`}
                            >
                              <td style={{ fontWeight: 600 }}>{t.name}</td>
                              <td>
                                {tl ? (
                                  <span style={{ color: '#45d2a0', fontWeight: 600 }}>{tl.name}</span>
                                ) : (
                                  <span style={{ color: 'var(--crm-text-secondary)' }}>Unassigned</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {tAgentsCount} / {t.maxSize || '-'}
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--crm-accent)', fontWeight: 700 }}>
                                {tLeadsCount}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* For Office Managers or Team Leaders: Agents Roster */}
            {(staff.role === ROLE.OFFICE_MANAGER || staff.role === ROLE.TEAM_LEADER) && (
              <div className="crm-status-workflow-card" style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 12px 0' }}>
                  👥 {staff.role === ROLE.OFFICE_MANAGER ? `Agents in ${officeName}` : `Agents in ${teamName}`} (
                  {staff.role === ROLE.OFFICE_MANAGER ? officeAgents.length : teamAgents.length})
                </h3>
                {(staff.role === ROLE.OFFICE_MANAGER ? officeAgents : teamAgents).length === 0 ? (
                  <div className="crm-status-timeline-empty">
                    No agents assigned yet.
                  </div>
                ) : (
                  <div className="crm-super-admin-table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    <table className="crm-super-admin-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          {staff.role === ROLE.OFFICE_MANAGER && <th>Team</th>}
                          <th>Status</th>
                          <th style={{ textAlign: 'center' }}>Leads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(staff.role === ROLE.OFFICE_MANAGER ? officeAgents : teamAgents).map((ag) => {
                          const agLeads = (data?.leads || []).filter(
                            (l) => l.assignedToAgent === ag.id
                          ).length;
                          const agBlocked = ag.status === 'Suspended' || ag.status === 'Disabled';
                          return (
                            <tr
                              key={ag.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                navigate(
                                  getStaffProfilePath(role, currentUser?.id || userId, ag.id),
                                  { state: location.state }
                                )
                              }
                              title={`Open profile for ${ag.name}`}
                            >
                              <td style={{ fontWeight: 600 }}>{ag.name}</td>
                              {staff.role === ROLE.OFFICE_MANAGER && (
                                <td style={{ color: 'var(--crm-text-secondary)' }}>
                                  {getTeamName(ag.teamId, data?.teams || [])}
                                </td>
                              )}
                              <td>
                                <span
                                  className={`crm-badge ${
                                    agBlocked ? 'crm-badge-danger' : 'crm-badge-success'
                                  }`}
                                >
                                  {agBlocked ? 'Blocked' : ag.isLoggedIn ? 'Online' : 'Active'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', color: '#0A84FF', fontWeight: 700 }}>
                                {agLeads}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Assigned Leads Portfolio */}
            <div className="crm-status-workflow-card" style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0 }}>
                  📋{' '}
                  {staff.role === ROLE.OFFICE_MANAGER
                    ? `Office Leads (${filteredLeads.length})`
                    : staff.role === ROLE.TEAM_LEADER
                    ? `Team Leads (${filteredLeads.length})`
                    : `Assigned Leads (${filteredLeads.length})`}
                </h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="crm-super-admin-input"
                    style={{ width: 170, padding: '5px 8px', fontSize: 12 }}
                    placeholder="Search leads..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                  />
                  <select
                    className="crm-super-admin-select"
                    style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
                    value={leadStageFilter}
                    onChange={(e) => setLeadStageFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="crm-status-timeline-empty">
                  No leads match the current filter for {staff.name}.
                </div>
              ) : (
                <div className="crm-super-admin-table-wrapper" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className="crm-super-admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Country</th>
                        <th>Status</th>
                        <th>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.slice(0, 50).map((lead) => (
                        <tr
                          key={lead.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            navigate(getLeadProfilePath(role, currentUser?.id || userId, lead.id))
                          }
                          title="Click to open client Lead Profile"
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {lead.firstName} {lead.lastName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.email}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {getCountryFlag(lead.countryCode, lead.country)} {lead.country || '-'}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <StatusDropdown
                              value={normalizeStage(lead.stage)}
                              options={LEAD_STATUSES}
                              onChange={async (newStage) => {
                                if (updateLead) {
                                  await updateLead(lead.id, {
                                    stage: newStage,
                                    status: newStage,
                                    _actorName: currentUser?.name,
                                    _actorId: currentUser?.id,
                                  });
                                  showNotification?.(`Status updated to "${newStage}".`);
                                }
                              }}
                            />
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>
                            {lead.registeredDate || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Staff Activity & Comment History */}
            <div className="crm-status-workflow-card">
              <h3>💬 Lead Interactions &amp; Comment History ({staffComments.length})</h3>
              <div className="crm-status-timeline">
                {staffComments.length === 0 ? (
                  <div className="crm-status-timeline-empty">
                    No client comments recorded by {staff.name} yet.
                  </div>
                ) : (
                  staffComments.map((entry, idx) => (
                    <div
                      key={idx}
                      className="crm-status-timeline-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        entry.leadId &&
                        navigate(getLeadProfilePath(role, currentUser?.id || userId, entry.leadId))
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <strong style={{ color: 'var(--crm-accent)', fontSize: 12 }}>
                          Client: {entry.leadName}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{entry.date || ''}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--crm-text-primary)' }}>{entry.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
