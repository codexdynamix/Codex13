import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ROLE,
  getOfficeName,
  getTeamName,
} from '../shared.jsx';
import { getStaffProfilePath, getRoleWorkspacePath } from '../leadProfileRouting.js';

const ROLE_BADGE_STYLE = {
  [ROLE.OFFICE_MANAGER]: {
    background: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)',
    color: 'var(--crm-accent)',
    border: '1px solid color-mix(in srgb, var(--crm-accent) 35%, transparent)',
  },
  [ROLE.TEAM_LEADER]: {
    background: 'rgba(69,210,160,0.15)',
    color: '#45d2a0',
    border: '1px solid rgba(69,210,160,0.35)',
  },
  [ROLE.AGENT]: {
    background: 'rgba(52,152,219,0.15)',
    color: '#3498db',
    border: '1px solid rgba(52,152,219,0.35)',
  },
};

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return (parts.map((p) => p[0] || '').join('') || '?').slice(0, 2).toUpperCase();
}

export default function StaffProfileModal({
  staff,
  onClose,
  data,
  currentUser,
  showNotification,
}) {
  const navigate = useNavigate();

  const liveStaff = useMemo(() => {
    if (!staff) return null;
    if (staff.isOfficeOnly && staff.officeId) {
      const mgr = (data?.users || []).find(
        (u) => u.role === ROLE.OFFICE_MANAGER && u.officeId === staff.officeId
      );
      if (mgr) return mgr;
      return staff;
    }
    if (staff.isTeamOnly && staff.teamId) {
      const ldr = (data?.users || []).find(
        (u) => u.role === ROLE.TEAM_LEADER && u.teamId === staff.teamId
      );
      if (ldr) return ldr;
      return staff;
    }
    return (data?.users || []).find((u) => u.id === staff.id) || staff;
  }, [data?.users, staff]);

  const isVirtual = Boolean(liveStaff?.isOfficeOnly || liveStaff?.isTeamOnly);
  const isBlocked = liveStaff?.status === 'Suspended' || liveStaff?.status === 'Disabled';

  const officeObj = useMemo(() => {
    if (!data?.offices || !liveStaff) return null;
    if (liveStaff.officeId) {
      return data.offices.find((o) => o.id === liveStaff.officeId) || null;
    }
    return data.offices.find((o) => o.managerId === liveStaff.id) || null;
  }, [data?.offices, liveStaff]);

  const teamObj = useMemo(() => {
    if (!data?.teams || !liveStaff) return null;
    if (liveStaff.teamId) {
      return data.teams.find((t) => t.id === liveStaff.teamId) || null;
    }
    return data.teams.find((t) => t.leaderId === liveStaff.id) || null;
  }, [data?.teams, liveStaff]);

  const resolvedOfficeId = officeObj?.id || liveStaff?.officeId || teamObj?.officeId || '';
  const resolvedTeamId = teamObj?.id || liveStaff?.teamId || '';

  const officeName = getOfficeName(resolvedOfficeId, data?.offices || []);
  const teamName = getTeamName(resolvedTeamId, data?.teams || []);

  const officeTeamsCount = useMemo(() => {
    if (!resolvedOfficeId) return 0;
    return (data?.teams || []).filter((t) => t.officeId === resolvedOfficeId).length;
  }, [data?.teams, resolvedOfficeId]);

  const officeAgentsCount = useMemo(() => {
    if (!resolvedOfficeId) return 0;
    return (data?.users || []).filter(
      (u) => u.role === ROLE.AGENT && u.officeId === resolvedOfficeId
    ).length;
  }, [data?.users, resolvedOfficeId]);

  const teamAgentsCount = useMemo(() => {
    if (!resolvedTeamId) return 0;
    return (data?.users || []).filter(
      (u) => u.role === ROLE.AGENT && u.teamId === resolvedTeamId
    ).length;
  }, [data?.users, resolvedTeamId]);

  const staffLeads = useMemo(() => {
    if (!liveStaff) return [];
    const allLeads = data?.leads || [];
    if (liveStaff.role === ROLE.OFFICE_MANAGER) {
      return allLeads.filter((l) => l.assignedToOffice === resolvedOfficeId);
    }
    if (liveStaff.role === ROLE.TEAM_LEADER) {
      return allLeads.filter((l) =>
        (resolvedTeamId && l.assignedToTeam === resolvedTeamId) ||
        l.assignedToTeamLeader === liveStaff.id
      );
    }
    return allLeads.filter((l) => l.assignedToAgent === liveStaff.id);
  }, [data?.leads, liveStaff, resolvedOfficeId, resolvedTeamId]);

  const depositsCount = useMemo(
    () => staffLeads.filter((l) => l.stage === 'Deposit').length,
    [staffLeads]
  );
  const conversionRate =
    staffLeads.length > 0 ? ((depositsCount / staffLeads.length) * 100).toFixed(1) : '0.0';

  if (!liveStaff) return null;

  const panelPath =
    liveStaff.role === ROLE.OFFICE_MANAGER
      ? `/admin/office-manager/${liveStaff.id}`
      : liveStaff.role === ROLE.TEAM_LEADER
      ? `/admin/team-leader/${liveStaff.id}`
      : `/admin/agent/${liveStaff.id}`;

  const viewerRole = currentUser?.role || ROLE.SUPER_ADMIN;
  const viewerId =
    currentUser?.id ||
    (data?.users || []).find((u) => u.role === ROLE.SUPER_ADMIN)?.id ||
    '';
  const fullProfilePath = getStaffProfilePath(viewerRole, viewerId, liveStaff.id);
  const returnPath = getRoleWorkspacePath(viewerRole, viewerId);

  const copyText = async (val, label = 'Copied to clipboard') => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      showNotification?.(label);
    } catch {
      showNotification?.('Copy failed, please copy manually.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        zIndex: 2050,
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--crm-card, #23242A)',
          border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.1))',
          borderRadius: 18,
          width: '100%',
          maxWidth: 540,
          padding: 24,
          color: 'var(--crm-text-primary, #FFFFFF)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Summary Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            paddingBottom: 16,
            borderBottom: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, var(--crm-accent, #0A84FF) 0%, #5E5CE6 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)',
              }}
            >
              {getInitials(liveStaff.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--crm-text-primary, #FFFFFF)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {liveStaff.name}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    ...(ROLE_BADGE_STYLE[liveStaff.role] || ROLE_BADGE_STYLE[ROLE.AGENT]),
                  }}
                >
                  {liveStaff.role}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span className={`crm-badge ${isBlocked ? 'crm-badge-danger' : 'crm-badge-success'}`}>
                  {isVirtual ? 'Unassigned Account' : isBlocked ? 'Blocked' : 'Active'}
                </span>
                {!isVirtual && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: liveStaff.isLoggedIn ? '#30D158' : '#8E8E93',
                      background: liveStaff.isLoggedIn ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${liveStaff.isLoggedIn ? 'rgba(48,209,88,0.35)' : 'var(--crm-border, rgba(255,255,255,0.08))'}`,
                      padding: '2px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: liveStaff.isLoggedIn ? '#30D158' : '#8E8E93',
                      }}
                    />
                    {liveStaff.isLoggedIn ? 'Online' : 'Offline'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="crm-modal-close-btn"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Concise Staff Summary Grid */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))',
            borderRadius: 12,
            padding: 14,
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 16px',
            fontSize: 12.5,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', marginBottom: 2 }}>Staff ID</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 600 }}>
              {liveStaff.id}
              <button
                type="button"
                onClick={() => copyText(liveStaff.id, 'ID copied')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--crm-text-secondary, #8E8E93)',
                  cursor: 'pointer',
                  marginLeft: 4,
                  fontSize: 11,
                }}
                title="Copy ID"
              >
                📋
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', marginBottom: 2 }}>Email</div>
            <div
              style={{
                color: 'var(--crm-text-primary, #FFFFFF)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {liveStaff.email || '-'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', marginBottom: 2 }}>Office</div>
            <div style={{ color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 600 }}>{officeName}</div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 2 }}>
              {liveStaff.role === ROLE.OFFICE_MANAGER ? 'Office Structure' : 'Team'}
            </div>
            <div style={{ color: 'var(--crm-text-primary)', fontWeight: 600 }}>
              {liveStaff.role === ROLE.OFFICE_MANAGER
                ? `${officeTeamsCount} Team${officeTeamsCount !== 1 ? 's' : ''} · ${officeAgentsCount} Agent${officeAgentsCount !== 1 ? 's' : ''}`
                : teamName}
            </div>
          </div>

          {liveStaff.role === ROLE.TEAM_LEADER && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 2 }}>Team Roster</div>
              <div style={{ color: 'var(--crm-text-primary)', fontWeight: 600 }}>
                {teamAgentsCount} / {teamObj?.maxSize || '-'} Agents
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 2 }}>Last Login</div>
            <div style={{ color: 'var(--crm-text-secondary)' }}>
              {liveStaff.lastLoginAt
                ? new Date(liveStaff.lastLoginAt).toLocaleDateString()
                : 'Never'}
            </div>
          </div>
        </div>

        {/* Compact KPI Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 12,
          }}
        >
          {[
            {
              label:
                liveStaff.role === ROLE.OFFICE_MANAGER
                  ? 'Office Leads'
                  : liveStaff.role === ROLE.TEAM_LEADER
                  ? 'Team Leads'
                  : 'Assigned Leads',
              value: staffLeads.length,
              color: '#0A84FF',
            },
            { label: 'Deposits', value: depositsCount, color: '#0ECB81' },
            { label: 'Conversion', value: `${conversionRate}%`, color: 'var(--crm-accent)' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: 'var(--crm-bg)',
                border: '1px solid var(--crm-card)',
                borderRadius: 10,
                padding: '10px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 3 }}>{kpi.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--crm-card)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose?.();
              navigate(fullProfilePath, {
                state: {
                  returnTo: returnPath,
                  returnLabel: 'Back to Staff',
                },
              });
            }}
            style={{
              flex: '1 1 180px',
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--crm-accent)',
              color: '#1E2329',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            👤 Open Full Profile
          </button>

          {!isVirtual && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate(panelPath, {
                  state: {
                    returnTo: returnPath,
                    returnLabel: 'Back to Staff',
                    impersonatedFrom: currentUser?.id,
                  },
                });
              }}
              style={{
                flex: '1 1 160px',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(14,203,129,0.4)',
                background: 'rgba(14,203,129,0.14)',
                color: '#0ECB81',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              ↗ View Workspace Panel
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--crm-border)',
              background: 'var(--crm-bg)',
              color: 'var(--crm-text-primary)',
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
