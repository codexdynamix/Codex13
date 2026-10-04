const ROLE_TO_PATH = {
  'Super Admin': 'super-admin',
  'Office Manager': 'office-manager',
  'Team Leader': 'team-leader',
  'Agent': 'agent',
  'super-admin': 'super-admin',
  'office-manager': 'office-manager',
  'team-leader': 'team-leader',
  'agent': 'agent',
};

export function getRoleWorkspacePath(role, userId) {
  const segment = ROLE_TO_PATH[role] || 'agent';
  return `/admin/${segment}/${userId || ''}`;
}

export function getLeadProfilePath(role, userId, leadId) {
  const base = getRoleWorkspacePath(role, userId);
  return `${base}/lead/${leadId}`;
}

export function getStaffProfilePath(role, userId, staffId) {
  const base = getRoleWorkspacePath(role, userId);
  return `${base}/staff/${staffId}`;
}

export function getRoleScopedStaff(data, role, currentUser) {
  const visibleStaff = (data?.users || []).filter((u) => u.status !== 'Disabled');
  const allStaff = visibleStaff.filter(
    (u) => u.role === 'Office Manager' || u.role === 'Team Leader' || u.role === 'Agent'
  );
  if (!currentUser) return allStaff;

  const roleName = role || currentUser.role;

  if (roleName === 'Super Admin' || roleName === 'super-admin') {
    return visibleStaff;
  }
  if (roleName === 'Office Manager' || roleName === 'office-manager') {
    return currentUser.officeId
      ? allStaff.filter((u) => u.officeId === currentUser.officeId)
      : allStaff;
  }
  if (roleName === 'Team Leader' || roleName === 'team-leader') {
    return currentUser.teamId
      ? allStaff.filter((u) => u.teamId === currentUser.teamId && u.role === 'Agent')
      : allStaff;
  }

  return allStaff;
}

export function getRoleScopedLeads(data, role, currentUser) {
  const allLeads = data?.leads || [];
  if (!currentUser) return allLeads;

  const roleName = role || currentUser.role;

  if (roleName === 'Super Admin' || roleName === 'super-admin') {
    return allLeads;
  }
  if (roleName === 'Office Manager' || roleName === 'office-manager') {
    return currentUser.officeId
      ? allLeads.filter((l) => (l.assignedToOffice || l.officeId) === currentUser.officeId)
      : allLeads;
  }
  if (roleName === 'Team Leader' || roleName === 'team-leader') {
    return allLeads.filter((lead) => {
      const belongsToTeam = currentUser.teamId
        && (lead.assignedToTeam || lead.teamId) === currentUser.teamId;
      const assignedDirectly = currentUser.id
        && (lead.assignedToTeamLeader || lead.assigned_team_leader_id) === currentUser.id;
      return Boolean(belongsToTeam || assignedDirectly);
    });
  }
  if (roleName === 'Agent' || roleName === 'agent') {
    return currentUser.id
      ? allLeads.filter((l) => (l.assignedToAgent || l.agentId) === currentUser.id)
      : allLeads;
  }

  return allLeads;
}
