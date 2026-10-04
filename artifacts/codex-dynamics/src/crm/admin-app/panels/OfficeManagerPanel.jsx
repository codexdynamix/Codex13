import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ROLE, LEAD_STATUSES, normalizeStage,
  getOfficeName, getTeamName, getUserName, getCountryFlag,
  getTeamAgentCount, statusClass,
  CreateLeadModal, AddCommentModal,
  stageColor,
  assignableAgents, assignableAgentLabel,
  StatusDropdown,
} from '../shared';
import { SearchAutocomplete } from '../components/UserChrome.jsx';
import ReactCapabilityWorkspace from '../components/ReactCapabilityWorkspace.jsx';
import StaffProfileModal from '../components/StaffProfileModal.jsx';
import { searchAdminLeads } from '../adminApi';

function OfficeManagerPanel({ data, setData, currentUser, assignTeamLeader, createTeamLeader, createAgent, toggleStaffBlocked, setLeadAssignment, updateLead, createLead, setUserLoginState, showNotification }) {
  const navigate = useNavigate();
  const [activeProfileStaff, setActiveProfileStaff] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderPassword, setNewLeaderPassword] = useState('');
  const [newTeamSize, setNewTeamSize] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newLeaderLink, setNewLeaderLink] = useState('');
  const [newAgentLink, setNewAgentLink] = useState('');
  const teamsForOffice = data.teams.filter((t) => t.officeId === currentUser.officeId);
  const onlineTeamLeaders = data.users.filter((u) => u.role === ROLE.TEAM_LEADER && u.isLoggedIn && u.officeId === currentUser.officeId).length;

  const copyToClipboard = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      showNotification('Login link copied to clipboard');
    } catch {
      showNotification('Copy failed, please copy manually');
    }
  };

  // Calculate useful metrics and analytics
  const officeLeads = data.leads.filter((lead) => lead.assignedToOffice === currentUser.officeId);
  const teamLeaders = data.users.filter((u) => u.role === ROLE.TEAM_LEADER && u.officeId === currentUser.officeId);
  const agents = assignableAgents(data.users, currentUser, { officeId: currentUser.officeId });
  
  // Lead status distribution
  const leadsByStatus = {};
  LEAD_STATUSES.forEach(status => {
    leadsByStatus[status] = officeLeads.filter((lead) => lead.stage === status).length;
  });
  
  // Team performance metrics
  const teamMetrics = teamsForOffice.map((team) => {
    const teamLeads = officeLeads.filter((lead) => lead.assignedToTeam === team.id);
    const teamAgents = agents.filter((u) => u.teamId === team.id);
    const leaderInfo = teamLeaders.find((l) => l.teamId === team.id);
    const depositsCount = teamLeads.filter((l) => l.stage === 'Deposit').length;
    return {
      id: team.id,
      name: team.name,
      leadCount: teamLeads.length,
      agentCount: teamAgents.length,
      leaderName: leaderInfo?.name || 'Unassigned',
      leaderOnline: leaderInfo?.isLoggedIn || false,
      capacity: (teamAgents.length / team.maxSize) * 100,
      depositsCount: depositsCount,
      conversionRate: teamLeads.length > 0 ? ((depositsCount / teamLeads.length) * 100).toFixed(1) : 0
    };
  });

  // Agent activity metrics
  const agentMetrics = agents.map((agent) => {
    const agentLeads = officeLeads.filter((lead) => lead.assignedToAgent === agent.id);
    return {
      id: agent.id,
      name: agent.name,
      leadCount: agentLeads.length,
      isOnline: agent.isLoggedIn,
      team: getTeamName(agent.teamId, data.teams)
    };
  });

  // Overall office metrics
  const totalLeads = officeLeads.length;
  const totalDeposits = officeLeads.filter((l) => l.stage === 'Deposit').length;
  const officeConversionRate = totalLeads > 0 ? ((totalDeposits / totalLeads) * 100).toFixed(1) : 0;

  // Identify teams needing attention
  const teamsNeedingAttention = teamMetrics.filter((t) => t.agentCount === 0 || !t.leaderOnline).sort((a, b) => b.leadCount - a.leadCount);

  const nativeTabs = ['overview', 'teams', 'agents', 'leads', 'create'];
  const tabStorageKey = `om_activeTab:${currentUser?.id || 'unknown'}`;
  const [omTab, setOmTab] = useState(() => {
    const saved = sessionStorage.getItem(tabStorageKey);
    return nativeTabs.includes(saved) ? saved : 'overview';
  });
  useEffect(() => { sessionStorage.setItem(tabStorageKey, omTab); }, [omTab, tabStorageKey]);

  return (
    <div style={{ background: 'var(--crm-bg)', minHeight: '100%', padding: 24 }}>
      <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: 4, color: 'var(--crm-text-primary)' }}>{getOfficeName(currentUser.officeId, data.offices)}</h2>
            <p style={{ margin: 0, color: 'var(--crm-text-secondary)', fontSize: 13 }}>Office Manager Dashboard</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Teams', value: teamsForOffice.length },
            { label: 'Leaders', value: teamLeaders.length, sub: onlineTeamLeaders + ' online', subColor: '#45d2a0' },
            { label: 'Agents', value: agents.length },
            { label: 'Total Leads', value: totalLeads },
            { label: 'Deposits', value: totalDeposits, valColor: '#45d2a0' },
            { label: 'Conversion', value: officeConversionRate + '%', valColor: '#45d2a0' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--crm-card)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--crm-border)' }}>
              <div style={{ color: 'var(--crm-text-secondary)', fontSize: 12, marginBottom: 6 }}>{stat.label}</div>
              <div style={{ color: stat.valColor || 'var(--crm-accent)', fontSize: '1.4rem', fontWeight: 700 }}>{stat.value}</div>
              {stat.sub && <div style={{ color: stat.subColor || 'var(--crm-text-secondary)', fontSize: 11, marginTop: 2 }}>{stat.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="crm-super-admin-header crm-role-panel-header" style={{ marginBottom: 20 }}>
        <div className="crm-super-admin-tabs">
          {[['overview', 'Dashboard'], ['teams', 'Teams'], ['agents', 'Agents'], ['leads', 'Client Management'], ['create', 'Create']].map(([key, label]) => (
            <button key={key} className={`crm-super-admin-tab-btn ${omTab === key ? 'crm-active' : ''}`} onClick={() => setOmTab(key)}>{label}</button>
          ))}
        </div>
      </div>
      <ReactCapabilityWorkspace
        data={data}
        currentUser={currentUser}
        showNotification={showNotification}
        activeTab={omTab}
        onActiveChange={setOmTab}
        nativeTabKeys={nativeTabs}
        fallbackTab="overview"
      />

      {omTab === 'overview' && (
        <>
          {teamsNeedingAttention.length > 0 && (
            <div className="crm-super-admin-card" style={{ marginBottom: 20, borderColor: '#ff646440', background: 'rgba(255,100,100,0.03)' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#ff6464', fontSize: 13, fontWeight: 600 }}>⚠ Teams Needing Attention</h3>
              <div className="crm-super-admin-table-wrapper">
                <table className="crm-super-admin-table">
                  <thead><tr><th>Team</th><th>Leader</th><th style={{ textAlign: 'center' }}>Agents</th><th style={{ textAlign: 'center' }}>Leads</th><th>Issue</th></tr></thead>
                  <tbody>
                    {teamsNeedingAttention.map(t => {
                      const leader = teamLeaders.find(l => l.teamId === t.id);
                      return (
                        <tr
                          key={t.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            setActiveProfileStaff(
                              leader || {
                                id: `team_${t.id}`,
                                isTeamOnly: true,
                                teamId: t.id,
                                officeId: currentUser.officeId,
                                role: ROLE.TEAM_LEADER,
                                name: `${t.name} (Unassigned Leader)`,
                                status: 'Active',
                              }
                            )
                          }
                          title={`Open summary for ${leader ? leader.name : t.name}`}
                        >
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td>{t.leaderName}</td>
                          <td style={{ textAlign: 'center' }}>{t.agentCount}</td>
                          <td style={{ textAlign: 'center' }}>{t.leadCount}</td>
                          <td style={{ color: '#ff6464', fontSize: 12 }}>{!t.leaderOnline && 'Leader offline'}{!t.leaderOnline && t.agentCount === 0 && '  /  '}{t.agentCount === 0 && 'No agents'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="crm-super-admin-card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lead Status Distribution</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {Object.entries(leadsByStatus).filter(([, count]) => count > 0).map(([status, count]) => {
                const color = stageColor(status);
                return (
                  <div key={status} style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderTop: '2px solid ' + color, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ color: 'var(--crm-text-secondary)', fontSize: 11, marginBottom: 6 }}>{status}</div>
                    <div style={{ color, fontSize: '1.3rem', fontWeight: 700 }}>{count}</div>
                    <div style={{ color: 'var(--crm-text-secondary)', fontSize: 11, marginTop: 2 }}>{totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(0) : 0}%</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="crm-super-admin-card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team Performance</h3>
            <div className="crm-super-admin-table-wrapper">
              <table className="crm-super-admin-table">
                <thead><tr><th>#</th><th>Team</th><th>Leader</th><th style={{ textAlign: 'center' }}>Leads</th><th style={{ textAlign: 'center' }}>Deposits</th><th style={{ textAlign: 'center' }}>Conversion</th><th style={{ textAlign: 'center' }}>Agents</th></tr></thead>
                <tbody>
                  {teamMetrics.sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate)).map((team, idx) => {
                    const leader = teamLeaders.find(l => l.teamId === team.id);
                    return (
                      <tr
                        key={team.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setActiveProfileStaff(
                            leader || {
                              id: `team_${team.id}`,
                              isTeamOnly: true,
                              teamId: team.id,
                              officeId: currentUser.officeId,
                              role: ROLE.TEAM_LEADER,
                              name: `${team.name} (Unassigned Leader)`,
                              status: 'Active',
                            }
                          )
                        }
                        title={`Open summary for ${leader ? leader.name : team.name}`}
                      >
                        <td style={{ color: ['#ffd700','#c0c0c0','#cd7f32'][idx] || 'var(--crm-text-secondary)', fontWeight: 700, width: 32 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{team.name}</td>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: team.leaderOnline ? '#45d2a0' : 'var(--crm-text-secondary)', display: 'inline-block', flexShrink: 0 }}></span>{team.leaderName}</div></td>
                        <td style={{ textAlign: 'center' }}>{team.leadCount}</td>
                        <td style={{ textAlign: 'center', color: '#45d2a0', fontWeight: 600 }}>{team.depositsCount}</td>
                        <td style={{ textAlign: 'center', color: 'var(--crm-accent)', fontWeight: 700 }}>{team.conversionRate}%</td>
                        <td style={{ textAlign: 'center' }}>{team.agentCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {omTab === 'teams' && (
        <div className="crm-super-admin-card">
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
            Click any team / leader row to open their summary modal and access their full profile.
          </div>
          <div className="crm-super-admin-table-wrapper">
            <table className="crm-super-admin-table">
              <thead><tr><th>ID</th><th>Team</th><th>Leader</th><th style={{ textAlign: 'center' }}>Agents</th><th style={{ textAlign: 'center' }}>Cap.</th><th style={{ textAlign: 'center' }}>Leads</th><th style={{ textAlign: 'center' }}>Deposits</th><th style={{ textAlign: 'center' }}>Conv.</th></tr></thead>
              <tbody>
                {teamsForOffice.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 24 }}>No teams yet - create one in the Create tab.</td></tr>
                ) : teamsForOffice.map(team => {
                  const used = getTeamAgentCount(team.id, data.users);
                  const pct = Math.round((used / (team.maxSize || 1)) * 100);
                  const metric = teamMetrics.find(m => m.id === team.id);
                  const leader = data.users.find(u => (u.id === team.leaderId) || (u.role === ROLE.TEAM_LEADER && u.teamId === team.id));
                  return (
                    <tr
                      key={team.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        setActiveProfileStaff(
                          leader || {
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
                      title={`Open summary for ${leader ? leader.name : team.name}`}
                    >
                      <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{team.id ? team.id.slice(0, 6) : '-'}</span>
                          {team.id && <button title={team.id} onClick={() => navigator.clipboard.writeText(team.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{team.name}</td>
                      <td>{leader ? (<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: leader.isLoggedIn ? '#45d2a0' : 'var(--crm-text-secondary)', display: 'inline-block', flexShrink: 0 }}></span><span style={{ fontWeight: 600, color: 'var(--crm-text-primary)' }}>{leader.name}</span></div>) : <span style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>Unassigned</span>}</td>
                      <td style={{ textAlign: 'center' }}>{used}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, background: 'var(--crm-bg)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: pct + '%', height: '100%', background: pct >= 90 ? '#ff6464' : pct >= 70 ? 'var(--crm-accent)' : '#45d2a0' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)', minWidth: 28 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{metric?.leadCount || 0}</td>
                      <td style={{ textAlign: 'center', color: '#45d2a0', fontWeight: 600 }}>{metric?.depositsCount || 0}</td>
                      <td style={{ textAlign: 'center', color: 'var(--crm-accent)', fontWeight: 600 }}>{metric?.conversionRate || 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {omTab === 'agents' && (
        <div className="crm-super-admin-card">
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
            Click any agent on a row to open their staff profile modal and manage their account.
          </div>
          <div className="crm-super-admin-table-wrapper">
            <table className="crm-super-admin-table">
              <thead><tr><th>ID</th><th>Agent</th><th>Team</th><th style={{ textAlign: 'center' }}>Leads</th><th>Status</th><th>Last Login</th></tr></thead>
              <tbody>
                {agentMetrics.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--crm-text-secondary)', padding: 24 }}>No agents yet.</td></tr>
                ) : agentMetrics.sort((a, b) => b.leadCount - a.leadCount).map(agent => {
                  const fullAgent = data.users.find(u => u.id === agent.id);
                  return (
                    <tr
                      key={agent.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => fullAgent && setActiveProfileStaff(fullAgent)}
                      title={`Click to open ${agent.name}'s staff profile`}
                    >
                      <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{agent.id ? agent.id.slice(0, 6) : '-'}</span>
                          {agent.id && <button title={agent.id} onClick={() => navigator.clipboard.writeText(agent.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{agent.name}</td>
                      <td style={{ color: 'var(--crm-text-secondary)' }}>{agent.team}</td>
                      <td style={{ textAlign: 'center', color: 'var(--crm-accent)', fontWeight: 700 }}>{agent.leadCount}</td>
                      <td><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: agent.isOnline ? 'rgba(69,210,160,0.12)' : 'var(--crm-card)', color: agent.isOnline ? '#45d2a0' : 'var(--crm-text-secondary)', border: '1px solid ' + (agent.isOnline ? '#45d2a030' : 'var(--crm-border)') }}>{agent.isOnline ? ' Online' : '○ Offline'}</span></td>
                      <td style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>{fullAgent?.lastLoginAt ? new Date(fullAgent.lastLoginAt).toLocaleString() : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {omTab === 'leads' && (
        <OfficeLeadsTable data={data} currentUser={currentUser} teamsForOffice={teamsForOffice} agents={agents} setLeadAssignment={setLeadAssignment} updateLead={updateLead} createLead={createLead} showNotification={showNotification} />
      )}

      {omTab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="crm-super-admin-card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--crm-text-primary)' }}>New Team &amp; Leader</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Team Name</div><input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team name..." autoComplete="off" className="crm-super-admin-input" /></div>
              <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Max Size</div><input value={newTeamSize} onChange={e => setNewTeamSize(e.target.value)} placeholder="e.g. 10" type="number" autoComplete="off" className="crm-super-admin-input" /></div>
              <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Leader Name</div><input value={newLeaderName} onChange={e => setNewLeaderName(e.target.value)} placeholder="Leader name..." autoComplete="off" className="crm-super-admin-input" /></div>
              <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Leader Password</div><input value={newLeaderPassword} onChange={e => setNewLeaderPassword(e.target.value)} placeholder="Password..." type="password" autoComplete="new-password" className="crm-super-admin-input" /></div>
              <button className="crm-super-admin-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={!newTeamName || !newTeamSize || !newLeaderName || !newLeaderPassword} onClick={async () => {
                const r = await createTeamLeader(currentUser.officeId, newTeamName, newLeaderName, newLeaderPassword, newTeamSize);
                if (!r) return;
                if (r.loginLink) setNewLeaderLink(r.loginLink);
                setNewTeamName(''); setNewTeamSize(''); setNewLeaderName(''); setNewLeaderPassword('');
                showNotification('Team and Leader created!');
              }}>✓ Create Team &amp; Leader</button>
              {newLeaderLink && (
                <div style={{ background: 'rgba(69,210,160,0.06)', border: '1px solid #45d2a030', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>Leader Login Link</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input value={newLeaderLink} readOnly className="crm-super-admin-input" style={{ flex: 1, fontSize: 11 }} /><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newLeaderLink)}>[list]</button></div>
                </div>
              )}
            </div>
          </div>
          <div className="crm-super-admin-card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--crm-text-primary)' }}>New Agent</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Assign to Team</div>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="crm-super-admin-select">
                  <option value="">No team (direct to this office)</option>
                  {teamsForOffice.map(t => <option key={t.id} value={t.id}>{t.name} ({getTeamAgentCount(t.id, data.users)}/{t.maxSize})</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Agent Name</div><input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="Agent name..." autoComplete="off" className="crm-super-admin-input" /></div>
              <div><div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 4 }}>Agent Password</div><input value={newAgentPassword} onChange={e => setNewAgentPassword(e.target.value)} placeholder="Password..." type="password" autoComplete="new-password" className="crm-super-admin-input" /></div>
              <button className="crm-super-admin-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={!teamId || !newAgentName || !newAgentPassword} onClick={async () => {
                const r = await createAgent(teamId || null, newAgentName, newAgentPassword, currentUser.officeId);
                if (!r) return;
                if (r.loginLink) setNewAgentLink(r.loginLink);
                setNewAgentName(''); setNewAgentPassword('');
                showNotification('Agent created!');
              }}>✓ Create Agent</button>
              {newAgentLink && (
                <div style={{ background: 'rgba(69,210,160,0.06)', border: '1px solid #45d2a030', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>Agent Login Link</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input value={newAgentLink} readOnly className="crm-super-admin-input" style={{ flex: 1, fontSize: 11 }} /><button className="crm-link-copy-btn" onClick={() => copyToClipboard(newAgentLink)}>[list]</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
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

function OfficeLeadsTable({ data, currentUser, teamsForOffice, agents, setLeadAssignment, updateLead, createLead, showNotification }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [page, setPage] = useState(1);
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkAgentId, setBulkAgentId] = useState('');
  const [selected, setSelected] = useState([]);
  const [showShuffle, setShowShuffle] = useState(false);
  const [shuffleScope, setShuffleScope] = useState('teams'); // 'teams' | 'agents'
  const [shuffleTargets, setShuffleTargets] = useState([]);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [commentLead, setCommentLead] = useState(null);
  const pageSize = 25;

  const officeLeads = useMemo(() => data.leads.filter(l => l.assignedToOffice === currentUser.officeId), [data.leads, currentUser.officeId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return officeLeads.filter(lead => {
      if (filterTeam && lead.assignedToTeam !== filterTeam) return false;
      if (filterAgent === '__unassigned__' && lead.assignedToAgent) return false;
      if (filterAgent && filterAgent !== '__unassigned__' && lead.assignedToAgent !== filterAgent) return false;

      if (q && !(
        (lead.firstName || '').toLowerCase().includes(q) ||
        (lead.lastName || '').toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        (lead.country || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [officeLeads, search, filterTeam, filterAgent]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const unassigned = officeLeads.filter(l => !l.assignedToTeam).length;
  const pendingAgent = officeLeads.filter(l => l.assignedToTeam && !l.assignedToAgent).length;
  const fullyAssigned = officeLeads.filter(l => l.assignedToAgent).length;

  const allPageSelected = paged.length > 0 && paged.every(l => selected.includes(l.id));
  const toggleAll = () => setSelected(allPageSelected ? selected.filter(id => !paged.find(l => l.id === id)) : [...new Set([...selected, ...paged.map(l => l.id)])]);

  const handleBulkAssignTeam = () => {
    if (!bulkTeamId || selected.length === 0) { showNotification('Select leads and a team first.'); return; }
    selected.forEach(lid => setLeadAssignment({ leadId: lid, officeId: currentUser.officeId, teamId: bulkTeamId, agentId: null }));
    showNotification(`${selected.length} leads assigned to team.`);
    setSelected([]); setBulkTeamId('');
  };

  const handleBulkAssignAgent = () => {
    if (!bulkAgentId || selected.length === 0) { showNotification('Select leads and an agent first.'); return; }
    const agent = agents.find(a => a.id === bulkAgentId);
    if (!agent) return;
    selected.forEach(lid => setLeadAssignment({ leadId: lid, officeId: currentUser.officeId, teamId: agent.teamId, agentId: bulkAgentId }));
    showNotification(`${selected.length} leads assigned to agent.`);
    setSelected([]); setBulkAgentId('');
  };

  const toggleShuffleTarget = (id) => setShuffleTargets(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleShuffleOffice = () => {
    if (shuffleTargets.length === 0) { showNotification('Pick at least one target.'); return; }
    // Pool = selected leads or all unassigned-to-agent leads in the office
    const pool = selected.length > 0
      ? officeLeads.filter(l => selected.includes(l.id))
      : officeLeads.filter(l => !l.assignedToAgent);
    if (pool.length === 0) { showNotification('No leads to distribute.'); return; }
    pool.forEach((lead, idx) => {
      const targetId = shuffleTargets[idx % shuffleTargets.length];
      if (shuffleScope === 'teams') {
        setLeadAssignment({ leadId: lead.id, officeId: currentUser.officeId, teamId: targetId, agentId: null });
      } else {
        const agent = agents.find(a => a.id === targetId);
        if (agent) setLeadAssignment({ leadId: lead.id, officeId: currentUser.officeId, teamId: agent.teamId, agentId: agent.id });
      }
    });
    showNotification(`Shuffled ${pool.length} leads across ${shuffleTargets.length} ${shuffleScope}.`);
    setSelected([]); setShuffleTargets([]); setShowShuffle(false);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Pending Team', value: unassigned, color: 'var(--crm-accent)' },
          { label: 'Pending Agent', value: pendingAgent, color: '#0A84FF' },
          { label: 'Fully Assigned', value: fullyAssigned, color: '#0ECB81' },
          {
            label: 'Active Leads',
            value: officeLeads.filter(l => (l.stage || l.status || '').toLowerCase() === 'active').length,
            color: '#0ECB81',
            title: 'Active agency leads',
          },
          {
            label: 'New Leads',
            value: officeLeads.filter(l => (l.stage || l.status || '').toLowerCase() === 'new').length,
            color: '#F59E0B',
            title: 'New incoming leads',
          },
          { label: 'Total Office', value: officeLeads.length, color: 'var(--crm-text-primary)' },
        ].map(s => (
          <div
            key={s.label}
            title={s.title}
            onClick={s.onClick}
            style={{
              background: 'var(--crm-card)',
              border: '1px solid var(--crm-border)',
              borderRadius: 6,
              padding: '10px 14px',
              cursor: s.onClick ? 'pointer' : 'default',
            }}
          >
            <div style={{ fontSize: 11, color: '#a3adc0', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <SearchAutocomplete
          className="crm-super-admin-input"
          placeholder="Search by name, email, phone..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          fetchSuggestions={searchAdminLeads}
          style={{ flex: 2, minWidth: 160 }}
          buildSuggestions={(q) => {
            const ql = q.toLowerCase();
            return officeLeads
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
        <select style={{ flex: 1, minWidth: 130, padding: '8px', background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 6, color: '#f5f6fb', fontSize: 13 }} value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setPage(1); }}>
          <option value="">All Teams</option>
          {teamsForOffice.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select style={{ flex: 1, minWidth: 130, padding: '8px', background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 6, color: '#f5f6fb', fontSize: 13 }} value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }}>
          <option value="">All (incl. assigned)</option>
          <option value="__unassigned__">Unassigned to Agent</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {(search || filterTeam || filterAgent) && (
          <button onClick={() => { setSearch(''); setFilterTeam(''); setFilterAgent(''); setPage(1); }} style={{ padding: '8px 12px', background: 'var(--crm-border)', color: '#a3adc0', border: '1px solid var(--crm-border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Clear</button>
        )}
        <button
          onClick={() => setShowShuffle(v => !v)}
          style={{ padding: '8px 12px', background: showShuffle ? '#0A84FF' : 'var(--crm-border)', color: showShuffle ? 'var(--crm-bg)' : '#0A84FF', border: '1px solid #0A84FF', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
        >
          🔀 Shuffle / Distribute
        </button>
        <button
          onClick={() => setShowCreateLead(true)}
          style={{ padding: '8px 14px', background: 'var(--crm-accent)', color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
        >
          + New Lead
        </button>
      </div>

      {showShuffle && (
        <div style={{ background: 'var(--crm-card)', border: '1px solid #0A84FF', borderRadius: 6, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#0A84FF', fontWeight: 600, marginBottom: 8 }}>
            Shuffle / Distribute - {selected.length > 0 ? `${selected.length} selected lead(s)` : `all leads with no agent (${officeLeads.filter(l => !l.assignedToAgent).length})`}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#a3adc0', marginBottom: 4 }}>Distribute among</div>
              <select value={shuffleScope} onChange={e => { setShuffleScope(e.target.value); setShuffleTargets([]); }} style={{ padding: '6px 8px', background: 'var(--crm-border)', border: '1px solid var(--crm-border)', borderRadius: 4, color: '#f5f6fb', fontSize: 13 }}>
                <option value="teams">Teams in this office</option>
                <option value="agents">Agents in this office</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#a3adc0', marginBottom: 6 }}>Pick targets ({shuffleTargets.length} selected):</div>
          <div style={{ maxHeight: 130, overflowY: 'auto', background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 6, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {(shuffleScope === 'teams' ? teamsForOffice.map(t => ({ id: t.id, label: t.name })) : agents.map(a => ({ id: a.id, label: `${a.name}  /  ${getTeamName(a.teamId, data.teams)}` }))).map(t => (
              <button
                key={t.id}
                onClick={() => toggleShuffleTarget(t.id)}
                style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                  background: shuffleTargets.includes(t.id) ? '#0A84FF' : 'var(--crm-border)',
                  color: shuffleTargets.includes(t.id) ? 'var(--crm-bg)' : '#f5f6fb',
                  border: 'none', fontWeight: shuffleTargets.includes(t.id) ? 600 : 400,
                }}
              >{t.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleShuffleOffice} disabled={shuffleTargets.length === 0} style={{ padding: '6px 14px', background: '#0A84FF', color: '#FFFFFF', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: shuffleTargets.length === 0 ? 0.5 : 1 }}>🔀 Shuffle Now</button>
            <button onClick={() => setShuffleTargets([])} style={{ padding: '6px 12px', background: 'var(--crm-border)', color: '#a3adc0', border: '1px solid var(--crm-border)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ background: 'var(--crm-card)', border: '1px solid var(--crm-accent)', borderRadius: 6, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--crm-accent)', fontSize: 13, fontWeight: 600 }}>{selected.length} selected</span>
          <select style={{ padding: '6px 8px', background: 'var(--crm-border)', border: '1px solid #474D57', borderRadius: 4, color: 'var(--crm-text-primary)', fontSize: 13 }} value={bulkTeamId} onChange={e => setBulkTeamId(e.target.value)}>
            <option value="">Assign to Team...</option>
            {teamsForOffice.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={handleBulkAssignTeam} style={{ padding: '6px 12px', background: 'var(--crm-accent)', color: '#FFFFFF', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Assign Team</button>
          <select style={{ padding: '6px 8px', background: 'var(--crm-border)', border: '1px solid #474D57', borderRadius: 4, color: 'var(--crm-text-primary)', fontSize: 13 }} value={bulkAgentId} onChange={e => setBulkAgentId(e.target.value)}>
            <option value="">Assign to Agent...</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({getTeamName(a.teamId, data.teams)})</option>)}
          </select>
          <button onClick={handleBulkAssignAgent} style={{ padding: '6px 12px', background: '#0ECB81', color: '#FFFFFF', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Assign Agent</button>
          <button onClick={() => setSelected([])} style={{ padding: '6px 10px', background: 'transparent', color: 'var(--crm-text-secondary)', border: '1px solid var(--crm-border)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Clear selection</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
        {filtered.length} leads  /  page {page}/{totalPages}
      </div>

      <div className="crm-admin-table-container">
        <table className="crm-admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allPageSelected} onChange={toggleAll} /></th>
              <th>Client ID</th>
              <th>Name</th>
              <th>Country</th>
              <th>Status</th>
              <th>Team</th>
              <th>Agent</th>
              <th>Registered</th>
              <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: 'var(--crm-text-secondary)' }}>No leads match your filters.</td></tr>
            ) : paged.map(lead => (
              <tr
                key={lead.id}
                style={{ background: selected.includes(lead.id) ? 'var(--crm-card)' : undefined, cursor: 'pointer' }}
                onClick={() => navigate(`/admin/office-manager/${currentUser.id}/lead/${lead.id}`, { state: { returnTo: `/admin/office-manager/${currentUser.id}`, returnLabel: 'Back to Office' } })}
              >
                <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(lead.id)} onChange={e => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter(id => id !== lead.id))} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crm-text-secondary)' }}>{lead.id ? lead.id.slice(0, 6) : '-'}</span>
                    {lead.id && <button title={lead.id} onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(lead.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-secondary)', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--crm-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--crm-text-secondary)'}><i className="fas fa-copy" style={{ fontSize: 10 }}></i></button>}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.firstName} {lead.lastName}</div>
                  <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.phone}</div>
                </td>
                <td style={{ fontSize: 12 }}>{getCountryFlag(lead.countryCode, lead.country)} {lead.country}</td>
                <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                  <StatusDropdown
                    value={normalizeStage(lead.stage)}
                    options={LEAD_STATUSES}
                    onChange={async (newStage) => {
                      if (updateLead) {
                        await updateLead(lead.id, { stage: newStage, status: newStage });
                        showNotification?.(`Status updated to "${newStage}".`);
                      }
                    }}
                  />
                </td>
                <td style={{ color: lead.assignedToTeam ? 'var(--crm-text-primary)' : 'var(--crm-accent)', fontSize: 12 }}>
                  {lead.assignedToTeam ? getTeamName(lead.assignedToTeam, data.teams) : 'Unassigned'}
                </td>
                <td style={{ color: lead.assignedToAgent ? '#0ECB81' : 'var(--crm-text-secondary)', fontSize: 12 }}>
                  {lead.assignedToAgent ? getUserName(lead.assignedToAgent, data.users) : '-'}
                </td>
                <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{lead.registeredDate || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-')}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    title="Add comment"
                    onClick={e => { e.stopPropagation(); setCommentLead(lead); }}
                    style={{ background: 'transparent', border: '1px solid var(--crm-border)', color: 'var(--crm-text-primary)', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >💬</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateLead && (
        <CreateLeadModal
          scope={{ officeId: currentUser.officeId }}
          teamsForOffice={teamsForOffice}
          agents={agents}
          onClose={() => setShowCreateLead(false)}
          onCreate={async (payload) => {
            const created = await createLead(payload);
            if (created) setShowCreateLead(false);
          }}
        />
      )}

      {commentLead && (
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
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '5px 10px', background: 'var(--crm-border)', color: 'var(--crm-text-primary)', border: '1px solid #474D57', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>«</button>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ padding: '5px 10px', background: 'var(--crm-border)', color: 'var(--crm-text-primary)', border: '1px solid #474D57', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>‹</button>
          <span style={{ color: '#a3adc0', fontSize: 12 }}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} style={{ padding: '5px 10px', background: 'var(--crm-border)', color: 'var(--crm-text-primary)', border: '1px solid #474D57', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={{ padding: '5px 10px', background: 'var(--crm-border)', color: 'var(--crm-text-primary)', border: '1px solid #474D57', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>»</button>
        </div>
      )}
    </div>
  );
}

export default OfficeManagerPanel;
