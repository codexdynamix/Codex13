import React, { useEffect, useState } from 'react';
import {
  getClientProfilePermissionsAdmin,
  saveClientProfilePermissionsAdmin,
} from '../adminApi.js';

const noneSelected = { access: 'none', accounting: 'none' };
const controlStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: '1px solid var(--crm-border, #3b3d45)',
  borderRadius: 8,
  background: 'var(--crm-card, #23242a)',
  color: 'var(--crm-text-primary, #fff)',
  fontSize: 12,
};

const levelLabel = (level) => ({
  none: 'No access',
  read: 'Read only',
  edit: 'Read and edit',
}[level] || 'No access');

export default function ClientProfilePermissionManager({ clientId, showNotification }) {
  const [staff, setStaff] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [draft, setDraft] = useState(noneSelected);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSelectedStaffId('');
    setDraft(noneSelected);
    getClientProfilePermissionsAdmin(clientId)
      .then((result) => {
        if (!active) return;
        setStaff(result.staff || []);
        setPermissions(result.permissions || {});
      })
      .catch((reason) => {
        if (active) setError(reason?.message || 'Could not load staff access for this client.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [clientId]);

  const selectStaff = (staffId) => {
    setSelectedStaffId(staffId);
    setDraft({ ...noneSelected, ...(permissions[staffId] || {}) });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selectedStaffId) return;
    setSaving(true);
    setError('');
    try {
      const result = await saveClientProfilePermissionsAdmin(clientId, selectedStaffId, draft);
      const saved = result.permissions || draft;
      setPermissions((current) => {
        const next = { ...current };
        if (saved.access === 'none' && saved.accounting === 'none') delete next[selectedStaffId];
        else next[selectedStaffId] = saved;
        return next;
      });
      setDraft(saved);
      showNotification?.('Client profile permissions saved.');
    } catch (reason) {
      setError(reason?.message || 'Could not save client profile permissions.');
    } finally {
      setSaving(false);
    }
  };

  const assignedStaff = staff.filter((member) => {
    const level = permissions[member.id];
    return level && (level.access !== 'none' || level.accounting !== 'none');
  });

  if (loading) return <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 13 }}>Loading staff access…</p>;

  return (
    <div style={{ display: 'grid', gap: 18, color: 'var(--crm-text-primary, #fff)' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 17 }}>Staff access to this client</h3>
        <p style={{ margin: '5px 0 0', color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>
          Choose a staff member and grant access to this client’s profile sections. Access &amp; Email and Accounting can have different permission levels.
        </p>
      </div>

      <form onSubmit={save} style={{ padding: 16, border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 12, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12, fontWeight: 600 }}>
          Office manager, team leader, or agent
          <select required style={controlStyle} value={selectedStaffId} onChange={(event) => selectStaff(event.target.value)}>
            <option value="">Select a staff member</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.role}{member.email ? ` · ${member.email}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {[
            ['access', 'Access & Email'],
            ['accounting', 'Accounting'],
          ].map(([section, label]) => (
            <label key={section} style={{ display: 'grid', gap: 6, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12, fontWeight: 600 }}>
              {label}
              <select
                style={controlStyle}
                value={draft[section]}
                disabled={!selectedStaffId}
                onChange={(event) => setDraft((current) => ({ ...current, [section]: event.target.value }))}
              >
                <option value="none">No access</option>
                <option value="read">Read only</option>
                <option value="edit">Read and edit</option>
              </select>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={!selectedStaffId || saving || staff.length === 0}
            style={{ border: 0, borderRadius: 8, padding: '9px 14px', background: '#0A84FF', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: !selectedStaffId ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : draft.access === 'none' && draft.accounting === 'none' ? 'Remove access' : 'Save permissions'}
          </button>
        </div>
      </form>

      {error && <div role="alert" style={{ color: '#ff716b', fontSize: 12 }}>{error}</div>}

      <section style={{ padding: 16, border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 12, overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>People with access</h4>
        {assignedStaff.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No staff members have access to this client’s sensitive profile sections.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
            <thead>
              <tr>
                {['Staff member', 'Role', 'Access & Email', 'Accounting'].map((heading) => (
                  <th key={heading} style={{ padding: '8px 10px', color: 'var(--crm-text-secondary, #a1a1aa)', borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignedStaff.map((member) => {
                const level = permissions[member.id] || noneSelected;
                return (
                  <tr key={member.id} style={{ borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>
                    <td style={{ padding: '9px 10px' }}>{member.name}{member.email ? <div style={{ marginTop: 3, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>{member.email}</div> : null}</td>
                    <td style={{ padding: '9px 10px' }}>{member.role}</td>
                    <td style={{ padding: '9px 10px' }}>{levelLabel(level.access)}</td>
                    <td style={{ padding: '9px 10px' }}>{levelLabel(level.accounting)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}