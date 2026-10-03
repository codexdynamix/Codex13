import React, { useEffect, useState } from 'react';
import { listStaff, getStaffCapabilities, updateStaffCapabilities } from '../adminApi';

const DEFAULT_CATALOG = {
  lead_upload: 'Lead Upload',
  create_agent: 'Create Agent',
  notifications: 'Notifications',
  security: 'Security',
  content: 'Content',
  enquiries: 'Enquiries',
  chat: 'Chat',
};

const DEFAULT_CAPABILITY_STATE = {
  lead_upload: true,
  create_agent: true,
  notifications: true,
  security: true,
  content: true,
  enquiries: true,
  chat: true,
};

export default function AgentAccess({ showNotification }) {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState('');
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG);
  const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITY_STATE);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');

  const loadStaff = async () => {
    const rows = await listStaff();
    const filtered = (rows || []).filter((user) => ['Agent', 'Team Leader', 'Office Manager'].includes(user.role));
    setStaff(filtered);
    setSelected((prev) => (prev && filtered.some((u) => u.id === prev) ? prev : (filtered[0]?.id || '')));
  };

  const loadCapabilities = async (id) => {
    if (!id) return;
    const payload = await getStaffCapabilities(id);
    setCatalog({ ...DEFAULT_CATALOG, ...(payload?.catalog || {}) });
    setCapabilities({ ...DEFAULT_CAPABILITY_STATE, ...(payload?.capabilities || {}) });
    setDirty(false);
    setStatus('');
  };

  useEffect(() => { loadStaff().catch(() => setStatus('Could not load staff accounts.')); }, []);
  useEffect(() => { loadCapabilities(selected).catch(() => setStatus('Could not load capabilities.')); }, [selected]);

  const save = async () => {
    if (!selected) return;
    try {
      const payload = await updateStaffCapabilities(selected, capabilities);
      if (payload?.capabilities) {
        setCapabilities({ ...DEFAULT_CAPABILITY_STATE, ...payload.capabilities });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('codex-capabilities-updated', { detail: { staffId: selected, capabilities } }));
      }
      setDirty(false);
      setStatus('Access saved.');
      showNotification?.('Staff access updated.');
    } catch {
      setStatus('Could not save access.');
    }
  };

  const currentStaff = staff.find((user) => user.id === selected);
  return (
    <div className="crm-super-admin-card agent-access-panel">
      <div className="agent-capability-heading">
        <div><h2>Agent Access</h2><p>Grant or revoke CRM tools for Agents, Team Leaders, and Office Managers.</p></div>
        <select className="crm-super-admin-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Select staff account...</option>
          {staff.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.role}</option>)}
        </select>
      </div>
      {currentStaff ? (
        <>
          <div className="agent-access-selected"><strong>{currentStaff.name}</strong><span>{currentStaff.email}</span><span>{currentStaff.role}</span></div>
          <div className="agent-capability-grid">
            {Object.entries(catalog).map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={!!capabilities[key]} onChange={(event) => { setCapabilities((previous) => ({ ...previous, [key]: event.target.checked })); setDirty(true); }} /><span>{label}</span></label>
            ))}
          </div>
          <div className="agent-capability-actions"><span className="agent-cap-status">{status}</span><button type="button" className="crm-super-admin-btn primary" disabled={!dirty} onClick={save}>Save access</button></div>
        </>
      ) : <div className="agent-empty-state">Select a staff account to manage access.</div>}
    </div>
  );
}
